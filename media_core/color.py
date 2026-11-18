"""Project OCIO configs and Viewer transforms; independent of media decoding.

External configs remain external dependencies. They are never copied from a
licensed application's installation into an okapi distribution.
"""
from functools import lru_cache
import copy
import hashlib
import json
import os
import time
from pathlib import Path

import PyOpenColorIO as ocio

BUILTIN='studio-config-v2.2.0_aces-v1.3_ocio-v2.4'
_STAMPS={}


@lru_cache(maxsize=1)
def _builtins():
    return {name:{'id':name,'label':label,'kind':'builtin'}
            for name,label,_,_ in ocio.BuiltinConfigRegistry().getBuiltinConfigs()}


def registered():
    result=dict(_builtins())
    for name,path in json.loads(os.environ.get('OKAPI_OCIO_CONFIGS','{}')).items():
        target=Path(path).expanduser().resolve()
        result[name]={'id':name,'label':name,'kind':'external','path':str(target)}
    return result


def default_id():
    return os.environ.get('OKAPI_DEFAULT_OCIO_CONFIG',BUILTIN)


def identity(name=None):
    name=name or default_id()
    if name not in registered():raise ValueError('Unknown project OCIO configuration.')
    item=registered()[name]
    if item['kind']=='external':
        path=Path(item['path'])
        cached=_STAMPS.get(str(path))
        if cached and time.monotonic()-cached[0]<1:
            return name,item['path'],cached[1]
        suffixes={'.ocio','.cube','.spi1d','.spi3d','.3dl','.clf','.ctf','.csp','.lut'}
        files={path}|{p for p in path.parent.glob('*') if p.is_file() and p.suffix.lower() in suffixes}
        if (path.parent/'luts').is_dir():
            files|={p for p in (path.parent/'luts').rglob('*') if p.is_file()}
        stamp=tuple((str(p),p.stat().st_mtime_ns,p.stat().st_size) for p in sorted(files))
        _STAMPS[str(path)]=(time.monotonic(),stamp)
        return name,item['path'],stamp
    return name,'',()


@lru_cache(maxsize=12)
def _load(name,path,stamp):
    return ocio.Config.CreateFromFile(path) if path else ocio.Config.CreateFromBuiltinConfig(name)


def config(name=None):
    return _load(*identity(name))


def info(name=None):
    name=name or default_id();cfg=config(name)
    display=cfg.getDefaultDisplay();view=cfg.getDefaultView(display)
    return {'id':name,'sha256':fingerprint(name),
            'spaces':list(cfg.getColorSpaceNames()),'roles':dict(cfg.getRoles()),
            'displays':{d:list(cfg.getViews(d)) for d in cfg.getDisplays()},
            'default_display':display,'default_view':view,
            'working_default':cfg.getRoleColorSpace(ocio.ROLE_SCENE_LINEAR)}


@lru_cache(maxsize=12)
def _fingerprint(name,path,stamp):
    digest=hashlib.sha256(_load(name,path,stamp).serialize().encode())
    if path:
        base=Path(path).parent
        for filename,_,_ in stamp:
            file=Path(filename)
            digest.update(file.relative_to(base).as_posix().encode())
            digest.update(hashlib.sha256(file.read_bytes()).digest())
    return digest.hexdigest()


def fingerprint(name=None):return _fingerprint(*identity(name))


def canonical(space,name=None):
    cfg=config(name)
    item=cfg.getColorSpace(space) if space else None
    return item.getName() if item is not None else None


@lru_cache(maxsize=128)
def _view_transform(key,source,display,view):
    cfg=_load(*key)
    if display not in cfg.getDisplays() or view not in cfg.getViews(display):
        raise ValueError('Choose a Display and View from the project OCIO configuration.')
    return cfg.getProcessor(ocio.DisplayViewTransform(src=source,display=display,view=view)).getDefaultCPUProcessor()


def view_transform(source,display,view,name=None):
    return _view_transform(identity(name),source,display,view)


def materialize(name=None):
    name,path,_=identity(name)
    cfg=copy.deepcopy(config(name))
    if path:
        parent=Path(path).parent
        searches=list(cfg.getSearchPaths())
        cfg.clearSearchPaths()
        for search in searches:
            resolved=Path(search)
            cfg.addSearchPath(str(resolved if resolved.is_absolute() else parent/resolved))
        cfg.addSearchPath(str(parent))
    return cfg.serialize()
