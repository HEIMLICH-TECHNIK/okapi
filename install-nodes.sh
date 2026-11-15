#!/usr/bin/env bash
set -euo pipefail
base="$HOME/services/comfyui"
uv="$HOME/studio-vllm/bin/uv"
cd "$HOME/services/okapi"
if [ ! -d LTXVideo/.git ]; then
  GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 https://github.com/Lightricks/ComfyUI-LTXVideo.git LTXVideo
fi
git -C LTXVideo rev-parse HEAD | grep -Fx ced6bad92b82f90028e1e1fd5a37527302550fc5
"$uv" pip freeze --python "$base/.venv/bin/python" > node-constraints.txt
"$uv" pip install --python "$base/.venv/bin/python" -c node-constraints.txt -r LTXVideo/requirements.txt
if [ ! -e "$base/data/custom_nodes/ComfyUI-LTXVideo" ]; then
  ln -s "$PWD/LTXVideo" "$base/data/custom_nodes/ComfyUI-LTXVideo"
fi
