"""Byte-bounded disk cache of decoded float32 presentation planes.

Input interpretation and Viewer Process are deliberately absent from the key:
changing color reuses decoded pixels, never a previously baked display image.
This cache is independent of originals and full-resolution Write masters.
"""
from collections import OrderedDict
from pathlib import Path
import hashlib
import json
import threading
import uuid
import numpy as np


class RawCache:
    def __init__(self,root,budget=8*1024**3):
        self.root=Path(root);self.root.mkdir(parents=True,exist_ok=True)
        self.budget=budget;self.lock=threading.RLock();self.entries=OrderedDict();self.bytes=0
        self.hits=0;self.misses=0
        for path in sorted(self.root.glob('*/*.npz'),key=lambda p:p.stat().st_mtime_ns):
            self.entries[path]=path.stat().st_size;self.bytes+=self.entries[path]
        self._trim(0)

    def key(self,source,metadata,width,height):
        source=Path(source);stat=source.stat()
        stamps=[(str(source.resolve()),stat.st_size,stat.st_mtime_ns)]
        if metadata['kind']=='sequence':
            stamps.extend((name,(source/name).stat().st_size,(source/name).stat().st_mtime_ns) for name in metadata['files'])
        return hashlib.sha256(json.dumps(['raw-f32-v1',stamps,width,height,metadata['frames']],sort_keys=True).encode()).hexdigest()

    def _trim(self,extra):
        while self.entries and self.bytes+extra>self.budget:
            path,size=self.entries.popitem(last=False);path.unlink(missing_ok=True);self.bytes-=size

    def get(self,key,index):
        path=self.root/key/f'{index:08d}.npz'
        with self.lock:
            if path not in self.entries:self.misses+=1;return None
            try:
                with np.load(path,allow_pickle=False) as stored:values={name:stored[name] for name in stored.files}
            except (OSError,ValueError,EOFError):
                self.bytes-=self.entries.pop(path);path.unlink(missing_ok=True);self.misses+=1;return None
            self.entries.move_to_end(path);self.hits+=1
        for value in values.values():value.setflags(write=False)
        return values

    def put(self,key,index,values):
        size=sum(v.nbytes for v in values.values())+4096
        if size>self.budget:return
        path=self.root/key/f'{index:08d}.npz';path.parent.mkdir(parents=True,exist_ok=True)
        temporary=path.with_name(f'.{uuid.uuid4().hex}.npz')
        try:
            np.savez(temporary,**values)
            with self.lock:
                actual=temporary.stat().st_size
                self.bytes-=self.entries.pop(path,0);self._trim(actual)
                temporary.replace(path);self.entries[path]=actual;self.bytes+=actual
        finally:temporary.unlink(missing_ok=True)
