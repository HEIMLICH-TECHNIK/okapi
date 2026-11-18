"""Persistent preview preferences for this media engine, across projects."""
import json
from pathlib import Path
import tempfile
from . import projects

QUALITIES={'draft':{'crf':28,'mbps':4},'balanced':{'crf':22,'mbps':8},
           'high':{'crf':16,'mbps':16},'maximum':{'crf':12,'mbps':32}}
RESOLUTIONS=('source','half','quarter','640','960','1280','1920','2560','3840')


def defaults(root):
    return {'directory':str(Path(root).resolve()),'resolution':'1920','quality':'high','codec':'auto'}


def load(root):
    path=Path(root)/'preview-cache-settings.json'
    return validate({**defaults(root),**json.loads(path.read_text())}) if path.exists() else defaults(root)


def validate(value):
    if set(value)!={'directory','resolution','quality','codec'}:raise ValueError('Unknown preview cache setting.')
    if value['resolution'] not in RESOLUTIONS:raise ValueError('Choose a preview resolution.')
    if value['quality'] not in QUALITIES:raise ValueError('Choose a preview quality.')
    if value['codec'] not in ('auto','h264','hevc'):raise ValueError('Choose a preview codec.')
    if not isinstance(value['directory'],str) or not value['directory'].strip():raise ValueError('Enter a cache folder.')
    directory=Path(value['directory'].strip()).expanduser()
    if not directory.is_absolute():raise ValueError('Use an absolute path on the media engine computer.')
    return {**value,'directory':str(directory.resolve())}


def check_directory(value):
    directory=Path(value['directory']);directory.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryFile(dir=directory) as probe:probe.write(b'okapi-cache')


def save(root,value):projects.write(Path(root)/'preview-cache-settings.json',value)


def public(value):
    return {**value,'raw_directory':str(Path(value['directory'])/'presentation-raw-cache'),
            'playback_directory':str(Path(value['directory'])/'media'),
            'location_scope':'media-engine','raw_budget_gib':8}


def playback_root(value,job):return Path(value['directory'])/'media'/job/'playback'


def maximum(value,metadata):
    longest=max(metadata['width'],metadata['height'])
    mode=value['resolution']
    return longest if mode=='source' else max(2,longest//(2 if mode=='half' else 4)) if mode in ('half','quarter') else int(mode)
