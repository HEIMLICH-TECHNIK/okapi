"""Color-managed presentation caches for native browser video playback.

These are explicitly display caches. Original frames, pixel probes and Write
masters continue through the independent float/scanline pipeline.
"""
from pathlib import Path
from fractions import Fraction
import hashlib
import json
import platform
import threading
import uuid

import av
import numpy as np
from scipy.ndimage import zoom
from . import pipeline as p
from . import color as cm
from .bands import BandEngine
from .cache_settings import QUALITIES


def size(width,height,maximum):
    scale=min(1,maximum/width,maximum/height)
    return max(2,int(width*scale)//2*2),max(2,int(height*scale)//2*2)


def resize_planes(values,width,height):
    before=next(iter(values.values())).shape
    if before==(height,width):return values
    return {k:zoom(v,(height/before[0],width/before[1]),order=1,prefilter=False).astype(np.float32) for k,v in values.items()}


def source_frames(source,metadata,width,height,start=0):
    if metadata['kind']=='video':
        options={}
        if platform.system()=='Darwin' and 'videotoolbox' in av.codec.hwaccel.hwdevices_available():
            options['hwaccel']=av.codec.hwaccel.HWAccel('videotoolbox',allow_software_fallback=True)
        with av.open(str(source),**options) as container:
            stream=container.streams.video[0];stream.codec_context.thread_count=4
            timestamps=metadata.get('timestamps',[])
            indexed=len(timestamps)==metadata['frames'] and all(v is not None for v in timestamps)
            lookup={v:i for i,v in enumerate(timestamps)} if indexed else {}
            if start and indexed:container.seek(timestamps[start],stream=stream,backward=True)
            for ordinal,frame in enumerate(container.decode(stream)):
                index=lookup.get(frame.pts,ordinal)
                if index<start:continue
                if (frame.width,frame.height)!=(metadata['width'],metadata['height']):raise ValueError('Video dimensions changed within the clip.')
                # Floating-point inputs bypass libswscale's half-float clipping.
                floating='f16' in frame.format.name or 'f32' in frame.format.name
                alpha=any(c.is_alpha for c in frame.format.components)
                if not floating and not alpha:
                    frame=frame.reformat(width=width,height=height,format='gbrpf32le')
                values=p.video_channels(frame)
                yield resize_planes(values,width,height)
    else:
        for index in range(start,metadata['frames']):
            yield resize_planes(p.raw_source_frame(source,metadata,index),width,height)


def cached_frames(source,metadata,width,height,cache=None):
    key=cache.key(source,metadata,width,height) if cache else None
    decoder=None
    try:
        for index in range(metadata['frames']):
            values=cache.get(key,index) if cache else None
            if values is not None:
                if decoder is not None:decoder.close();decoder=None
            else:
                if decoder is None:decoder=source_frames(source,metadata,width,height,start=index)
                try:values=next(decoder)
                except StopIteration:raise ValueError('Playback source frame count changed.')
                if cache:cache.put(key,index,values)
            yield values
    finally:
        if decoder is not None:decoder.close()


def display_bands(raw,color,*,display,view,exposure,channel,cancel):
    engine=BandEngine(raw,color)
    result=np.empty((engine.height,engine.width,4),np.float32)
    for band in engine.evaluate_progressive(band_height=64,cancel_event=cancel):
        x0,y0,x1,y1=band['rect']
        result[engine.height-y1:engine.height-y0]=p.display_pixels(band['channels'],color['working_space'],
            display=display,view=view,exposure=exposure,mode='sdr',config_name=color.get('config'),channel=channel,origin=(x0,y0))
    return result


def build(source,metadata,color,target,*,display,view,exposure=0,maximum=1920,codec='h264',
          cancel=None,progress=lambda _:None,encoder=None,channel='rgba',hdr=False,comparison=None,raw_cache=None,quality='high'):
    cancel=cancel or threading.Event()
    if quality not in QUALITIES:raise ValueError('Unknown preview quality.')
    encoding=QUALITIES[quality]
    width,height=size(metadata['width'],metadata['height'],maximum)
    if codec not in ('h264','hevc'):raise ValueError('Unsupported presentation codec.')
    if hdr and codec!='hevc':raise ValueError('Native HDR playback requires a supported 10bit HEVC decoder.')
    if encoder is None:
        hardware=platform.system()=='Darwin'
        encoder=('hevc_videotoolbox' if codec=='hevc' else 'h264_videotoolbox') if hardware else ('libx265' if codec=='hevc' else 'libx264')
    target=Path(target);target.parent.mkdir(parents=True,exist_ok=True)
    temporary=target.with_name(f'.{uuid.uuid4().hex}.mp4')
    count=0
    try:
        with av.open(str(temporary),'w',options={'movflags':'+faststart+write_colr'}) as output:
            stream=output.add_stream(encoder,rate=Fraction(metadata['fps_rational']))
            stream.width,stream.height=width,height
            stream.pix_fmt='p010le' if codec=='hevc' and 'videotoolbox' in encoder else 'yuv420p10le' if codec=='hevc' else 'yuv420p'
            stream.codec_context.thread_count=4
            stream.codec_context.gop_size=max(1,round(metadata['fps']/2))
            primaries=12 if 'P3' in display else 9 if hdr else 1
            transfer=18 if hdr and 'HLG' in display else 16 if hdr else 13
            matrix=9 if hdr else 1
            stream.codec_context.color_primaries=primaries;stream.codec_context.color_trc=transfer
            stream.codec_context.colorspace=matrix;stream.codec_context.color_range=1
            if 'videotoolbox' in encoder:
                stream.bit_rate=int(max(1_000_000,min(400_000_000,encoding['mbps']*1_000_000*width*height/(1920*1080)*metadata['fps']/24*(1.25 if codec=='hevc' else 1))))
                stream.options={'allow_sw':'1','realtime':'0'}
            else:
                stream.options={'preset':'fast','crf':str(encoding['crf'])}
                if codec=='hevc':stream.options['x265-params']='log-level=error:pools=4'
            if codec=='hevc':stream.codec_context.codec_tag='hvc1'
            timestamps=metadata.get('timestamps',[])
            if metadata.get('time_base'):
                stream.time_base=Fraction(metadata['time_base']);stream.codec_context.time_base=Fraction(metadata['time_base'])
            for count,raw in enumerate(cached_frames(source,metadata,width,height,raw_cache),start=1):
                if cancel.is_set():raise InterruptedError('Playback cache cancelled.')
                rgba=display_bands(raw,color,display=display,view=view,exposure=exposure,channel=channel,cancel=cancel)
                if comparison is not None:
                    values=p.io.read_image(Path(comparison)/f'{count-1:08d}.exr',input_space='raw',working_space='raw')
                    values=resize_planes(values,width,height)
                    right=p.display_pixels(values,color['working_space'],display=display,view=view,
                        exposure=exposure,mode='sdr',config_name=color.get('config'),channel=channel)
                    rgba[:,width//2:]=right[:,width//2:]
                # Only the presentation cache is quantized. The master and
                # frame-stream APIs never consume this encoded display copy.
                rgb=rgba[...,:3]
                np.nan_to_num(rgb,copy=False,nan=0,posinf=1,neginf=0);np.clip(rgb,0,1,out=rgb)
                bits=65535 if codec=='hevc' else 255
                packed=np.rint(rgb*bits).astype('<u2' if codec=='hevc' else 'u1')
                frame=av.VideoFrame.from_ndarray(packed,format='rgb48le' if codec=='hevc' else 'rgb24').reformat(
                    format=stream.pix_fmt,dst_colorspace='BT2020' if hdr else 'ITU709',dst_color_range='MPEG')
                frame.color_primaries=primaries;frame.color_trc=transfer;frame.colorspace=matrix;frame.color_range=1
                if len(timestamps)==metadata['frames'] and all(v is not None for v in timestamps):
                    frame.pts=timestamps[count-1]-timestamps[0];frame.time_base=Fraction(metadata['time_base'])
                else:
                    frame.pts=count-1;frame.time_base=1/Fraction(metadata['fps_rational'])
                for packet in stream.encode(frame):output.mux(packet)
                progress(count)
            for packet in stream.encode():output.mux(packet)
        if count!=metadata['frames']:raise ValueError('Playback cache frame count changed.')
        if cancel.is_set():raise InterruptedError('Playback cache cancelled.')
        # Parse the completed container before publishing its readiness marker.
        with av.open(str(temporary)) as check:
            if not check.streams.video:raise ValueError('Playback cache has no video stream.')
        temporary.replace(target)
        return {'frames':count,'width':width,'height':height,'codec':codec,'encoder':encoder,
                'quality':quality,'presentation_bits':10 if codec=='hevc' else 8,'source_width':metadata['width'],
                'source_height':metadata['height'],'display':display,'view':view,
                'source_unchanged':True,'hdr':hdr,'bytes':target.stat().st_size,
                'raw_cache':{'hits':raw_cache.hits,'bytes':raw_cache.bytes} if raw_cache else None}
    except av.error.FFmpegError:
        if 'videotoolbox' in encoder:
            return build(source,metadata,color,target,display=display,view=view,exposure=exposure,
                maximum=maximum,codec=codec,cancel=cancel,progress=progress,encoder='libx265' if codec=='hevc' else 'libx264',channel=channel,hdr=hdr,comparison=comparison,raw_cache=raw_cache,quality=quality)
        raise
    finally:
        temporary.unlink(missing_ok=True)
