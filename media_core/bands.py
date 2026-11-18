"""Top-to-bottom ROI evaluation and portable scanline output.

Coordinates are bottom-up, half-open, matching nuke-REA's Row contract. A band
requests its accumulated blur halo; only its completed center is published.
"""
from dataclasses import dataclass
from pathlib import Path
import uuid
import numpy as np
from . import pipeline as p
from . import image_io as io


class EngineCancelled(InterruptedError):pass


@dataclass(frozen=True)
class ImageInfo:
    format:tuple
    channels:tuple


class BandEngine:
    def __init__(self,raw,color,settings=None):
        self.raw=raw;self.color=color;self.settings=settings or {'operations':[]}
        self.height,self.width=next(iter(raw.values())).shape
        self.info=ImageInfo((self.width,self.height),tuple(raw))
        params=self.settings.get('parameters',[])
        self.halo=sum((params[i] if params else self.settings).get('blur_radius',3)
            for i,op in enumerate(self.settings['operations']) if op=='blur')
        self.completed=0

    def stats(self):return {'completed_rows':self.completed,'total_rows':self.height}

    def evaluate_progressive(self,*,band_height=64,cancel_event=None):
        if type(band_height) is not int or not 1<=band_height<=512:raise ValueError('Invalid band height.')
        for top in range(0,self.height,band_height):
            if cancel_event is not None and cancel_event.is_set():raise EngineCancelled('Frame request cancelled.')
            y1=self.height-top;y0=max(0,y1-band_height)
            lower=max(0,y0-self.halo);upper=min(self.height,y1+self.halo)
            source={name:plane[lower:upper] for name,plane in self.raw.items()}
            values=p.convert(source,self.color['input_space'],self.color['working_space'],self.color['alpha_mode'],self.color.get('config'))
            values=p.operations(values,self.settings)
            values={name:plane[y0-lower:y1-lower] for name,plane in values.items()}
            self.completed=top+y1-y0
            yield {'rect':(0,y0,self.width,y1),'channels':values,
                   'completed_rows':self.completed,'total_rows':self.height}


def write_exr(engine,path,*,working_space,origin=(0,0),full_size=None,full_origin=(0,0),cancel_event=None):
    target=Path(path);target.parent.mkdir(parents=True,exist_ok=True)
    temporary=target.with_name(f'.{uuid.uuid4().hex}.exr')
    width,height=engine.info.format;full_size=full_size or (width,height)
    names=tuple(engine.info.channels);oiio=io._oiio()
    spec=oiio.ImageSpec(width,height,len(names),'float')
    spec.channelnames=[io._file_channel(n) for n in names]
    spec.x=full_origin[0]+origin[0];spec.y=full_origin[1]+full_size[1]-origin[1]-height
    spec.full_x,spec.full_y=full_origin;spec.full_width,spec.full_height=full_size
    spec.attribute('compression','zip');spec.attribute('oiio:ColorSpace',working_space)
    if p.ALPHA in names:spec.alpha_channel=names.index(p.ALPHA)
    if 'depth.Z' in names:spec.z_channel=names.index('depth.Z')
    writer=oiio.ImageOutput.create(str(temporary))
    try:
        if writer is None or not writer.open(str(temporary),spec):raise OSError('Cannot open float EXR output.')
        rows=0
        for band in engine.evaluate_progressive(band_height=64,cancel_event=cancel_event):
            _,y0,_,y1=band['rect'];top=height-y1
            if top!=rows:raise ValueError('Output bands must cover each row once, top to bottom.')
            pixels=np.stack([band['channels'][n][::-1] for n in names],axis=-1)
            if not writer.write_scanlines(spec.y+top,spec.y+top+y1-y0,0,pixels):raise OSError(writer.geterror())
            rows+=y1-y0
        if rows!=height:raise ValueError('Incomplete EXR frame.')
        if writer.close() is False:raise OSError(writer.geterror())
        writer=None
        if cancel_event is not None and cancel_event.is_set():raise EngineCancelled('Output cancelled.')
        temporary.replace(target)
    finally:
        if writer is not None:writer.close()
        temporary.unlink(missing_ok=True)
