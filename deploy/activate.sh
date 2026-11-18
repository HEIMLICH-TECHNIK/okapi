#!/usr/bin/env bash
set -euo pipefail
release=${1:?Pass a packaged release directory}
live=${OKAPI_LIVE_DIR:-$HOME/services/okapi}
cd "$live"
exec 9>.deploy.lock
flock 9
build=$(sed -n 's/^<meta name="okapi-build" content="\(workspace-rust-v[0-9]*\)">$/\1/p' "$release/static/index.html")
test -n "$build"
test -s "$release/static/assets/$build/okapi_bg.wasm"
grep -Fq "name=\"okapi-version\" content=\"$(cat "$release/VERSION")\"" "$release/static/index.html"
python="$live/.venv/bin/python"
"$python" -c 'import av, aiohttp, numpy, scipy, OpenImageIO, PyOpenColorIO; av.Codec("prores_ks", "w")'
"$python" -m py_compile "$release/server.py" "$release/workflow.py" "$release/rerun_recording.py"
files=(server.py workflow.py rerun_recording.py VERSION static/review.html static/index.html requirements-dev.txt requirements-media.txt docs/MEDIA_ENGINE.md SOURCE_MANIFEST.json)
for path in "$release"/media_core/*.py "$release/media_core/PROVENANCE.md"; do
    files+=("${path#"$release/"}")
done
unit="$HOME/.config/systemd/user/okapi.service"

backend_changed=false
for file in "${files[@]}"; do
    if ! cmp -s "$file" "$release/$file"; then
        backend_changed=true
    fi
done
if ! cmp -s "$unit" "$release/okapi.service"; then backend_changed=true; fi

if "$backend_changed"; then
    # Let queued renders and video preparation finish before replacing the process.
    ready=false
    for attempt in {1..120}; do
        pid=$(systemctl --user show -p MainPID --value okapi.service)
        queue=$(curl -fsS --max-time 2 http://127.0.0.1:8188/queue || true)
        if ! pgrep -P "$pid" -x ffmpeg >/dev/null &&
           "$python" -c '
import json, pathlib, sys
queue = json.loads(sys.argv[1]) if sys.argv[1] else {}
if queue.get("queue_running") or queue.get("queue_pending"):
    sys.exit(1)
for p in pathlib.Path("jobs").glob("*.json"):
    try:
        job = json.loads(p.read_text())
    except (FileNotFoundError, ValueError):
        continue
    for key in ("batch", "precision_render", "precision_export"):
        if job.get(key, {}).get("state") in {"queued", "running", "joining"}:
            sys.exit(1)
' "$queue"; then
            ready=true
            break
        fi
        sleep 5
    done
    if ! "$ready"; then
        echo 'okapi still has active jobs. Re-run deployment when they finish.' >&2
        exit 1
    fi
fi

before=$(mktemp -d .deploy-previous.XXXXXX)
for file in "${files[@]}"; do
    if [[ -f "$file" ]]; then cp -p --parents "$file" "$before"; else printf '%s\n' "$file" >> "$before/new-files"; fi
done
if [[ -f "$unit" ]]; then cp -p "$unit" "$before/unit.previous"; fi
rollback() {
    trap - ERR
    for file in "${files[@]}"; do
        if [[ -f "$before/$file" ]]; then cp -p "$before/$file" "$file"; fi
    done
    if [[ -f "$before/new-files" ]]; then
        while IFS= read -r file; do rm -f -- "$file"; done < "$before/new-files"
    fi
    if [[ -f "$before/unit.previous" ]]; then cp -p "$before/unit.previous" "$unit"; else rm -f "$unit"; fi
    systemctl --user daemon-reload
    if "$backend_changed"; then systemctl --user restart okapi.service; fi
}
trap rollback ERR
rsync -a "$release/static/assets/" static/assets/
for file in "${files[@]}"; do
    mkdir -p "$(dirname "$file")"
    install -m 0644 "$release/$file" "$file.deploy"
    mv -f "$file.deploy" "$file"
done
install -m 0644 "$release/okapi.service" "$unit"
systemctl --user daemon-reload
if "$backend_changed"; then systemctl --user restart okapi.service; fi
url=http://127.0.0.1:18769
curl --retry 10 --retry-connrefused --retry-delay 1 --max-time 2 -fsS "$url/" -o "$before/activated.html"
grep -Fq "content=\"$build\"" "$before/activated.html"
curl -fsSI "$url/assets/$build/okapi_bg.wasm" -o /dev/null
curl -fsS "$url/api/media/capabilities" -o "$before/media-capabilities.json"
install -m 0644 "$release/REVISION" DEPLOYED_REVISION.new
mv -f DEPLOYED_REVISION.new DEPLOYED_REVISION
trap - ERR
rm -rf -- "$before"
printf 'Deployed okapi %s (%s)\n' "$(cat VERSION)" "$(cat DEPLOYED_REVISION)"
