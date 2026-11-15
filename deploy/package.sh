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
cp deploy/activate.sh "$release/"
cp static/index.html static/review.html "$release/static/"
rsync -a --exclude 'workspace-rust-*' static/assets/ "$release/static/assets/"
cp -R "static/assets/$build" "$release/static/assets/"
git rev-parse HEAD > "$release/REVISION"
