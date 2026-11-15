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
python="$HOME/services/comfyui/.venv/bin/python"
"$python" -m py_compile "$release/server.py" "$release/workflow.py" "$release/rerun_recording.py"

backend_changed=false
for file in server.py workflow.py rerun_recording.py; do
    if ! cmp -s "$file" "$release/$file"; then
        backend_changed=true
    fi
done

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
        batch = json.loads(p.read_text()).get("batch", {})
    except (FileNotFoundError, ValueError):
        continue
    if batch.get("state") in {"queued", "running", "joining"}:
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
cp -p --parents server.py workflow.py rerun_recording.py VERSION static/index.html static/review.html "$before"
rollback() {
    trap - ERR
    cp -a "$before/." .
    if "$backend_changed"; then systemctl --user restart okapi.service; fi
}
trap rollback ERR
rsync -a "$release/static/assets/" static/assets/
for file in server.py workflow.py rerun_recording.py VERSION static/review.html static/index.html; do
    install -m 0644 "$release/$file" "$file.deploy"
    mv -f "$file.deploy" "$file"
done
if "$backend_changed"; then systemctl --user restart okapi.service; fi
url=http://127.0.0.1:18769
curl --retry 10 --retry-connrefused --retry-delay 1 --max-time 2 -fsS "$url/" -o "$before/activated.html"
grep -Fq "content=\"$build\"" "$before/activated.html"
curl -fsSI "$url/assets/$build/okapi_bg.wasm" -o /dev/null
install -m 0644 "$release/REVISION" DEPLOYED_REVISION.new
mv -f DEPLOYED_REVISION.new DEPLOYED_REVISION
trap - ERR
rm -rf -- "$before"
printf 'Deployed okapi %s (%s)\n' "$(cat VERSION)" "$(cat DEPLOYED_REVISION)"
