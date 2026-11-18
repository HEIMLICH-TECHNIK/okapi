"""On-demand, seek-first native precision frames with transactional scanline caching.

No Viewer Process, working space, exposure, or video encoder enters this cache.
Integer video planes retain their code values; EXR half/float retain their storage
precision. Down-resolution samples original pixels without a lossy transcode.
"""
from collections import OrderedDict
from pathlib import Path
import hashlib
import json
import re
import threading
import uuid
import numpy as np
from . import pipeline as p
from . import image_io as io

RATIOS=(1,2,4,8,64)


def ranges(indices):
    result=[]
    for index in sorted(indices):
        if result and result[-1][1]+1==index:result[-1][1]=index
        else:result.append([index,index])
    return result


def pack(source,metadata,index,ratio,decoders,plane='rgba'):
    w,h=metadata['width'],metadata['height']
    source=Path(source);alpha=False
    info={'frame':index,'ratio':ratio,'format_width':w,'format_height':h,'bbox':[0,0,w,h],
          'channels':list(p.RGB),'code_range':[0,1,0,1],'matrix':[0,0,1,0],'decode':0,'plane':plane}
    if metadata['kind']=='video':
        frame=decoders.decoded(source,metadata,index)
        name=frame.format.name
        bits=frame.format.components[0].bits
        yuv=bool(re.match(r'yuva?\d\d\dp',name))
        alpha=any(c.is_alpha for c in frame.format.components)
        if yuv and metadata['source']['matrix']==10:
            raise ValueError('BT.2020 constant-luminance video requires a dedicated matrix adapter; no guessed RGB conversion was performed.')
        if yuv:
            full=('yuva444p' if alpha else 'yuv444p')+(f'{bits}le' if bits>8 else '')
            if name!=full:frame=frame.reformat(format=full)
            dtype=np.dtype('<u2' if bits>8 else 'u1');maximum=(1<<bits)-1
            values=[]
            for component in frame.planes:
                values.append(np.frombuffer(component,dtype=dtype).reshape(h,component.line_size//dtype.itemsize)[:,:w][::ratio,::ratio])
            image=np.full((*values[0].shape,4),maximum,'<u2')
            for c,value in enumerate(values):image[...,c]=value
            scale=2**(bits-8);limited=metadata['source']['range']!=2
            kr,kb={1:(.2126,.0722),4:(.30,.11),7:(.212,.087),9:(.2627,.0593)}.get(metadata['source']['matrix'],(.299,.114))
            info.update(encoding='rgba16uint',source_bits=bits,decode=2,
                code_range=[16*scale,219*scale,128*scale,224*scale] if limited else [0,maximum,1<<(bits-1),maximum],matrix=[kr,kb,maximum,0])
        else:
            values=p.video_channels(frame)
            image=_rgba(values,ratio)
            if 'f16' in name:image=image.astype('<f2');encoding='rgba16float';bits=16
            else:encoding='rgba32float'
            info.update(encoding=encoding,source_bits=bits)
        if alpha:info['channels'].append(p.ALPHA)
    else:
        item=source/metadata['files'][index] if metadata['kind']=='sequence' else source
        header=io.image_info(item)
        values=io.read_image(item,input_space='raw',working_space='raw',associate_alpha=False)
        info['channels']=list(values);info['bbox']=header['bbox']
        image=_rgba(values,ratio)
        dtype=header['dtype'].lower()
        if 'uint8' in dtype or 'uint16' in dtype:
            bits=8 if 'uint8' in dtype else 16;maximum=(1<<bits)-1
            image=np.rint(image*maximum).astype('<u2')
            info.update(encoding='rgba16uint',source_bits=bits,decode=1,matrix=[0,0,maximum,0])
        elif 'half' in dtype or 'float16' in dtype:
            image=image.astype('<f2');info.update(encoding='rgba16float',source_bits=16)
        else:info.update(encoding='rgba32float',source_bits=32)
        if plane!='rgba':
            if plane not in values:raise ValueError('Channel is absent.')
            gray=values[plane][::-1][::ratio,::ratio]
            image=np.ones((*gray.shape,4),'<f4');image[...,:3]=gray[...,None]
            info.update(encoding='rgba32float',decode=0,source_bits=32,data=True)
    info.update(width=image.shape[1],height=image.shape[0],bytes_per_pixel=image.dtype.itemsize*4)
    return info,np.ascontiguousarray(image)


def _rgba(values,ratio):
    first=next(iter(values.values()))[::-1][::ratio,::ratio]
    image=np.ones((*first.shape,4),'<f4')
    for component,name in enumerate((*p.RGB,p.ALPHA)):
        if name in values:image[...,component]=values[name][::-1][::ratio,::ratio]
        elif component<3:image[...,component]=0
    return image


class ViewerCache:
    def __init__(self,root,budget=32*1024**3):
        self.root=Path(root);self.root.mkdir(parents=True,exist_ok=True)
        self.budget=budget;self.lock=threading.RLock();self.entries=OrderedDict();self.bytes=0
        self.locks={};self.loading={}
        for path in sorted(self.root.glob('*/*.json'),key=lambda p:p.stat().st_mtime_ns):
            binary=path.with_suffix('.bin')
            if binary.exists():
                self.entries[(path.parent.name,int(path.stem))]=(path,binary.stat().st_size)
                self.bytes+=binary.stat().st_size

    def key(self,source,metadata,ratio,plane='rgba'):
        if ratio not in RATIOS:raise ValueError('Choose 1:1, 1:2, 1:4, 1:8 or 1:64 resolution.')
        source=Path(source);stamp=source.stat()
        identity=[str(source.resolve()),stamp.st_size,stamp.st_mtime_ns,ratio,plane]
        if metadata['kind']=='sequence':
            identity.extend((name,(source/name).stat().st_size,(source/name).stat().st_mtime_ns) for name in metadata['files'])
        return hashlib.sha256(json.dumps(['native-scanline-v1',identity]).encode()).hexdigest()

    def state(self,key,count):
        with self.lock:
            complete=[index for scope,index in self.entries if scope==key]
            return {'key':key,'frames':count,'ready':ranges(complete),
                    'loading':{str(i):value for (scope,i),value in self.loading.items() if scope==key},
                    'precision':'native','bytes':sum(size for (scope,_),(_,size) in self.entries.items() if scope==key)}

    def bands(self,source,metadata,index,ratio,decoders,cancel,plane='rgba',band_height=32):
        if type(index) is not int or not 0<=index<metadata['frames']:raise ValueError('Frame is outside the source range.')
        key=self.key(source,metadata,ratio,plane);identity=(key,index)
        with self.lock:ownership=self.locks.setdefault(identity,threading.Lock())
        while not ownership.acquire(timeout=.05):
            if cancel.is_set():raise InterruptedError('Viewer request superseded.')
        temporary=None;mapped=None
        try:
            if cancel.is_set():raise InterruptedError('Viewer request superseded.')
            with self.lock:
                saved=self.entries.get(identity)
                if saved:self.entries.move_to_end(identity)
            if saved:
                path,_=saved;header=json.loads(path.read_text())
                dtype={'rgba16uint':'<u2','rgba16float':'<f2','rgba32float':'<f4'}[header['encoding']]
                mapped=np.memmap(path.with_suffix('.bin'),mode='r',dtype=dtype,shape=(header['height'],header['width'],4))
                image=mapped;hit=True
            else:
                header,image=pack(source,metadata,index,ratio,decoders,plane);hit=False
                directory=self.root/key;directory.mkdir(parents=True,exist_ok=True)
                temporary=directory/f'.{uuid.uuid4().hex}.bin'
            header={**header,'key':key,'cached':hit}
            yield 'start',header,None
            stream=temporary.open('wb') if temporary else None
            try:
                for y in range(0,header['height'],band_height):
                    if cancel.is_set():raise InterruptedError('Viewer request superseded.')
                    block=np.array(image[y:y+band_height],copy=True,order='C');rows=block.shape[0]
                    if stream:
                        # The commit/coverage contract is scanline-based. Wire
                        # notifications batch rows to avoid one HTTP write/pixel row.
                        for row in block:stream.write(row.tobytes())
                    with self.lock:self.loading[identity]={'rows':y+rows,'height':header['height']}
                    yield 'band',{'x':0,'y':y,'width':header['width'],'height':rows,
                        'completed_rows':y+rows,'total_rows':header['height'],'cached':hit,'encoding':header['encoding'],
                        'bytes_per_pixel':header['bytes_per_pixel']},block
            finally:
                if stream:stream.close()
            if cancel.is_set():raise InterruptedError('Viewer request superseded.')
            if temporary:
                path=self.root/key/f'{index:08d}.json';binary=path.with_suffix('.bin')
                temporary.replace(binary);temporary=None
                from .projects import write
                write(path,header)
                with self.lock:
                    self.entries[identity]=(path,binary.stat().st_size);self.bytes+=binary.stat().st_size
                    while self.bytes>self.budget and len(self.entries)>1:
                        previous,(old,size)=next(iter(self.entries.items()))
                        if previous==identity or previous in self.loading:break
                        try:old.with_suffix('.bin').unlink(missing_ok=True);old.unlink(missing_ok=True)
                        except OSError:break
                        self.entries.pop(previous);self.bytes-=size
            yield 'done',{'frame':index,'key':key,'cached':hit,'committed':True},None
        finally:
            if mapped is not None:mapped._mmap.close()
            if temporary:temporary.unlink(missing_ok=True)
            with self.lock:self.loading.pop(identity,None)
            ownership.release()


def rgba_float(block,header):
    values=block.astype(np.float32)
    maximum=header['matrix'][2]
    if header['decode']==1:values/=maximum
    elif header['decode']==2:
        offset,scale,center,span=header['code_range'];kr,kb,_,_=header['matrix'];kg=1-kr-kb
        y=(values[...,0]-offset)/scale;u=(values[...,1]-center)/span;v=(values[...,2]-center)/span
        values[...,0]=y+(2-2*kr)*v
        values[...,1]=y-kb*(2-2*kb)/kg*u-kr*(2-2*kr)/kg*v
        values[...,2]=y+(2-2*kb)*u;values[...,3]/=maximum
    return {name:values[::-1,:,i] for i,name in enumerate((*p.RGB,p.ALPHA))}
