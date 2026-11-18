"""Frame-accurate indexed decode and a byte-bounded, immutable planar cache."""
from collections import OrderedDict
from pathlib import Path
import threading
import time

import av


class Decoder:
    def __init__(self,path,metadata):
        self.path=Path(path)
        self.metadata=metadata
        self.lock=threading.Lock()
        self.leases=0
        self.container=av.open(str(path))
        self.stream=self.container.streams.video[0]
        self.stream.codec_context.thread_count=4
        self.next_index=None
        self.iterator=None
        self.timestamps=metadata.get('timestamps',[])
        self.lookup={value:i for i,value in enumerate(self.timestamps) if value is not None}

    def close(self):
        self.container.close()

    def get(self,index):
        if self.next_index!=index or self.iterator is None:
            if len(self.timestamps)==self.metadata['frames'] and self.timestamps[index] is not None:
                target=self.timestamps[index]
                self.container.seek(target,stream=self.stream,backward=True)
            else:
                # No trustworthy index: decode from the beginning instead of
                # approximating a VFR frame from seconds * average FPS.
                self.container.seek(self.stream.start_time or 0,stream=self.stream,backward=True)
            self.iterator=iter(self.container.decode(self.stream))
            self.next_index=None
        ordinal=0
        for frame in self.iterator:
            if (frame.width,frame.height)!=(self.metadata['width'],self.metadata['height']):
                raise ValueError('Video dimensions changed within the clip.')
            number=self.lookup.get(frame.pts)
            if number is None:
                number=self.next_index if self.next_index is not None else ordinal
                ordinal+=1
            self.next_index=number+1
            if number==index:return frame
            if number>index:break
        raise ValueError('The requested frame could not be decoded exactly.')


class FrameStore:
    def __init__(self,budget=256*1024*1024,readers=4):
        self.budget=budget;self.reader_limit=readers
        self.frames=OrderedDict();self.decoders=OrderedDict()
        self.bytes=0;self.lock=threading.RLock();self.hits=0;self.misses=0

    def decoded(self,path,metadata,index):
        path=Path(path).resolve();stamp=path.stat();identity=(str(path),stamp.st_size,stamp.st_mtime_ns)
        with self.lock:
            reader=self.decoders.get(identity)
            if reader is None:reader=Decoder(path,metadata);self.decoders[identity]=reader
            self.decoders.move_to_end(identity);reader.leases+=1
        try:
            with reader.lock:return reader.get(index)
        finally:
            with self.lock:
                reader.leases-=1
                while len(self.decoders)>self.reader_limit:
                    previous,old=next(iter(self.decoders.items()))
                    if old.leases or not old.lock.acquire(blocking=False):break
                    try:self.decoders.pop(previous);old.close()
                    finally:old.lock.release()

    def raw(self,path,metadata,index):
        from .pipeline import video_channels
        path=Path(path).resolve();stamp=path.stat()
        identity=(str(path),stamp.st_size,stamp.st_mtime_ns)
        key=(*identity,index)
        with self.lock:
            cached=self.frames.get(key)
            if cached is not None:
                self.hits+=1;self.frames.move_to_end(key);return cached
            self.misses+=1
            reader=self.decoders.get(identity)
            if reader is None:
                reader=Decoder(path,metadata);self.decoders[identity]=reader
            self.decoders.move_to_end(identity)
            reader.leases+=1
        # Serial decoder ownership also deduplicates simultaneous requests for
        # the same frame. Other media files can decode on independent workers.
        try:
            with reader.lock:
                with self.lock:
                    cached=self.frames.get(key)
                    if cached is not None:return cached
                frame=reader.get(index)
                values=video_channels(frame)
                for plane in values.values():plane.setflags(write=False)
                size=sum(v.nbytes for v in values.values())
                with self.lock:
                    if size<=self.budget:
                        while self.frames and self.bytes+size>self.budget:
                            _,old=self.frames.popitem(last=False);self.bytes-=sum(v.nbytes for v in old.values())
                        self.frames[key]=values;self.bytes+=size
                    while len(self.decoders)>self.reader_limit:
                        previous,old=next(iter(self.decoders.items()))
                        if old.leases or not old.lock.acquire(blocking=False):break
                        try:self.decoders.pop(previous);old.close()
                        finally:old.lock.release()
                return values
        finally:
            with self.lock:reader.leases-=1

    def close(self):
        with self.lock:
            decoders=list(self.decoders.values())
            self.decoders.clear();self.frames.clear();self.bytes=0
        for decoder in decoders:
            with decoder.lock:decoder.close()
