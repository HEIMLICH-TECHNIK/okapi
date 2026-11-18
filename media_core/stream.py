"""Ordered progressive display packets adapted from nuke-REA v0.8.

packet() and _display_bands() retain the original framing and bounded conversion
ordering. Pixels stay float32 instead of the original RGBA8 display payload.
"""
import json
import struct
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from . import pipeline as p
def packet(metadata, payload=b''):
    header = json.dumps(dict(metadata, bytes=len(payload)), separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    return struct.pack('>I', len(header)) + header + payload


def _display_bands(iterator, convert, workers, check_cancel):
    """Bounded conversion pipeline; retain engine band/progress order."""
    if workers == 1:
        for band in iterator:
            check_cancel()
            yield convert(band)
        return
    pending = deque()
    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix='viewer-color') as pool:
        try:
            for band in iterator:
                check_cancel()
                pending.append(pool.submit(convert, band))
                if len(pending) >= workers:
                    yield pending.popleft().result()
            while pending:
                check_cancel()
                yield pending.popleft().result()
        finally:
            for future in pending:
                future.cancel()



def preview_packets(engine,frame,*,display=None,view=None,mode='sdr',channel='rgba',exposure=0,
                    band_height=64,cancel_event=None):
    width,height=engine.info.format
    started=time.perf_counter()
    def check():
        if cancel_event is not None and cancel_event.is_set():
            from .bands import EngineCancelled
            raise EngineCancelled('Viewer request superseded.')
    yield packet({'kind':'start','width':width,'height':height,'frame':frame,
        'channels':list(engine.info.channels),'orientation':'top-left','encoding':'rgba32float',
        'working_space':engine.color['working_space'],'display_space':'display-p3' if mode=='hdr' else 'srgb',
        'display':display,'view':view,'mode':mode})
    iterator=engine.evaluate_progressive(band_height=band_height,cancel_event=cancel_event)
    def convert(band):
        check()
        pixels=p.display_pixels(band['channels'],engine.color['working_space'],mode=mode,
            channel=channel,exposure=exposure,display=display,view=view,config_name=engine.color.get('config'),origin=band['rect'][:2])
        return band,pixels.tobytes()
    bands=_display_bands(iterator,convert,1,check)
    count=0;first=None
    try:
        for band,payload in bands:
            check();count+=1
            if first is None:first=(time.perf_counter()-started)*1000
            x0,y0,x1,y1=band['rect']
            yield packet({'kind':'band','x':x0,'y':height-y1,'width':x1-x0,'height':y1-y0,
                          'completed_rows':band['completed_rows'],'total_rows':height},payload)
        check()
        yield packet({'kind':'done','bands':count,'first_band_ms':first,
                      'elapsed_ms':(time.perf_counter()-started)*1000,'stats':engine.stats()})
    finally:
        bands.close();iterator.close()
