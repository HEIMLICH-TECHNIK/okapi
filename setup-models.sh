#!/usr/bin/env bash
set -euo pipefail
cd "$HOME/services/okapi"
python="$HOME/services/comfyui/.venv/bin/python"
"$python" - <<'PY'
from pathlib import Path
from huggingface_hub import get_hf_file_metadata, hf_hub_download, hf_hub_url

repo = "Lightricks/LTX-2.5"
files = [
    "diffusion_models/ltx-2.5-22b-distilled-transformer-bf16.safetensors",
    "text_encoders/gemma4-12b-with-proj-ltx-2.5-bf16.safetensors",
    "vae/ltx-2.5-video-vae-bf16.safetensors",
    "vae/ltx-2.5-audio-vae-bf16.safetensors",
]
for name in files:
    get_hf_file_metadata(hf_hub_url(repo, name))
home = Path.home()
models = home / "models" / "ltx-2.5"
library = home / "services/comfyui/data/models"
for name in files:
    print(f"Downloading {name}", flush=True)
    downloaded = Path(hf_hub_download(repo, name, local_dir=models))
    link = library / name
    link.parent.mkdir(parents=True, exist_ok=True)
    if not link.exists():
        link.symlink_to(downloaded)
print("LTX-2.5 weights are ready.", flush=True)
PY
