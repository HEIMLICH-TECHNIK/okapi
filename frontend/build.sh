#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

usage() {
    echo "Usage: bash frontend/build.sh [patch | minor | major --user-requested | --current]" >&2
    exit 2
}

version_file=../VERSION
version=$(cat "$version_file")
if [[ ! "$version" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
    echo "Invalid version in $version_file: $version" >&2
    exit 1
fi
IFS=. read -r major minor patch <<< "$version"
case "${*:-patch}" in
    patch) next_version="$major.$minor.$((patch + 1))" ;;
    minor) next_version="$major.$((minor + 1)).0" ;;
    'major --user-requested') next_version="$((major + 1)).0.0" ;;
    --current) next_version="$version" ;;
    *) usage ;;
esac

mkdir -p ../static/assets
stage=$(mktemp -d ../static/assets/.okapi-build.XXXXXX)
trap 'rm -rf "$stage"' EXIT
mkdir "$stage/assets"
cargo build --locked --release --target wasm32-unknown-unknown
"${WASM_BINDGEN_BIN:-wasm-bindgen}" --target web --no-typescript --out-name okapi --out-dir "$stage/assets" target/wasm32-unknown-unknown/release/okapi_workspace.wasm
cp src/fonts/InstrumentSerif-{OFL.txt,Regular.ttf} "$stage/assets/"
cp src/workflow-editor.{js,css} src/workflow-{diagnostics,graph}.js "$stage/assets/"

# Keep the asset ID numeric so already-open versions can detect the update.
build=$(python3 - "$next_version" "$stage/assets" <<'PY'
from hashlib import sha256
from pathlib import Path
from sys import argv

assets = Path(argv[2])
digest = sha256(argv[1].encode() + Path("index.html").read_bytes())
for path in sorted(assets.rglob("*")):
    if path.is_file():
        digest.update(path.relative_to(assets).as_posix().encode())
        digest.update(sha256(path.read_bytes()).digest())
print(f"workspace-rust-v1{int.from_bytes(digest.digest()[:8], 'big'):020d}")
PY
)
output="../static/assets/$build"
if [[ ! -d "$output" ]]; then
    gzip -kf "$stage/assets/okapi_bg.wasm"
    mv "$stage/assets" "$output"
fi
sed -e "s/__OKAPI_BUILD__/$build/g" -e "s/__OKAPI_VERSION__/$next_version/g" index.html > "$stage/index.html"
mv "$stage/index.html" ../static/index.html
if [[ "$next_version" != "$version" ]]; then
    printf '%s\n' "$next_version" > "$stage/VERSION"
    mv "$stage/VERSION" "$version_file"
fi
printf 'okapi %s (%s)\n' "$next_version" "$build"
