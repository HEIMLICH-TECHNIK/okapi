"""Small Rerun recordings for the original interactive timeline controls.

The recording contains frame references only. Precision images and presentation
video stay in the media engine; the Rerun time panel is their shared transport.
"""
from pathlib import Path
from fractions import Fraction
import uuid
import numpy as np


def record(target,metadata,recording_id):
    import rerun as rr
    import rerun.blueprint as blueprint
    target=Path(target);target.parent.mkdir(parents=True,exist_ok=True)
    temporary=target.with_name(f'.{uuid.uuid4().hex}.rrd')
    count=metadata['frames'];frames=np.arange(count,dtype=np.int64)
    timestamps=metadata.get('timestamps',[])
    if len(timestamps)==count and all(v is not None for v in timestamps):
        base=Fraction(metadata['time_base'])
        nanos=np.array([round((v-timestamps[0])*base*1_000_000_000) for v in timestamps],dtype=np.int64)
    else:nanos=np.rint(frames/metadata['fps']*1e9).astype(np.int64)
    layout=blueprint.Blueprint(blueprint.BlueprintPanel(state='hidden'),
        blueprint.SelectionPanel(state='hidden'),
        blueprint.TimePanel(state='expanded',timeline='Clip',fps=metadata['fps'],play_state='paused',loop_mode='all'),
        auto_layout=False,auto_views=False)
    stream=rr.RecordingStream('okapi',recording_id=recording_id)
    try:
        stream.save(temporary,default_blueprint=layout)
        stream.send_columns('Source',indexes=[rr.TimeColumn('Clip',duration=nanos.astype('f8')/1e9),
            rr.TimeColumn('Frame',sequence=frames)],columns=rr.VideoFrameReference.columns_nanos(nanos))
        stream.flush()
        stream.disconnect()
        temporary.replace(target)
    finally:
        stream.disconnect();temporary.unlink(missing_ok=True)
