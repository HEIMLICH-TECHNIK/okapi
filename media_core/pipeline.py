"""Portable float32 media pipeline. Source files and display pixels are separate.

Image channels follow image_io's bottom-up planar convention. Video decoding
uses float RGB planes (no RGB8 intermediate); OCIO handles the transfer function
separately from libswscale's YUV matrix/range conversion.
"""
from functools import lru_cache
from fractions import Fraction
import hashlib
import json
import math
import re
from pathlib import Path
import threading
import uuid
import zipfile

import av
import numpy as np
import PyOpenColorIO as ocio
from scipy.ndimage import gaussian_filter

from . import image_io as io
from . import color as cm

CONFIG = 'studio-config-v2.2.0_aces-v1.3_ocio-v2.4'
RGB = ('rgba.red', 'rgba.green', 'rgba.blue')
ALPHA = 'rgba.alpha'
IMAGES = {'.exr', '.png', '.jpg', '.jpeg', '.tif', '.tiff'}
VIDEOS = {'.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi'}
MAX_PIXELS = 8192 * 8192
CONFIG_LOCK = threading.Lock()


def config(name=None):
    return cm.config(name)


def config_path(cache, config_name=None):
    """An immutable, content-addressed config, also usable by imported IO code."""
    text = cm.materialize(config_name)
    digest = hashlib.sha256(text.encode()).hexdigest()
    path = Path(cache) / f'{digest}.ocio'
    with CONFIG_LOCK:
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            temporary = path.with_suffix('.tmp')
            temporary.write_text(text)
            temporary.replace(path)
    return str(path)


def capabilities(config_name=None):
    c = config(config_name)
    profiles = {}
    try:
        encoder = av.Codec('prores_ks', 'w')
        profiles = {'422hq': {'pixel_format': 'yuv422p10le', 'rgb_bits': 10, 'alpha': False},
                    '4444': {'pixel_format': 'yuva444p10le', 'rgb_bits': 10, 'alpha': True},
                    '4444xq': {'pixel_format': 'yuva444p10le', 'rgb_bits': 10, 'alpha': True}}
        if 'yuva444p10le' not in {p.name for p in encoder.video_formats}:
            profiles = {k:v for k,v in profiles.items() if not v['alpha']}
    except av.error.FFmpegError:
        pass
    return {'config': config_name or cm.default_id(), 'configs':list(cm.registered().values()), 'ocio_version': ocio.__version__,
            'config_sha256': hashlib.sha256(c.serialize().encode()).hexdigest(),
            'spaces': list(c.getColorSpaceNames()),
            'displays': {d:list(c.getViews(d)) for d in c.getDisplays()},
            'working_default': c.getRoleColorSpace(ocio.ROLE_SCENE_LINEAR), 'roles':dict(c.getRoles()),
            'default_display':c.getDefaultDisplay(),'default_view':c.getDefaultView(c.getDefaultDisplay()), 'processing_dtype': 'float32',
            'image_storage': ['half', 'float', 'uint16', 'uint8'],
            'prores_profiles': profiles, 'float_video_codec': 'ffv1', 'float_video_storage':['half','float'],
            'model_boundary': 'Alpha Gen uses a separate SDR 8bit model path; explicit conversion required.'}


def dimensions(width, height):
    if width < 1 or height < 1 or max(width,height)>8192 or width * height > MAX_PIXELS:
        raise ValueError('Media must be at most 8192 × 8192 pixels in area.')


def inspect(path):
    path = Path(path)
    if path.suffix.lower() in IMAGES:
        info = io.image_info(path)
        dimensions(info['width'], info['height'])
        if info.get('deep'):
            raise ValueError('Deep EXR is not supported.')
        return {'kind':'image', 'width':info['width'], 'height':info['height'],
                'frames':1, 'fps':24.0, 'fps_rational':'24/1', 'first_frame':0,
                'alpha_mode':'straight' if path.suffix.lower() in {'.png','.jpg','.jpeg'} or info.get('unassociated_alpha') else 'premultiplied',
                'source':info, 'input_space':image_space(info, path)}
    if path.suffix.lower() not in VIDEOS:
        raise ValueError('Unsupported media format.')
    with av.open(str(path)) as container:
        if not container.streams.video:
            raise ValueError('The file has no video stream.')
        stream = container.streams.video[0]
        ctx = stream.codec_context
        dimensions(ctx.width, ctx.height)
        fps = stream.average_rate
        if not fps or not 0 < fps <= 240:
            raise ValueError('A valid video frame rate up to 240 fps is required.')
        # Trust a complete one-packet/one-frame container index only when its
        # unique presentation timestamps agree with the declared frame count.
        # Other containers get an exact decode index, without a guessed CFR seek.
        packet_pts=[]
        if stream.frames:
            packet_pts=[packet.pts for packet in container.demux(stream) if packet.size and packet.pts is not None]
        indexed=bool(stream.frames and len(packet_pts)==stream.frames and len(set(packet_pts))==stream.frames and ctx.format is not None)
        if indexed:
            timestamps=sorted(packet_pts);frames=len(timestamps)
        else:
            container.seek(stream.start_time or 0,stream=stream,backward=True)
            frames=0;timestamps=[]
            ctx.thread_count=4
            for frame in container.decode(stream):
                if (frame.width,frame.height)!=(ctx.width,ctx.height):raise ValueError('Variable frame dimensions are not supported.')
                frames+=1;timestamps.append(frame.pts)
        if not frames:
            raise ValueError('The video has no decodable frames.')
        source = {'codec':ctx.name, 'pixel_format':ctx.format.name,
                  'primaries':int(ctx.color_primaries), 'transfer':int(ctx.color_trc),
                  'matrix':int(ctx.colorspace), 'range':int(ctx.color_range),
                  'audio_streams':len(container.streams.audio),
                  'metadata':dict(stream.metadata)}
        tagged_space = {k.lower():v for k,v in stream.metadata.items()}.get('okapi_colorspace')
        input_space = tagged_space if tagged_space in config().getColorSpaceNames() else None
        if not input_space:
            if source['transfer'] == 16 and source['primaries'] == 9:
                input_space = cm.canonical('Rec.2100-PQ - Display') or cm.canonical('st2084')
            elif source['transfer'] == 18 and source['primaries'] == 9:
                input_space = cm.canonical('Rec.2100-HLG - Display') or cm.canonical('HybridLogGamma')
            elif source['transfer'] == 1 and source['primaries'] == 1:
                input_space = cm.canonical('Camera Rec.709') or cm.canonical('rec709')
            elif source['transfer'] == 13 and source['primaries'] == 1:
                input_space = cm.canonical('sRGB Encoded Rec.709 (sRGB)') or cm.canonical('sRGB')
        return {'kind':'video', 'width':ctx.width, 'height':ctx.height, 'frames':frames,
                'fps':float(fps), 'fps_rational':str(fps), 'first_frame':0,
                'alpha_mode':'straight',
                'index_source':'container' if indexed else 'decoded',
                'time_base':str(stream.time_base), 'timestamps':timestamps,
                'source':source, 'input_space':input_space}


def inspect_sequence(directory, filenames, fps='24'):
    """A contiguous numbered sequence; frame numbers never depend on upload order."""
    numbered=[]
    for filename in filenames:
        match=re.fullmatch(r'(.*?)(\d+)(\.[^.]+)',filename)
        if not match or Path(filename).suffix.lower() not in IMAGES:
            raise ValueError('Select numbered image files from one sequence.')
        numbered.append((int(match[2]),filename,match[1],match[3].lower()))
    numbered.sort()
    if len({(v[2],v[3]) for v in numbered})!=1 or any(b[0]!=a[0]+1 for a,b in zip(numbered,numbered[1:])):
        raise ValueError('Image sequence names must share one prefix and consecutive frame numbers.')
    first=inspect(Path(directory)/numbered[0][1])
    for _,name,_,_ in numbered[1:]:
        current=inspect(Path(directory)/name)
        if (current['width'],current['height'],current['source']['channels'],current['input_space'])!=(first['width'],first['height'],first['source']['channels'],first['input_space']):
            raise ValueError('Sequence format, channels and input color space must match.')
    rate=Fraction(fps)
    if not 0<rate<=240: raise ValueError('Sequence FPS must be between 0 and 240.')
    first.update(kind='sequence',frames=len(numbered),first_frame=numbered[0][0],
                 files=[v[1] for v in numbered],fps=float(rate),fps_rational=str(rate))
    return first


def image_space(info, path):
    value = info.get('color_space', '')
    aliases = {'linear':'Linear Rec.709 (sRGB)', 'sRGB':'sRGB Encoded Rec.709 (sRGB)',
               'lin_rec709_scene':'Linear Rec.709 (sRGB)', 'acescg':'ACEScg'}
    value = value if cm.canonical(value) else aliases.get(value, value)
    space=config().getColorSpace(value) if value else None
    if space is not None:
        return space.getName()
    if Path(path).suffix.lower() in {'.png', '.jpg', '.jpeg'}:
        return cm.canonical('sRGB Encoded Rec.709 (sRGB)') or cm.canonical('sRGB')
    # Untagged EXR/TIFF needs an explicit interpretation; never assume ACEScg.
    return None


def settings(data, metadata):
    name=data.get('config') or cm.default_id()
    result = {'config':name, 'input_space':data.get('input_space') or metadata.get('input_space'),
              'working_space':data.get('working_space',config(name).getRoleColorSpace(ocio.ROLE_SCENE_LINEAR)),
              'alpha_mode':data.get('alpha_mode',metadata.get('alpha_mode','premultiplied' if metadata['kind']=='image' else 'straight'))}
    result['config_sha256']=cm.fingerprint(name)
    spaces = set(config(name).getColorSpaceNames())
    for key in ('input_space', 'working_space'):
        value=cm.canonical(result[key],name)
        if value is None:
            raise ValueError(f'Choose an explicit {key.replace("_", " ")} before viewing or rendering.')
        result[key]=value
    if result['alpha_mode'] not in ('straight', 'premultiplied', 'data'):
        raise ValueError('Alpha mode must be straight, premultiplied or data.')
    if result['alpha_mode']=='data' and not config(name).getColorSpace(result['input_space']).isData():
        raise ValueError('Data passes require Raw input and working spaces.')
    if config(name).getColorSpace(result['input_space']).isData() and not config(name).getColorSpace(result['working_space']).isData():
        raise ValueError('Raw data must use Raw working space; no RGB transform is applied.')
    return result


def video_channels(frame):
    native=frame.format.name
    if native in ('gbrpf16le','gbrpf32le','gbrapf16le','gbrapf32le'):
        # libswscale may clamp half-float RGB to 0–1 during format conversion.
        # Read native planes directly so negative/HDR values remain intact.
        dtype='<f2' if 'f16' in native else '<f4'
        size=np.dtype(dtype).itemsize
        names=(RGB[1],RGB[2],RGB[0],ALPHA) if 'gbrap' in native else (RGB[1],RGB[2],RGB[0])
        return {name:np.frombuffer(plane,dtype=dtype).reshape(frame.height,plane.line_size//size)
                [:,:frame.width][::-1].astype(np.float32,copy=True) for name,plane in zip(names,frame.planes)}
    if native in ('grayf16le','grayf32le'):
        dtype='<f2' if 'f16' in native else '<f4'
        plane=frame.planes[0]
        value=np.frombuffer(plane,dtype=dtype).reshape(frame.height,plane.line_size//np.dtype(dtype).itemsize)[:,:frame.width][::-1].astype(np.float32)
        return {name:value.copy() for name in RGB}
    if 'f16' in native or 'f32' in native:
        raise ValueError(f'Float video format {native} requires an explicit decoder adapter; no clipped conversion was performed.')
    has_alpha = frame.format.has_palette is False and any(c.is_alpha for c in frame.format.components)
    frame = frame.reformat(format='gbrapf32le' if has_alpha else 'gbrpf32le')
    names = (RGB[1], RGB[2], RGB[0], ALPHA) if has_alpha else (RGB[1], RGB[2], RGB[0])
    return {name:np.frombuffer(plane, dtype='<f4').reshape(frame.height, plane.line_size//4)
            [:,:frame.width][::-1].copy() for name,plane in zip(names,frame.planes)}


def convert(channels, source, target, alpha_mode='premultiplied', config_name=None):
    channels = {k:np.array(v, np.float32, copy=True) for k,v in channels.items()}
    if (source == target or config(config_name).getColorSpace(source).isData()) and alpha_mode != 'straight':
        return channels
    if not all(k in channels for k in RGB):
        return channels
    rgb = np.stack([channels[k] for k in RGB], axis=-1)
    alpha = channels.get(ALPHA)
    if alpha_mode == 'premultiplied' and alpha is not None:
        rgb = np.divide(rgb, alpha[...,None], out=rgb.copy(), where=alpha[...,None]!=0)
    if source != target and not config(config_name).getColorSpace(source).isData():
        config(config_name).getProcessor(source,target).getDefaultCPUProcessor().applyRGB(rgb)
    if alpha_mode != 'data' and alpha is not None:
        rgb = np.where(alpha[...,None]!=0, rgb*alpha[...,None], rgb)
    for i,k in enumerate(RGB): channels[k]=rgb[...,i]
    return channels


def raw_source_frame(path,metadata,index,*,decoders=None,data_window=False):
    if type(index) is not int or not 0<=index<metadata['frames']:
        raise ValueError('Frame is outside the source range.')
    if metadata['kind'] in ('image','sequence'):
        item=Path(path)/metadata['files'][index] if metadata['kind']=='sequence' else Path(path)
        header=io.image_info(item)
        return io.read_image(item,input_space='raw',working_space='raw',associate_alpha=False,
                             roi=header['bbox'] if data_window else None)
    if decoders is not None:return decoders.raw(path,metadata,index)
    from .video import FrameStore
    store=FrameStore()
    try:return store.raw(path,metadata,index)
    finally:store.close()


def iter_source_raw(path,metadata,*,data_window=False):
    if metadata['kind'] in ('image','sequence'):
        for index in range(metadata['frames']):yield raw_source_frame(path,metadata,index,data_window=data_window)
    else:
        with av.open(str(path)) as container:
            container.streams.video[0].codec_context.thread_count=4
            for frame in container.decode(video=0):
                if (frame.width,frame.height)!=(metadata['width'],metadata['height']):raise ValueError('Video dimensions changed within the clip.')
                yield video_channels(frame)


def iter_source(path,metadata,color,cache,*,data_window=False):
    for values in iter_source_raw(path,metadata,data_window=data_window):
        yield convert(values,color['input_space'],color['working_space'],color['alpha_mode'],color.get('config'))


def source_frame(path,metadata,color,index,cache,*,decoders=None):
    raw=raw_source_frame(path,metadata,index,decoders=decoders)
    return convert(raw,color['input_space'],color['working_space'],color['alpha_mode'],color.get('config'))


def operations(channels, spec):
    out = dict(channels)
    for index, op in enumerate(spec.get('operations', [])):
        if op == 'alpha_gen':
            raise ValueError('Alpha Gen has an SDR 8bit model boundary. It cannot run in the float media path yet.')
        params = spec.get('parameters', [])
        radius = (params[index] if params else spec).get('blur_radius',3)
        for name in RGB:
            if name not in out: continue
            if op=='invert': out[name] = np.float32(1)-out[name]
            elif op=='flip': out[name] = out[name][:,::-1].copy()
            elif op=='blur': out[name] = gaussian_filter(out[name],sigma=1,radius=radius,mode='nearest')
            else: raise ValueError(f'Unsupported float operation: {op}')
        if op=='flip':
            for name in set(out)-set(RGB): out[name]=out[name][:,::-1].copy()
        elif op=='blur' and ALPHA in out:
            out[ALPHA]=gaussian_filter(out[ALPHA],sigma=1,radius=radius,mode='nearest')
    return out


def display_pixels(channels, working, *, mode='sdr', channel='rgba', exposure=0, checker=True, display=None, view=None, config_name=None, origin=(0,0)):
    if not math.isfinite(exposure) or not -30 <= exposure <= 30:
        raise ValueError('Exposure must be between -30 and +30 stops.')
    shape = next(iter(channels.values())).shape
    if channel!='rgba':
        if channel not in channels: raise ValueError('Channel is absent.')
        rgb = np.repeat(channels[channel][...,None],3,axis=-1).copy()
    else:
        rgb = np.stack([channels.get(k,np.zeros(shape,np.float32)) for k in RGB],axis=-1)
    rgb *= np.float32(2**exposure)
    alpha = channels.get(ALPHA)
    if checker and channel=='rgba' and alpha is not None:
        y,x = np.indices(shape);x+=origin[0];y+=origin[1]
        board = np.where(((x//12+y//12)%2)[...,None],0.05,0.13)
        rgb += board * (1-np.clip(alpha[...,None],0,1))
    cfg=config(config_name)
    if channel=='rgba' and not cfg.getColorSpace(working).isData():
        if display is None:
            fallback='sRGB - Display' if mode=='sdr' else 'ST2084-P3-D65 - Display'
            display=fallback if fallback in cfg.getDisplays() else cfg.getDefaultDisplay()
        if view is None:
            view=cfg.getDefaultView(display)
        cm.view_transform(working,display,view,config_name).applyRGB(rgb)
        if mode=='hdr':
            # Convert the selected HDR display encoding to P3/PQ using the same
            # project config before presenting it through browser extended P3.
            target='ST2084-P3-D65 - Display'
            selected=cfg.getDisplayViewColorSpaceName(display,view)
            if selected=='<USE_DISPLAY_NAME>':selected=display
            if cfg.getColorSpace(target) is None:
                raise ValueError('This project config does not define browser HDR presentation. The selected Viewer Process remains available on SDR.')
            if selected!=target:cfg.getProcessor(selected,target).getDefaultCPUProcessor().applyRGB(rgb)
            power=np.maximum(rgb,0)**(1/(2523/32))
            linear=(np.maximum(power-3424/4096,0)/np.maximum(2413/128-2392/128*power,1e-8))**(1/(2610/16384))
            linear*=10000/203
            rgb=np.where(linear<=0.0031308,12.92*linear,1.055*np.maximum(linear,0)**(1/2.4)-0.055)
    rgba = np.ones((*shape,4),np.float32)
    rgba[...,:3] = rgb
    return np.ascontiguousarray(rgba[::-1],dtype='<f4')


def render_frames(source, metadata, color, spec, directory, cache, cancel, progress):
    directory=Path(directory)
    directory.mkdir(parents=True,exist_ok=True)
    cfg=config_path(cache,color.get('config'))
    count=0
    from .bands import BandEngine,write_exr
    for count,channels in enumerate(iter_source_raw(source,metadata,data_window=True),start=1):
        if cancel.is_set(): raise InterruptedError('Render cancelled.')
        engine=BandEngine(channels,color,spec)
        window={}
        if metadata['kind'] in ('image','sequence'):
            item=Path(source)/metadata['files'][count-1] if metadata['kind']=='sequence' else source
            header=io.image_info(item)
            x0,y0,x1,y1=header['bbox']
            if spec['operations'].count('flip')%2:x0=metadata['width']-x1
            window={'origin':(x0,y0),'full_size':(metadata['width'],metadata['height']),
                    'full_origin':tuple(header['native_full_origin'])}
        write_exr(engine,directory/f'{count-1:08d}.exr',working_space=color['working_space'],cancel_event=cancel,**window)
        progress(count)
    if count!=metadata['frames']: raise ValueError('Decoded frame count changed; source may have changed.')
    return {'frames':count,'working_space':color['working_space'],'storage':'float',
            'config':color.get('config',cm.default_id()),'config_sha256':capabilities(color.get('config'))['config_sha256']}


def export_image_frames(paths, target, *, metadata=None, cancel=None):
    target=Path(target)
    temporary=target.with_name(f'.{uuid.uuid4().hex}.zip')
    try:
        with zipfile.ZipFile(temporary,'w',compression=zipfile.ZIP_STORED) as archive:
            first=(metadata or {}).get('source',{}).get('first_frame',0)
            for index,path in enumerate(paths):
                if cancel is not None and cancel.is_set():raise InterruptedError('Export cancelled.')
                archive.write(path,f'{first+index:08d}.exr')
            if metadata:
                archive.writestr('manifest.json',json.dumps(metadata,indent=2))
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)


def video_frame(channels, *, half=False):
    height,width=next(iter(channels.values())).shape
    alpha=ALPHA in channels
    if half and alpha:raise ValueError('Half float video output supports RGB only; use EXR for alpha.')
    frame=av.VideoFrame(width,height,'gbrpf16le' if half else 'gbrapf32le' if alpha else 'gbrpf32le')
    names=(RGB[1],RGB[2],RGB[0],ALPHA) if alpha else (RGB[1],RGB[2],RGB[0])
    for name,plane in zip(names,frame.planes):
        rows=np.zeros((height,plane.line_size//(2 if half else 4)),dtype='<f2' if half else '<f4')
        rows[:,:width]=channels.get(name,np.zeros((height,width),np.float32))[::-1]
        plane.update(rows.tobytes())
    return frame


def export_video(paths, target, metadata, working, *, codec='prores', profile='4444xq', transform='sdr', storage='float', cancel=None, config_name=None):
    """Explicit delivery conversion; float masters stay untouched."""
    if codec not in ('prores','ffv1'): raise ValueError('Choose ProRes or FFV1.')
    if storage not in ('half','float'): raise ValueError('Choose half or float storage.')
    profiles={'422hq':3,'4444':4,'4444xq':5}
    if profile not in profiles: raise ValueError('Unknown ProRes profile.')
    if transform not in ('sdr','pq','hlg'): raise ValueError('Choose SDR, PQ or HLG delivery.')
    if working=='Raw' and codec=='prores': raise ValueError('Data passes require EXR or float FFV1, not ProRes.')
    target=Path(target)
    temporary=target.with_name(f'.{uuid.uuid4().hex}{target.suffix}')
    display={'sdr':'Rec.1886 Rec.709 - Display','pq':'Rec.2100-PQ - Display','hlg':'Rec.2100-HLG - Display'}[transform]
    view='ACES 1.0 - SDR Video' if transform=='sdr' else 'ACES 1.1 - HDR Video (1000 nits & Rec.2020 lim)'
    cfg=config(config_name)
    if codec=='prores' and display not in cfg.getDisplays():
        if transform=='sdr' and cfg.getColorSpace('rec709') is not None:
            # Nuke Default defines Rec.709 as an output colorspace/view.
            display='rec709';view=None
        else:raise ValueError('The project OCIO config does not define this delivery transform.')
    processor=(cfg.getProcessor(working,display).getDefaultCPUProcessor() if view is None else cm.view_transform(working,display,view,config_name)) if codec=='prores' else None
    try:
        with av.open(str(temporary),'w',options={'movflags':'+write_colr'} if codec=='prores' else {}) as container:
            stream=container.add_stream('prores_ks' if codec=='prores' else 'ffv1',rate=Fraction(metadata['fps_rational']))
            stream.width,stream.height=metadata['width'],metadata['height']
            if metadata.get('time_base'):
                stream.time_base=Fraction(metadata['time_base'])
                stream.codec_context.time_base=Fraction(metadata['time_base'])
            stream.pix_fmt=('yuv422p10le' if profile=='422hq' else 'yuva444p10le') if codec=='prores' else 'gbrpf16le' if storage=='half' else 'gbrpf32le'
            if codec=='prores':
                stream.options={'profile':str(profiles[profile]),'alpha_bits':'16'}
                ctx=stream.codec_context
                ctx.color_primaries=1 if transform=='sdr' else 9
                ctx.color_trc={'sdr':1,'pq':16,'hlg':18}[transform]
                ctx.colorspace=1 if transform=='sdr' else 9
                ctx.color_range=1
            else:
                # Float FFV1 requires the version-4 bitstream in this FFmpeg build.
                stream.options={'level':'4','strict':'-2'}
                stream.metadata['okapi_colorspace']=working
            for number,path in enumerate(paths):
                if cancel is not None and cancel.is_set(): raise InterruptedError('Export cancelled.')
                channels=io.read_image(path,input_space='raw',working_space='raw')
                if codec=='prores' and ALPHA in channels:
                    alpha=channels[ALPHA]
                    if not np.isfinite(alpha).all() or (alpha<0).any() or (alpha>1).any():
                        raise ValueError('ProRes alpha must be finite and within 0–1. Use EXR for unrestricted alpha.')
                    if profile=='422hq' and (alpha!=1).any():
                        raise ValueError('ProRes 422 HQ cannot preserve transparency; choose 4444/XQ or EXR.')
                if processor:
                    rgb=np.stack([channels[k] for k in RGB],axis=-1)
                    alpha=channels.get(ALPHA)
                    if alpha is not None:
                        rgb=np.divide(rgb,alpha[...,None],out=rgb.copy(),where=alpha[...,None]!=0)
                    processor.applyRGB(rgb)
                    if not np.isfinite(rgb).all() or (rgb<0).any() or (rgb>1).any():
                        raise ValueError('Delivery contains nonfinite/out-of-range values; choose another output transform.')
                    for i,k in enumerate(RGB): channels[k]=rgb[...,i]
                elif ALPHA in channels:
                    raise ValueError('This FFV1 float encoder does not preserve alpha. Use EXR for RGBA masters.')
                if codec=='ffv1' and storage=='half' and any(np.any(np.isfinite(v)&(np.abs(v)>65504)) for v in channels.values()):
                    raise ValueError('Values exceed half float range; choose float32 video or EXR.')
                frame=video_frame(channels,half=codec=='ffv1' and storage=='half')
                if codec=='prores':
                    frame=frame.reformat(format=stream.pix_fmt,dst_colorspace='ITU709' if transform=='sdr' else 'BT2020',dst_color_range='MPEG')
                    frame.color_primaries=stream.codec_context.color_primaries
                    frame.color_trc=stream.codec_context.color_trc
                    frame.colorspace=stream.codec_context.colorspace
                    frame.color_range=stream.codec_context.color_range
                timestamps=metadata.get('timestamps',[])
                if len(timestamps)==len(paths) and all(v is not None for v in timestamps):
                    frame.pts=timestamps[number]-timestamps[0]
                    frame.time_base=Fraction(metadata['time_base'])
                else:
                    frame.pts=number
                    frame.time_base=1/Fraction(metadata['fps_rational'])
                for packet in stream.encode(frame): container.mux(packet)
            for packet in stream.encode(): container.mux(packet)
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)
    return {'codec':codec,'profile':profile if codec=='prores' else f'{storage} RGB',
            'rgb_bits':10 if codec=='prores' else 16 if storage=='half' else 32,'output_space':display if codec=='prores' else working,
            'audio':'not included','frames':number+1}
