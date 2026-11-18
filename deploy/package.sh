#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
release=${1:?Pass an empty release directory}
build=$(sed -n 's/^<meta name="okapi-build" content="\(workspace-rust-v[0-9]*\)">$/\1/p' static/index.html)
test -n "$build"
test -s "static/assets/$build/okapi_bg.wasm"
grep -Fq "name=\"okapi-version\" content=\"$(cat VERSION)\"" static/index.html
mkdir -p "$release/static/assets"
cp AGENTS.md README.md VERSION server.py workflow.py rerun_recording.py install-nodes.sh setup-models.sh node-constraints.txt source-workflow.json okapi.service "$release/"
cp requirements-{dev,media}.txt "$release/"
mkdir -p "$release/media_core" "$release/tests"
cp media_core/*.py media_core/PROVENANCE.md "$release/media_core/"
cp tests/test_precision_media.py "$release/tests/"
mkdir -p "$release/docs"
cp docs/MEDIA_ENGINE.md "$release/docs/"
cp deploy/activate.sh "$release/"
cp static/index.html static/review.html "$release/static/"
rsync -a --exclude 'workspace-rust-*' static/assets/ "$release/static/assets/"
cp -R "static/assets/$build" "$release/static/assets/"
git rev-parse HEAD > "$release/REVISION"
if [[ -n "$(git status --porcelain)" ]]; then
    printf '%s-dirty\n' "$(git rev-parse HEAD)" > "$release/REVISION"
fi
python3 - "$release" <<'PY'
from pathlib import Path
from hashlib import sha256
import json, sys
root = Path(sys.argv[1])
manifest = {p.relative_to(root).as_posix(): sha256(p.read_bytes()).hexdigest()
            for p in sorted(root.rglob('*')) if p.is_file()}
(root / 'SOURCE_MANIFEST.json').write_text(json.dumps(manifest, indent=2) + '\n')
PY
