# Source provenance

`image_io.py` was adapted at the user's request from their `nuke-REA`
repository, commit `5488e18`, `outputs/nuke-compositor-v0.8/image_io.py`.
It retains the independent OIIO image reader, channel/window conventions,
CPU OCIO conversion, and atomic image writer. Windows-native dispatch was
removed. Explicit alpha association and nonzero full-window export were added. Invalid float PNG output now fails rather than silently selecting 8bit.

No Nuke binaries, SDK headers, decompiler output, private footage, or research
archives are included. The source repository has no LICENSE file; this notice
records provenance and does not assign a new license to the imported file.
Resolve that file's licensing before distributing it under okapi's MIT license.

`stream.py` adapts `packet` and `_display_bands` from the same v0.8
source; `frontend/src/frame-stream.js` adapts its progressive browser packet
reader. RGBA payloads use float32 instead of RGBA8. `bands.py` is a portable
implementation of the documented bottom-up Row/ROI and top-to-bottom progressive
evaluation convention, with blur halos and OIIO scanline output. The same source
license status applies to the adapted streaming components.
