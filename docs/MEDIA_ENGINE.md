# Precision media engine

The precision path preserves the uploaded file. It does not call the legacy
resize/H.264 preparation path. Images and video decode to named float32 planes;
CPU Blur, Mirror and Invert operate on those planes and Write creates float EXR
masters. Color interpretation and display conversion are separate operations.

Uploads stream to disk without an application byte-size limit or a fixed browser
upload timeout. File-type validation remains in place. Deployment proxies must
be configured separately; no remote proxy settings are changed by local tests.

## Color and precision contract

- OCIO 2.6.0 with selectable project configs. Builtin default:
  `studio-config-v2.2.0_aces-v1.3_ocio-v2.4`. External configs are registered
  through `OKAPI_OCIO_CONFIGS` (JSON name-to-path mapping);
  `OKAPI_DEFAULT_OCIO_CONFIG` selects the initial config. Installed Nuke configs
  can be referenced locally without copying their files into the distribution.
  Config/LUT content fingerprints are recorded with renders and display caches.
- Input space, working space and source alpha association are explicit. Untagged
  EXR/TIFF/video requires an input selection. Known OCIO/interoperability aliases
  and tagged Rec.709/PQ/HLG video are recognized. A tag is an interpretation,
  not a guarantee that the source was correctly tagged.
- Project Settings selects the OCIO config and Working Space (initially the
  config scene_linear role). Read properties select input space and alpha
  association; Viewer Process selects Display/View without changing node data.
  Write properties own delivery settings. Versions share project color settings.
- uint16, half and float inputs are decoded to float32. EXR masters retain
  negative and greater-than-one values and auxiliary channels. Raw/data mode
  bypasses RGB transforms and alpha association. RGB blur also blurs alpha;
  depth/normal/other auxiliary channels are not blurred as color. Mirror changes
  spatial positions for every channel.
- EXR data/display windows and nonzero full-window origins survive the float
  render and half/float sequence export. Multipart inputs are flattened into
  named channels; original part topology and arbitrary custom headers are not
  reconstructed. Deep/volume EXR is rejected.
- Half output rejects finite values outside ±65504. PNG float requests fail
  rather than silently becoming 8bit. ProRes 422 rejects nonopaque alpha.
- Numbered sequence uploads are sorted by actual frame number and gaps are
  rejected. They default to 24 fps; the sequence API accepts `?fps=24000/1001`.
  Original sequence numbers are retained in export names. Video source PTS and
  time base are retained; delivery timestamps are rebased to the first frame.

## Viewer

The server applies the OCIO display transform to a copy, then sends RGBA float32
pixels. It never uses the display payload as node input or output. The pixel
probe reads working-space planes, including values outside 0–1 and auxiliary
channels. Exposure changes only the Viewer.

The WebGPU path samples an unfilterable rgba32float texture into an rgba16float
canvas. Display/View comes from the project OCIO config. Compatible HDR configs
convert the selected display to P3/PQ, decode it to absolute luminance, and
convert to extended sRGB-encoded Display P3 with
203 nit reference white for the browser canvas. HDR needs a secure context,
WebGPU, a high-dynamic-range display report and extended canvas configuration.
Actual output luminance remains OS/browser/display dependent and needs physical
monitor validation; a successful configuration is not a calibration result.

Missing or lost GPU support uses an explicitly labeled SDR 8bit display
fallback. Masters and node buffers remain float32. Pan, zoom, fit, channels,
exposure, frame stepping/playback and source/output/A-B wipe are available.
Indexed source decoding uses actual PTS rather than frame/fps seek guesses.
The nuke-REA packet framing and ordered band conversion are adapted for float32
RGBA. Generic ROI evaluation and EXR scanline writes publish top-to-bottom bands
with accumulated blur halos and cancellation. Source planar cache: 256 MiB;
legacy full display cache: 64 MiB. Superseded browser requests abort old streams.

Playback uses native frame caches, independent of the display transform. Integer
sources retain their code values in RGBA16uint (including native YUV12 for the
ProRes test clip); half and float sources retain RGBA16float and RGBA32float.
The Viewer resolution selector offers 1:1, 1:2, 1:4, 1:8 and 1:64. Downsampling
changes spatial resolution, not component precision. No quality/codec preset is
used by this Viewer.

Playback starts at the current seek position. Missing frames stream ordered
scanlines from top to bottom, with a moving boundary at the completed rows.
The player waits for each completed frame before advancing. Completed frames
reuse a 1 GiB browser LRU cache, then a 32 GiB native disk cache under the saved
engine cache directory (`viewer-cache-v3`). RAM hits do not request pixels;
disk hits skip source decoding. Source identity, resolution and selected auxiliary
plane define the cache key. Input/Working/Viewer Process and exposure do not.
Legacy baked-movie endpoints remain for older clients, but this Viewer does not
call them.

OCIO generates the Input-to-Working and Working-to-Display/View GPU programs.
Naga translates the generated GLSL to WGSL. OCIO LUTs retain float32 precision;
the display canvas uses float16. Viewer Process and exposure redraw the existing
source texture without rebuilding the media cache. Physical HDR output still
requires validation on the target OS, browser and monitor.

The original Rerun 0.43.2 time panel supplies play, seek and loop selection.
Its TimePanelBlueprint is the source of truth for All/Selection/Off, selected
bounds, timeline and rate. Cold playback remains frame-by-frame within those
bounds; warm repetitions reuse cached frames. The cache strip and compact seek
bar show cached ranges and the current loading progress. A black surround and
an exterior white format outline keep overlays outside the image; the footer
shows format, bbox, channels, source precision, resolution and pointer coordinates.
Workspace geometry follows the actual browser rectangle on resize.

Local validation with the 4608×3164, 24 fps ProRes 4444 XQ clip: sampled YUV12
code values were bit exact at 1:8; warm playback measured 23.995 fps; changing
Viewer color caused no pixel refetch. The native Rerun selection 48–72 repeated
three times without leaving its bounds or requesting a cached frame twice.
These measurements do not establish full-resolution real-time playback on every
client. GPU display readback agreed with the CPU OCIO reference within 0.005
absolute for the tested SDR, HDR, integer YUV and 3D LUT cases.

References: [Foundry image caching](https://learn.foundry.com/nuke/13.2v4/content/getting_started/managing_scripts/image_caching.html),
[Foundry scanline reading](https://support.foundry.com/hc/en-us/articles/115001948030-Q100380-Reading-images-as-scanlines-and-the-network-access-impact),
[Rerun Viewer control](https://rerun.io/docs/howto/visualization/control-the-viewer).

## Write and jobs

- EXR ZIP: half or float, all channels, original frame numbers, manifest with
  source/color/render provenance. Unrestricted float RGBA masters stay on disk.
- ProRes MOV: 422 HQ, 4444, 4444 XQ; this encoder receives 10bit RGB/YUV data.
  A decoded 12bit pixel-format label does not imply 12bit source precision.
  4444/XQ support alpha; nonfinite/out-of-range delivery values fail explicitly.
  SDR, PQ and HLG output transforms and color tags are selected deliberately.
- FFV1 MKV: half16 or float32 RGB, version-4 experimental bitstream. Negative/HDR pixels
  round-trip without quantization for float32 in the tested build. Half output
  explicitly rounds to half precision and rejects finite overflow. Alpha is rejected rather
  than discarded; use EXR for float RGBA interchange. Check reader compatibility.
- Video delivery exports currently omit audio. The source audio remains intact.
- CPU jobs have bounded concurrency, progress, cancellation, unique output
  directories and temporary-file commits. Restarted jobs fail with a retry
  explanation; the source remains available. Color changes invalidate cached
  graph previews and block stale output use. Export does not modify masters.

Legacy jobs and their ComfyUI render/review routes remain readable. Alpha Gen
uses an SDR 8bit workflow and is rejected on new precision jobs until an explicit
model conversion/return adapter exists; it must not silently consume float/HDR
media. The broader typed multi-output DAG and new model nodes remain separate
work. GPU model services are not needed by the precision CPU engine.

## Local verification and deployment

```sh
uv venv --python 3.12 .local/venv
uv pip install --python .local/venv/bin/python -r requirements-media.txt
.local/venv/bin/python -m unittest discover -s tests -v
.local/venv/bin/python dev.py
bash frontend/build.sh --current
```

Headed browser smoke tests use `viewport: null` so the page follows the actual
Chrome window and native pixel density. Do not leave a fixed emulated viewport
on a user-facing test window: it can exceed the visible content area after a
window resize, clipping the timeline even when DOM containment checks pass.
Verify the native window bottom as well as the page screenshot.

The service uses its own `%h/services/okapi/.venv`, not the ComfyUI environment.
Prepare that environment with `requirements-media.txt` before activation. The
package includes media modules and tests; activation validates dependencies,
waits for active jobs, installs the unit and rolls code/unit back on failure.
Choose one minor release build for this change set after validation.

`media_core/PROVENANCE.md` identifies the imported nuke-REA components and its license
status. No Nuke binaries, SDK headers or decompiler artifacts are shipped.
