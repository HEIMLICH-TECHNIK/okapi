"""Flat-image I/O and display. Core channel arrays are float32, bottom-up.

EXR uses a linear/premultiplied convention by default. PNG/JPEG use sRGB;
bitmap alpha association is performed *after* RGB has been linearized. Named
EXR parts are flattened with explicit collision aliases. Deep/volume data is
rejected. The main full window establishes engine origin (0,0), with native
windows reported separately. ROI reads retain overscan at its original place.
Export arrays default to origin (0,0); EXR can retain an explicit data/full window.
"""
from __future__ import annotations

from collections.abc import Mapping
from collections import OrderedDict
from contextlib import contextmanager
from functools import lru_cache
import math
import os
from pathlib import Path
import re
import threading
import uuid

import numpy as np
from PIL import Image

_RGB = ('rgba.red', 'rgba.green', 'rgba.blue')
_ALPHA = 'rgba.alpha'
_SUFFIXES = {'.exr', '.png', '.jpg', '.jpeg', '.tif', '.tiff'}
_PARTS = {'R': 'red', 'G': 'green', 'B': 'blue', 'A': 'alpha'}
_HEADER_CACHE = OrderedDict()
_HEADER_LOCK = threading.Lock()
_READERS = threading.local()


class _ScanlineBands:
    """Worker-owned bands: a global byte budget and two bands per channel group."""
    def __init__(self, budget, max_bands):
        self.budget, self.max_bands = budget, max_bands
        self.entries = OrderedDict()
        self.bytes = 0

    def get(self, key):
        result = self.entries.get(key)
        if result is not None:
            self.entries.move_to_end(key)
        return result

    def put(self, key, pixels):
        size = pixels.nbytes
        if size > self.budget or self.max_bands == 0:
            return pixels
        # Limit bands per reader/subimage/z/channel range. A global entry-count
        # limit would evict other EXR parts before the next neighboring X tile.
        group = key[:2] + key[4:]
        same_group = [previous for previous in self.entries
                      if previous[:2] + previous[4:] == group]
        while len(same_group) >= self.max_bands:
            removed = self.entries.pop(same_group.pop(0))
            self.bytes -= removed.nbytes
        while self.entries and self.bytes + size > self.budget:
            _, removed = self.entries.popitem(last=False)
            self.bytes -= removed.nbytes
        frozen = np.frombuffer(np.ascontiguousarray(pixels).tobytes(), np.float32).reshape(pixels.shape)
        self.entries[key] = frozen
        self.bytes += size
        return frozen

    def clear(self):
        self.entries.clear()
        self.bytes = 0


def _oiio():
    try:
        import OpenImageIO as oiio
    except ImportError as exc:
        raise RuntimeError('OpenImageIO is required; run the app with its installed .venv') from exc
    return oiio


def resolve_sequence(path, frame) -> Path:
    if isinstance(frame, bool) or int(frame) != frame:
        raise ValueError('frame must be an integer')
    frame = int(frame)
    value = os.fspath(path)
    value = re.sub(r'#+', lambda m: f'{frame:0{len(m.group())}d}', value)
    value = re.sub(r'%0?(\d*)d', lambda m: f'{frame:0{int(m.group(1) or 0)}d}', value)
    value = re.sub(r'\{frame(?::(0?\d+)d)?\}',
                   lambda m: f'{frame:0{int(m.group(1) or 0)}d}', value)
    return Path(value).expanduser()


def _channel_name(name):
    if name in _PARTS:
        return 'rgba.' + _PARTS[name]
    if name in ('red', 'green', 'blue', 'alpha'):
        return 'rgba.' + name
    if name == 'Y':
        return 'rgba.luma'
    if name == 'Z':
        return 'depth.Z'
    if '.' in name:
        layer, component = name.rsplit('.', 1)
        return layer + '.' + _PARTS.get(component, component)
    return name


def _file_channel(name):
    if name == 'depth.Z':
        return 'Z'
    if name == 'rgba.luma':
        return 'Y'
    if '.' in name:
        layer, component = name.rsplit('.', 1)
        part = {value: key for key, value in _PARTS.items()}.get(component, component)
        return part if layer == 'rgba' else layer + '.' + part
    return name


def _path(path):
    target = Path(path).expanduser()
    if target.suffix.lower() not in _SUFFIXES:
        raise ValueError('supported image formats: EXR, PNG, JPEG, TIFF')
    return target


def _open(path):
    oiio = _oiio()
    hints = oiio.ImageSpec()
    hints.attribute('oiio:UnassociatedAlpha', 1)
    inp = oiio.ImageInput.open(str(path), hints)
    if inp is None:
        raise OSError(f'cannot read {path}: {oiio.geterror()}')
    return inp


def _spec_info(spec, path, resolved=None):
    names = [_channel_name(str(name)) for name in spec.channelnames]
    return {'path': str(Path(path).resolve()) if resolved is None else resolved, 'width': spec.width, 'height': spec.height,
            'channels': names, 'file_channels': list(spec.channelnames),
            'format': Path(path).suffix.lower().lstrip('.'), 'dtype': str(spec.format),
            'data_window': [spec.x, spec.y, spec.x + spec.width, spec.y + spec.height],
            'full_window': [spec.full_x, spec.full_y,
                            spec.full_x + spec.full_width, spec.full_y + spec.full_height],
            'deep': bool(spec.deep), 'depth': spec.depth,
            'unassociated_alpha': bool(spec.get_int_attribute('oiio:UnassociatedAlpha', 0)),
            'color_space': spec.get_string_attribute('oiio:ColorSpace', ''),
            'orientation': spec.get_int_attribute('Orientation', 1)}


def _specs(inp):
    """Inspect subimage headers without fetching any pixels."""
    oiio = _oiio()
    specs = []
    index = 0
    while inp.seek_subimage(index, 0):
        specs.append(oiio.ImageSpec(inp.spec()))
        index += 1
    if not specs:
        raise OSError('image has no readable subimages')
    return specs


def _file_stamp(path):
    stat = Path(path).stat()
    return (stat.st_size, stat.st_mtime_ns)


class _SourceSnapshot:
    """One evaluation's fresh pre-open check, shared by its worker sessions.

    Only the successful check is shared. RowEngine still stats every decoded
    tile before publishing it, so later edits fail even after this check.
    Plain tuple snapshots used by public read_session callers are unchanged.
    """
    def __init__(self, stamp):
        self.stamp = stamp
        self._lock = threading.Lock()
        self._checked = False

    def check(self, path):
        with self._lock:
            if not self._checked:
                if _file_stamp(path) != self.stamp:
                    raise RuntimeError('source changed before read; retry evaluation')
                self._checked = True
        return self.stamp


def _header_specs(path, stamp=None, inp=None, name=None):
    """A bounded header-only cache; pixel buffers and open files are not retained."""
    name = str(Path(path).resolve()) if name is None else name
    stamp = _file_stamp(path) if stamp is None else stamp
    key = (name, stamp)
    with _HEADER_LOCK:
        if key in _HEADER_CACHE:
            _HEADER_CACHE.move_to_end(key)
            return _HEADER_CACHE[key]
    owned = inp is None
    if owned:
        inp = _open(path)
    try:
        specs = tuple(_specs(inp))
    finally:
        if owned:
            inp.close()
    with _HEADER_LOCK:
        for previous in list(_HEADER_CACHE):
            if previous[0] == name and previous != key:
                _HEADER_CACHE.pop(previous)
        _HEADER_CACHE[key] = specs
        _HEADER_CACHE.move_to_end(key)
        while len(_HEADER_CACHE) > 64:
            _HEADER_CACHE.popitem(last=False)
    return specs


@contextmanager
def read_session(scanline_budget_bytes=16 * 1024 * 1024, max_scanline_bands=2,
                 *, borrow_immutable=False, source_snapshots=()):
    """Reuse readers within one worker batch, closing them when the batch ends.

    Sessions are thread-local and nest safely. They do not propagate into
    executor workers: wrap each worker's tile batch in its own session. This
    avoids sharing seekable ImageInput handles and retaining Windows file locks
    between frame evaluation / file export operations. A worker-local, immutable
    scanline cache has a separate total 16 MiB bound and retains two bands per
    reader/subimage/channel range by default. Nested sessions inherit the outer
    session's settings; oversized bands are not kept. Internal engine callers
    may borrow immutable full-width planes from the byte-owned scanline cache.
    Public/default reads retain writable, independent channel arrays.
    """
    previous = getattr(_READERS, 'session', None)
    if previous is not None:
        yield
        return
    if type(scanline_budget_bytes) is not int or scanline_budget_bytes < 0:
        raise ValueError('scanline cache budget must be a nonnegative integer')
    if type(max_scanline_bands) is not int or max_scanline_bands < 0:
        raise ValueError('scanline band count must be a nonnegative integer')
    if type(borrow_immutable) is not bool:
        raise ValueError('borrow_immutable must be boolean')
    readers = OrderedDict()
    sources = OrderedDict()
    snapshots = dict(source_snapshots)
    bands = _ScanlineBands(scanline_budget_bytes, max_scanline_bands)
    _READERS.session = readers
    _READERS.sources = sources
    _READERS.source_snapshots = snapshots
    _READERS.band_cache = bands
    _READERS.borrow_immutable = borrow_immutable
    try:
        yield
    finally:
        _READERS.session = None
        _READERS.sources = None
        _READERS.source_snapshots = None
        _READERS.band_cache = None
        _READERS.borrow_immutable = False
        bands.clear()
        for _, inp, _ in readers.values():
            inp.close()


@contextmanager
def _reader(path, profile=None):
    session = getattr(_READERS, 'session', None)
    if session is None:
        stamp = _file_stamp(path)
        inp = _open(path)
        try:
            yield inp, _header_specs(path, stamp, inp)
        finally:
            inp.close()
        return
    # The installed OIIO/OpenEXR build can crash when a reused scanline input
    # changes from a wider channel request to a narrower one in a later band.
    # Keep request profiles separate while reusing handles for neighboring ROIs.
    # A read_session is one worker's evaluation batch. Snapshot its path and
    # file identity once, rather than resolving/statting the same UNC file for
    # every neighboring tile. The planner snapshots each new evaluation, and
    # RowEngine still checks for changes immediately after each Read tile.
    # No reader or band survives a session, including exceptional exits. The
    # engine may share its fresh pre-open check within this evaluation only;
    # each Read tile still checks the source again before cache publication.
    sources = _READERS.sources
    source_key = os.fspath(path)
    source = sources.get(source_key)
    if source is None:
        expected = _READERS.source_snapshots.get(source_key)
        resolved = source_key if expected is not None else str(Path(path).resolve())
        if isinstance(expected, _SourceSnapshot):
            stamp = expected.check(path)
        else:
            stamp = _file_stamp(path)
            if expected is not None and stamp != expected:
                raise RuntimeError('source changed before read; retry evaluation')
        source = (resolved, stamp)
        sources[source_key] = source
        while len(sources) > 64:
            sources.popitem(last=False)
    sources.move_to_end(source_key)
    resolved, stamp = source
    name = (resolved, profile)
    entry = session.get(name)
    if entry is not None and entry[0] != stamp:
        session.pop(name)[1].close()
        entry = None
    if entry is None:
        inp = _open(path)
        try:
            specs = _header_specs(path, stamp, inp, name=resolved)
        except Exception:
            inp.close()
            raise
        entry = (stamp, inp, specs)
        session[name] = entry
        while len(session) > 8:
            session.popitem(last=False)[1][1].close()
    session.move_to_end(name)
    yield entry[1], entry[2]


def _part_name(spec, index):
    return (spec.get_string_attribute('oiio:subimagename', '')
            or spec.get_string_attribute('name', '') or f'part{index}')


def _has_rgb(spec):
    components = set()
    for native in spec.channelnames:
        pieces = str(native).rsplit('.', 1)
        if len(pieces) == 2 and pieces[0].lower() not in ('c', 'beauty', 'rgba'):
            continue
        component = _PARTS.get(pieces[-1], pieces[-1])
        components.add(component)
    return components >= {'red', 'green', 'blue'}


def _main_part(specs, indices):
    for index in indices:
        if _part_name(specs[index], index).lower() in ('c', 'beauty', 'rgba') and _has_rgb(specs[index]):
            return index
    return next((index for index in indices if _has_rgb(specs[index])), indices[0])


def _selected_parts(specs, part):
    if part in (None, 'all'):
        return list(range(len(specs)))
    if part == 'auto':
        return [_main_part(specs, list(range(len(specs))))]
    if isinstance(part, str):
        matches = [i for i, spec in enumerate(specs) if _part_name(spec, i) == part]
        if len(matches) > 1:
            raise ValueError(f'part name {part!r} is ambiguous; use a part index')
        if matches:
            return matches
        if part.isdigit():
            part = int(part)
    if isinstance(part, int) and not isinstance(part, bool) and 0 <= part < len(specs):
        return [part]
    raise ValueError(f'image part {part!r} does not exist')


def _full_window(spec):
    return (spec.full_x, spec.full_y, spec.full_width or spec.width, spec.full_height or spec.height)


def _layout(specs, part='all'):
    indices = _selected_parts(specs, part)
    main = _main_part(specs, indices)
    origin_x, origin_y, width, height = _full_window(specs[main])
    top = origin_y + height
    channels, aliases, part_maps = {}, [], {}
    for index in [main] + [i for i in indices if i != main]:
        spec = specs[index]
        name = _part_name(spec, index)
        mapping = {}
        for channel_index, native in enumerate(spec.channelnames):
            native = str(native)
            beauty = native
            if '.' in native:
                layer, component = native.rsplit('.', 1)
                if index == main and layer.lower() in ('c', 'beauty', 'rgba'):
                    beauty = component
            if beauty in _PARTS or beauty in ('red', 'green', 'blue', 'alpha'):
                component = _PARTS.get(beauty, beauty)
                candidate = ('rgba.' if index == main else name + '.') + component
            elif len(specs) == 1:
                # Retain the existing single-part RGB-component aliases.
                candidate = _channel_name(native)
            elif '.' in native:
                candidate = native  # depth.z, vectors, masks and qualified AOVs
            else:
                candidate = name + '.' + native
            if candidate in channels:
                base = name + '.' + candidate
                candidate = base
                suffix = 2
                while candidate in channels:
                    candidate = f'{base}.part{index}_{suffix}'
                    suffix += 1
                aliases.append({'part': index, 'native': native, 'alias': candidate,
                                'reason': 'channel name collision'})
            channels[candidate] = (index, channel_index)
            mapping[candidate] = native
        part_maps[index] = mapping
    if 'rgba.luma' in channels and not any(c in channels for c in _RGB):
        for name in _RGB:
            channels[name] = channels['rgba.luma']
    boxes = [(s.x - origin_x, top - (s.y + s.height), s.x + s.width - origin_x, top - s.y)
             for i, s in enumerate(specs) if i in indices]
    bbox = [min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes)]
    # Observed in the Nuke17.0v4 oracle for this multipart source: the file's
    # depth.z is exposed as depth_extra.z. Preserve native names by default;
    # this compatibility spelling is available only when explicitly requested.
    nuke_aliases = {'depth_extra.z': 'depth.z'} if 'depth.z' in channels and 'depth_extra.z' not in channels else {}
    return dict(indices=indices, main=main, origin=(origin_x, origin_y), top=top,
                width=width, height=height, bbox=bbox, channels=channels,
                aliases=aliases, nuke_aliases=nuke_aliases, part_maps=part_maps)


def _metadata(specs, target, layout, resolved=None):
    resolved = str(Path(target).resolve()) if resolved is None else resolved
    spec = specs[layout['main']]
    info = _spec_info(spec, target, resolved)
    info.update(width=layout['width'], height=layout['height'], channels=list(layout['channels']),
                data_width=spec.width, data_height=spec.height,
                bbox=layout['bbox'], format_box=[0, 0, layout['width'], layout['height']],
                native_full_origin=list(layout['origin']), main_part=layout['main'],
                selected_parts=layout['indices'], subimages=len(specs),
                channel_aliases=layout['aliases'], nuke_aliases=layout['nuke_aliases'], window_origin_preserved=True,
                deep=any(specs[i].deep for i in layout['indices']),
                supported_flat=all(not specs[i].deep and specs[i].depth == 1 for i in layout['indices']))
    info['parts'] = []
    ox, _ = layout['origin']
    for index, current in enumerate(specs):
        description = _spec_info(current, target, resolved)
        description.update(index=index, name=_part_name(current, index),
                           selected=index in layout['indices'],
                           channel_map=layout['part_maps'].get(index, {}),
                           bbox=[current.x - ox, layout['top'] - current.y - current.height,
                                 current.x + current.width - ox, layout['top'] - current.y],
                           tiled=bool(current.tile_width), tile_size=[current.tile_width, current.tile_height])
        description['channels'] = (list(description['channel_map']) if description['selected']
                                   else list(current.channelnames))
        info['parts'].append(description)
    return info


def image_info(path, part='all', *, _source=None) -> dict:
    target = _path(path)
    # The planner has just resolved and statted its source. Reuse that exact
    # evaluation snapshot, rather than repeating UNC metadata round trips.
    # Public/default calls still resolve/stat on every metadata request.
    resolved, stamp = (str(target.resolve()), None) if _source is None else _source
    specs = _header_specs(target, stamp=stamp, name=resolved)
    return _metadata(specs, target, _layout(specs, part), resolved)


def _roi_box(roi, layout):
    if roi is None:
        return (0, 0, layout['width'], layout['height'])
    if len(roi) != 4 or any(not isinstance(v, (int, np.integer)) or isinstance(v, bool) for v in roi):
        raise ValueError('ROI must contain four integer bottom-up coordinates')
    roi = tuple(map(int, roi))
    if roi[2] <= roi[0] or roi[3] <= roi[1]:
        raise ValueError('ROI must be nonempty and ordered')
    return roi


def _read_region(inp, spec, index, native_box, channel_indices):
    """Return just the intersecting rows/tiles; scanlines necessarily read full X."""
    x0, y0, x1, y1 = native_box
    if spec.tile_width:
        tx, ty = spec.tile_width, spec.tile_height
        rx0 = spec.x + ((x0 - spec.x) // tx) * tx
        ry0 = spec.y + ((y0 - spec.y) // ty) * ty
        rx1 = min(spec.x + spec.width, spec.x + math.ceil((x1 - spec.x) / tx) * tx)
        ry1 = min(spec.y + spec.height, spec.y + math.ceil((y1 - spec.y) / ty) * ty)
    else:
        rx0, ry0, rx1, ry1 = spec.x, y0, spec.x + spec.width, y1
    groups = []
    for channel in sorted(channel_indices):
        if groups and channel == groups[-1][1]:
            groups[-1][1] += 1
        else:
            groups.append([channel, channel + 1])
    planes = {}
    for begin, end in groups:
        if spec.tile_width:
            inp.seek_subimage(index, 0)
            data = inp.read_tiles(index, 0, rx0, rx1, ry0, ry1, spec.z, spec.z + 1, begin, end, 'float')
            if data is None:
                raise OSError(f'cannot decode part {index} ROI: {inp.geterror()}')
            data = np.asarray(data, dtype=np.float32).reshape(ry1 - ry0, rx1 - rx0, end - begin)
        else:
            cache = getattr(_READERS, 'band_cache', None)
            # Reader identity scopes the key to one path/stamp. The session
            # replaces its reader after a size/mtime change, so stale bands
            # cannot match a newly opened input. X is deliberately omitted:
            # scanline decoding already fetched the full native width.
            key = (inp, index, ry0, ry1, spec.z, begin, end)
            data = cache.get(key) if cache is not None else None
            if data is None:
                inp.seek_subimage(index, 0)
                data = inp.read_scanlines(index, 0, ry0, ry1, spec.z, begin, end, 'float')
                if data is None:
                    raise OSError(f'cannot decode part {index} ROI: {inp.geterror()}')
                data = np.asarray(data, dtype=np.float32).reshape(ry1 - ry0, rx1 - rx0, end - begin)
                if cache is not None:
                    data = cache.put(key, data)
        clipped = data[y0 - ry0:y1 - ry0, x0 - rx0:x1 - rx0]
        # A full-width cache band already has immutable byte ownership. Keep
        # its channel/flip views for the engine instead of copying each plane
        # here and then copying it again into Row.freeze. Narrow X requests
        # still copy so a tiny ROI cannot retain a whole scanline allocation.
        borrow = (getattr(_READERS, 'borrow_immutable', False)
                  and x0 == rx0 and x1 == rx1 and not data.flags.writeable)
        for channel in range(begin, end):
            plane = clipped[::-1, :, channel - begin]
            planes[channel] = plane if borrow else np.ascontiguousarray(plane)
    return planes


def _space(space):
    lower = str(space).strip().lower()
    if lower in ('linear', 'scene_linear', 'scene-linear', 'linear srgb', 'linear rec.709'):
        return 'linear'
    if lower in ('srgb', 's-rgb'):
        return 'sRGB'
    return str(space)


@lru_cache(maxsize=16)
def _processor(config_path, modified, source, target):
    # The file timestamp is part of the key, so editing a config refreshes it.
    import PyOpenColorIO as ocio
    config = ocio.Config.CreateFromFile(config_path)
    return config.getProcessor(source, target).getDefaultCPUProcessor()


@lru_cache(maxsize=8)
def _display_config(config_path, modified):
    """Keep config enumeration and view processors on the same file version."""
    import PyOpenColorIO as ocio
    return ocio.Config.CreateFromFile(config_path)


def _display_config_key(color_config):
    path = Path(color_config).expanduser().resolve()
    if not path.is_file():
        raise ValueError(f'OCIO config not found: {path}')
    return str(path), path.stat().st_mtime_ns


@lru_cache(maxsize=24)
def _display_processor(config_path, modified, source, display, view):
    import PyOpenColorIO as ocio
    config = _display_config(config_path, modified)
    transform = ocio.DisplayViewTransform()
    transform.setSrc(source)
    transform.setDisplay(display)
    transform.setView(view)
    return config.getProcessor(transform).getDefaultCPUProcessor()


def color_choices(color_config='') -> dict:
    """Viewer display/view choices and exact native input/output color names.

    ``linear`` is the untransformed diagnostic view. A ``space:`` choice is a
    native color-space conversion; ``ocio-display:`` includes the configured
    view transform, looks and display encoding through DisplayViewTransform.
    """
    if not color_config:
        return {'spaces': ['linear', 'sRGB', 'raw'],
                'displays': [{'value': 'sRGB', 'label': 'sRGB'},
                             {'value': 'linear', 'label': 'Linear'}],
                'default_display': 'sRGB'}
    try:
        key = _display_config_key(color_config)
        config = _display_config(*key)
        spaces = list(config.getColorSpaceNames())
        displays = []
        for display in config.getDisplays():
            for view in config.getViews(display):
                displays.append({'value': f'ocio-display:{display}|{view}',
                                 'label': f'{display} / {view}'})
        display = config.getDefaultDisplay()
        view = config.getDefaultView(display) if display else ''
        default = f'ocio-display:{display}|{view}'
        if not any(item['value'] == default for item in displays):
            default = displays[0]['value'] if displays else 'linear'
        displays.append({'value': 'linear', 'label': 'Linear (변환 없음)'})
        displays.extend({'value': 'space:' + name, 'label': '색 공간: ' + name} for name in spaces)
        return {'spaces': spaces, 'displays': displays, 'default_display': default}
    except ImportError as exc:
        raise RuntimeError('PyOpenColorIO is required for an OCIO display/view') from exc
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError(f'OCIO config display/view enumeration failed: {exc}') from exc


def _view_rgb(rgb, working_space, selection, color_config):
    if selection.startswith('ocio-display:'):
        if not color_config:
            raise ValueError('an OCIO config is required for the selected display/view')
        encoded = selection[len('ocio-display:'):]
        if '|' not in encoded:
            raise ValueError('OCIO display/view selection must contain display and view')
        display, view = encoded.split('|', 1)
        if not display or not view:
            raise ValueError('OCIO display and view must not be empty')
        result = np.array(rgb, dtype=np.float32, order='C', copy=True)
        try:
            key = _display_config_key(color_config)
            processor = _display_processor(*key, str(working_space), display, view)
            processor.applyRGB(result)
        except ImportError as exc:
            raise RuntimeError('PyOpenColorIO is required for an OCIO display/view') from exc
        except Exception as exc:
            raise ValueError(f'OCIO display/view {display!r} / {view!r} failed: {exc}') from exc
        return result
    if selection.startswith('space:'):
        return convert_rgb(rgb, working_space, selection[len('space:'):], color_config)
    if _space(selection) == 'linear':
        return rgb
    return convert_rgb(rgb, working_space, selection, color_config)


def convert_rgb(rgb, source='linear', target='sRGB', color_config=''):
    """Convert an RGB triplet image without applying a transform to data/alpha."""
    # Config-native names and roles are exact and case-sensitive. Apply built-in
    # aliases only when using the built-in linear Rec.709 / sRGB transfer.
    source, target = ((str(source).strip(), str(target).strip()) if color_config
                      else (_space(source), _space(target)))
    result = np.array(rgb, dtype=np.float32, order='C', copy=True)
    if source == target or source.lower() in ('raw', 'data') or target.lower() in ('raw', 'data'):
        return result
    if color_config:
        config_path = Path(color_config).expanduser().resolve()
        if not config_path.is_file():
            raise ValueError(f'OCIO config not found: {config_path}')
        try:
            processor = _processor(str(config_path), config_path.stat().st_mtime_ns, source, target)
            processor.applyRGB(result)
        except ImportError as exc:
            raise RuntimeError('PyOpenColorIO is required for a custom color config') from exc
        except Exception as exc:
            raise ValueError(f'OCIO transform {source!r} to {target!r} failed: {exc}') from exc
        return result
    if (source, target) == ('sRGB', 'linear'):
        high = np.maximum((result + np.float32(0.055)) / np.float32(1.055), 0)
        return np.where(result <= 0.04045, result / np.float32(12.92), high ** np.float32(2.4)).astype(np.float32)
    if (source, target) == ('linear', 'sRGB'):
        high = np.maximum(result, 0) ** np.float32(1 / 2.4)
        return np.where(result <= 0.0031308, result * np.float32(12.92),
                        np.float32(1.055) * high - np.float32(0.055)).astype(np.float32)
    raise ValueError(f'color transform {source!r} to {target!r} requires an OCIO config')


def _identity_color(source, target, color_config=''):
    equal = str(source).strip() == str(target).strip() if color_config else _space(source) == _space(target)
    return (equal or str(source).lower() in ('raw', 'data')
            or str(target).lower() in ('raw', 'data'))


def _shape(channels):
    if not isinstance(channels, Mapping) or not channels:
        raise ValueError('image needs named 2D channels')
    values = {}
    for name, value in channels.items():
        if not isinstance(name, str) or not name:
            raise ValueError('channel names must be nonempty strings')
        arr = np.asarray(value, dtype=np.float32)
        if arr.ndim != 2 or not all(arr.shape):
            raise ValueError(f'{name}: channel must be a nonempty 2D array')
        values[name] = arr
    if len({value.shape for value in values.values()}) != 1:
        raise ValueError('channel sizes must match')
    return values, next(iter(values.values())).shape


def _straight_rgb(channels, names=_RGB, alpha_name=_ALPHA):
    shape = next(iter(channels.values())).shape
    luma = channels.get('rgba.luma')
    rgb = np.stack([channels.get(name, luma if luma is not None else np.zeros(shape, np.float32))
                    for name in names], axis=-1)
    alpha = channels.get(alpha_name)
    if alpha is not None:
        rgb = np.divide(rgb, alpha[..., None], out=np.zeros_like(rgb),
                        where=alpha[..., None] != 0)
    return rgb


def read_image(path, input_space='auto', working_space='linear', color_config='',
               part='all', channels=None, roi=None, associate_alpha=True) -> dict:
    """Read selected flat parts/channels into a global bottom-up ROI.

    Default ROI is the main full format; explicit ROI may include overscan.
    Out-of-data pixels and absent requested channels are zero. EXR scanline
    reads decode only intersecting Y rows and needed channel ranges, though a
    scanline must read its full native width. Tile reads fetch overlapping tiles.
    """
    target = _path(path)
    if channels is None:
        channel_profile = None
    elif isinstance(channels, str):
        channel_profile = (channels,)
    else:
        channels = list(channels)
        channel_profile = tuple(sorted(str(name) for name in channels))
    profile = (str(part), channel_profile, str(input_space), str(working_space), str(color_config))
    with _reader(target, profile) as (inp, specs):
        layout = _layout(specs, part)
        lookup = dict(layout['channels'])
        lookup.update({alias: layout['channels'][native] for alias, native in layout['nuke_aliases'].items()})
        if any(specs[i].deep or specs[i].depth != 1 for i in layout['indices']):
            raise ValueError('deep/volume images are not supported by this flat compositor')
        box = _roi_box(roi, layout)
        shape = (box[3] - box[1], box[2] - box[0])
        if channels is None or (isinstance(channels, str) and channels == 'all'):
            requested = list(layout['channels'])
        elif isinstance(channels, str):
            requested = [name for name in (*_RGB, _ALPHA) if name in layout['channels']] if channels == 'rgba' else (
                        [name for name in _RGB if name in layout['channels']] if channels == 'rgb' else [channels])
        else:
            requested = list(dict.fromkeys(channels))
        if any(not isinstance(name, str) or not name for name in requested):
            raise ValueError('requested channels must be nonempty names')
        spec = specs[layout['main']]
        is_bitmap = target.suffix.lower() != '.exr'
        straight = is_bitmap and (target.suffix.lower() in ('.png', '.jpg', '.jpeg')
                     or bool(spec.get_int_attribute('oiio:UnassociatedAlpha', 0)))
        if input_space == 'auto':
            if target.suffix.lower() in ('.png', '.jpg', '.jpeg'):
                input_space = 'sRGB'
            elif target.suffix.lower() == '.exr':
                input_space = 'linear'
            else:
                input_space = spec.get_string_attribute('oiio:ColorSpace', '') or 'linear'
        changing_color = not _identity_color(input_space, working_space, color_config)
        process_color = (associate_alpha and bool(set(requested) & set(_RGB)) and
                         all(name in layout['channels'] for name in _RGB) and (straight or changing_color))
        needed = set(requested)
        if process_color:
            needed.update(_RGB)
            if _ALPHA in layout['channels']:
                needed.add(_ALPHA)
        # A complete decoded plane already has bottom-up contiguous storage.
        # Allocate black padding lazily; do not copy an entire valid ROI over
        # a fresh zero plane only for Row.freeze to copy it once more later.
        result = {}
        reused_sources = set()
        source_indices = {}
        for name in needed:
            if name in lookup:
                index, channel = lookup[name]
                source_indices.setdefault(index, set()).add(channel)
        ox, _ = layout['origin']
        native = (box[0] + ox, layout['top'] - box[3], box[2] + ox, layout['top'] - box[1])
        for index, channel_indices in source_indices.items():
            current = specs[index]
            intersection = (max(native[0], current.x), max(native[1], current.y),
                            min(native[2], current.x + current.width), min(native[3], current.y + current.height))
            ix0, iy0, ix1, iy1 = intersection
            if ix0 >= ix1 or iy0 >= iy1:
                continue
            planes = _read_region(inp, current, index, intersection, channel_indices)
            x, y = ix0 - native[0], layout['top'] - iy1 - box[1]
            for name in needed:
                source = lookup.get(name)
                if source is not None and source[0] == index:
                    plane = planes[source[1]]
                    if intersection == native:
                        # Preserve read_image's writable, independent channel
                        # outputs. Single-row reads may be readonly cache views;
                        # luma/compatibility aliases may reference one plane.
                        borrow = (getattr(_READERS, 'borrow_immutable', False)
                                  and not plane.flags.writeable)
                        if (source not in reused_sources and (borrow or (plane.flags.writeable
                                and plane.flags.c_contiguous))):
                            result[name] = plane
                        else:
                            result[name] = plane.copy(order='C')
                        reused_sources.add(source)
                    else:
                        padded = np.zeros(shape, np.float32)
                        padded[y:y + iy1 - iy0, x:x + ix1 - ix0] = plane
                        result[name] = padded
        for name in needed:
            if name not in result:
                result[name] = np.zeros(shape, np.float32)
        if process_color:
            rgb = np.stack([result[name] for name in _RGB], axis=-1)
            alpha = result.get(_ALPHA)
            if not straight and alpha is not None and changing_color:
                rgb = np.divide(rgb, alpha[..., None], out=np.zeros_like(rgb), where=alpha[..., None] != 0)
            rgb = convert_rgb(rgb, input_space, working_space, color_config)
            if alpha is not None and (straight or changing_color):
                rgb *= alpha[..., None]
            # Color transforms with an offset must not create pixels outside
            # the source's region of definition.
            valid = np.zeros(shape, bool)
            current = specs[layout['channels'][_RGB[0]][0]]
            ix0, iy0 = max(native[0], current.x), max(native[1], current.y)
            ix1, iy1 = min(native[2], current.x + current.width), min(native[3], current.y + current.height)
            if ix0 < ix1 and iy0 < iy1:
                x, y = ix0 - native[0], layout['top'] - iy1 - box[1]
                valid[y:y + iy1 - iy0, x:x + ix1 - ix0] = True
            rgb[~valid] = 0
            for i, name in enumerate(_RGB):
                result[name] = np.ascontiguousarray(rgb[..., i])
        return {name: result[name] for name in requested}


def _written_image_info(target, *, native=False, snapshot=None):
    """Inspect actual saved bytes, using the writer's already canonical path.

    A native commit can supply bytes read through its retained creator handle;
    other layouts reopen through OIIO. Neither path uses a provisional spec.
    """
    target = Path(target)
    if not target.is_absolute():
        raise ValueError('written output path must already be absolute')
    if native:
        import exr_native
        header = exr_native.read_written_rgba_header(target, snapshot=snapshot)
        if header is not None:
            spec = _oiio().ImageSpec(header['width'], header['height'], 4, 'float')
            spec.x, spec.y = header['x'], header['y']
            spec.full_width, spec.full_height = header['full_width'], header['full_height']
            spec.full_x = spec.full_y = 0
            spec.channelnames = ['R', 'G', 'B', 'A']
            spec.alpha_channel = 3
            spec.attribute('oiio:ColorSpace', header['color_space'])
            return _metadata([spec], target, _layout([spec], 'all'), str(target))
    inp = _open(target)
    try:
        specs = _specs(inp)
    finally:
        inp.close()
    return _metadata(specs, target, _layout(specs, 'all'), str(target))


def write_image(path, channels, output_space='auto', working_space='linear',
                color_config='', bit_depth='float', origin=(0, 0), full_size=None,
                compression='zip', full_origin=(0, 0)) -> dict:
    target = _path(path).resolve()
    values, (height, width) = _shape(channels)
    oiio = _oiio()
    suffix = target.suffix.lower()
    exr = suffix == '.exr'
    bitmap = suffix in ('.png', '.jpg', '.jpeg')
    if not isinstance(compression, str) or compression.lower() not in ('zip', 'none'):
        raise ValueError('EXR compression must be zip or none')
    compression = compression.lower()
    if not exr and compression != 'zip':
        raise ValueError('compression selection is supported for EXR only')
    if len(origin) != 2 or any(not isinstance(v, (int, np.integer)) or isinstance(v, bool) for v in origin):
        raise ValueError('origin must contain integer bottom-up x and y')
    origin = tuple(map(int, origin))
    if full_size is None:
        if origin != (0, 0):
            raise ValueError('full_size is required when exporting a nonzero origin')
        full_size = (width, height)
    if (len(full_size) != 2 or any(not isinstance(v, (int, np.integer)) or isinstance(v, bool) or v <= 0
                                for v in full_size)):
        raise ValueError('full_size must contain a positive integer width and height')
    full_size = tuple(map(int, full_size))
    if not exr and (origin != (0, 0) or full_size != (width, height)):
        raise ValueError('PNG/JPEG/TIFF do not support this compositor\'s overscan window export; use EXR')
    if output_space == 'auto':
        output_space = 'sRGB' if bitmap else working_space
    # RGB conversions below return a separate stacked array and rebind entries;
    # channel planes themselves are never modified. Retain readonly inputs
    # until the one interleaved output allocation rather than copying twice.
    outvalues = dict(values)
    if all(name in outvalues for name in _RGB):
        if bitmap or not _identity_color(working_space, output_space, color_config):
            rgb = convert_rgb(_straight_rgb(outvalues), working_space, output_space, color_config)
            if not bitmap and _ALPHA in outvalues:
                rgb *= outvalues[_ALPHA][..., None]
            for i, name in enumerate(_RGB):
                outvalues[name] = rgb[..., i]
    if exr:
        names = [name for name in (*_RGB, _ALPHA) if name in outvalues]
        names += sorted(set(outvalues) - set(names))
        depth = 'half' if str(bit_depth).lower() in ('half', '16f') else 'float'
        if str(bit_depth).lower() not in ('float', '32f', 'half', '16f'):
            raise ValueError('EXR bit depth must be float or half')
    else:
        if not all(name in outvalues for name in _RGB):
            rgb = _straight_rgb(outvalues)
            for i, name in enumerate(_RGB):
                outvalues[name] = rgb[..., i]
        names = list(_RGB)
        if suffix not in ('.jpg', '.jpeg') and _ALPHA in outvalues:
            names.append(_ALPHA)
        aliases = {'8': 'uint8', '8bit': 'uint8', 'uint8': 'uint8',
                   '16': 'uint16', '16bit': 'uint16', 'uint16': 'uint16',
                   'half': 'float', 'float': 'float', '32f': 'float'}
        if str(bit_depth).lower() not in aliases:
            raise ValueError('bit depth must be uint8, uint16, float or half')
        depth = aliases[str(bit_depth).lower()]
        if suffix in ('.jpg', '.jpeg'):
            depth = 'uint8'
        elif suffix == '.png' and depth == 'float':
            raise ValueError('PNG cannot store float; select uint16 explicitly or use EXR')
    file_names = [_file_channel(name) for name in names]
    if len(set(file_names)) != len(file_names):
        raise ValueError('output channel aliases collide')
    # EXR accepts consecutive scanline ranges. Pack a bounded band when the
    # writer consumes it rather than retaining another full interleaved frame.
    # Bitmap conversion still needs its complete quantized pixel array below.
    pixels = None if exr else np.empty((height, width, len(names)), dtype=np.float32)
    if not exr:
        for index, name in enumerate(names):
            pixels[..., index] = outvalues[name][::-1]
    clipped = nonfinite = 0
    if depth in ('uint8', 'uint16'):
        clipped = int(np.count_nonzero((pixels < 0) | (pixels > 1)))
        nonfinite = int(np.count_nonzero(~np.isfinite(pixels)))
        pixels = np.nan_to_num(pixels, nan=0.0, posinf=1.0, neginf=0.0)
        maximum = 255 if depth == 'uint8' else 65535
        pixels = np.rint(np.clip(pixels, 0, 1) * maximum).astype(depth)
    spec = oiio.ImageSpec(width, height, len(names), depth)
    if exr:
        spec.x = full_origin[0] + origin[0]
        spec.y = full_origin[1] + full_size[1] - (origin[1] + height)
        spec.full_x, spec.full_y = full_origin
        spec.full_width, spec.full_height = full_size
    spec.channelnames = file_names
    if _ALPHA in names:
        spec.alpha_channel = names.index(_ALPHA)
    if 'depth.Z' in names:
        spec.z_channel = names.index('depth.Z')
    spec.attribute('oiio:ColorSpace', str(output_space))
    if bitmap:
        spec.attribute('oiio:UnassociatedAlpha', 1)
    if exr:
        spec.attribute('compression', compression)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f'.{target.stem}.{uuid.uuid4().hex}.tmp{target.suffix}')
    # Portable OIIO writer; the source project's Windows DLL is not loaded.
    writer = None
    opened = False
    try:
        writer = oiio.ImageOutput.create(str(temporary))
        if writer is None:
            raise OSError(f'cannot create image writer: {oiio.geterror()}')
        if not writer.open(str(temporary), spec):
            raise OSError(f'cannot open image output: {writer.geterror()}')
        opened = True
        if exr:
            storage = np.empty((min(256, height), width, len(names)), np.float32)
            for y0 in range(0, height, 256):
                y1 = min(height, y0 + 256)
                pixels = storage[:y1-y0]
                for index, name in enumerate(names):
                    pixels[..., index] = outvalues[name][height-y1:height-y0][::-1]
                if not writer.write_scanlines(spec.y+y0, spec.y+y1, 0, pixels):
                    raise OSError(f'cannot encode scanlines: {writer.geterror()}')
        elif not writer.write_image(pixels):
            raise OSError(f'cannot encode image: {writer.geterror()}')
        if writer is not None and writer.close() is False:
            raise OSError(f'cannot finish image: {writer.geterror()}')
        opened = False
        os.replace(temporary, target)
    finally:
        if opened:
            writer.close()
        temporary.unlink(missing_ok=True)
    info = image_info(target)
    info.update({'bit_depth': depth, 'output_space': output_space,
                 'alpha_mode': 'straight' if bitmap else 'premultiplied',
                 'dropped_channels': sorted(set(values) - set(names)),
                 'clipped_values': clipped, 'nonfinite_values': nonfinite})
    if exr:
        info['compression'] = compression
    return info


def preview_image(channels, channel='rgba', exposure=0, gamma=1, display='sRGB',
                  checker=True, max_size=(1280, 720), working_space='linear', color_config='', origin=(0, 0)):
    values, shape = _shape(channels)
    if not math.isfinite(float(exposure)) or not math.isfinite(float(gamma)) or float(gamma) <= 0:
        raise ValueError('viewer exposure must be finite and gamma positive')
    if len(max_size) != 2 or any(int(v) <= 0 for v in max_size):
        raise ValueError('max_size must be a positive width and height')
    if channel == 'luma':
        plane = sum((values[name] if name in values else np.zeros(shape, np.float32)) * np.float32(weight)
                    for name, weight in zip(_RGB, (.2126, .7152, .0722)))
        rgb = np.stack([plane, plane, plane], axis=-1)
        alpha = None
        data_channel = True
    elif channel in values:
        plane = values[channel]
        rgb = np.stack([plane, plane, plane], axis=-1)
        alpha = None
        data_channel = True
    else:
        layer = 'rgba' if channel in ('rgb', 'rgba', 'all') else str(channel)
        names = tuple(layer + '.' + part for part in ('red', 'green', 'blue'))
        if not any(name in values for name in names) and 'rgba.luma' not in values:
            raise ValueError(f'viewer channel or layer {channel!r} is absent')
        alpha_name = layer + '.alpha'
        luma = values.get('rgba.luma')
        rgb = np.stack([values[name] if name in values else
                        (luma if luma is not None else np.zeros(shape, np.float32))
                        for name in names], axis=-1)
        alpha = values.get(alpha_name)
        data_channel = False
    gain = np.float32(2.0 ** min(max(float(exposure), -50), 50))
    if gain != np.float32(1):
        rgb *= gain
    if checker and alpha is not None:
        yy, xx = np.ogrid[:shape[0], :shape[1]]
        # Compose the checker with premultiplied RGB in the working space;
        # additive RGB at alpha=0 remains visible.
        board = np.where((((xx + origin[0]) // 12 + (yy + origin[1]) // 12) % 2)[..., None], 0.05, 0.13).astype(np.float32)
        coverage = np.nan_to_num(np.clip(alpha, 0, 1), nan=0.0)[..., None]
        rgb = rgb + board * (1 - coverage)
    if not data_channel:
        rgb = _view_rgb(rgb, working_space, str(display), color_config)
    if float(gamma) != 1.0:
        rgb = np.maximum(rgb, 0) ** np.float32(1.0 / float(gamma))
    rgb = np.nan_to_num(rgb, copy=False, nan=0.0, posinf=1.0, neginf=0.0)
    result = Image.fromarray(np.rint(np.clip(rgb[::-1], 0, 1) * 255).astype(np.uint8))
    result.thumbnail(tuple(map(int, max_size)), Image.Resampling.LANCZOS)
    return result
