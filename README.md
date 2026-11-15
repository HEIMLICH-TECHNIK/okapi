# okapi

Private LTX Alpha Gen workspace at `/okapi`. The app and the existing ComfyUI editor use the same ComfyUI queue on port 8188. The app listens only on localhost port 18769. It records job IDs and upload metadata in `~/services/okapi/jobs`; sources and matte clips live beneath `~/services/comfyui/data/input/okapi` and `~/services/comfyui/data/output/okapi`.

The graph uses the LTX-2.5 single-stage distilled video-to-video template with a blank prompt and the Alpha Gen adapter at strength 1. It pads spatial dimensions, repeats the last frame as needed to align to LTX frame counts, and trims the result to the source size and frame count. The output is a grayscale matte video for compositing.

Run `bash setup-models.sh` on the server after authenticating with `~/services/comfyui/.venv/bin/hf auth login` and accepting the LTX-2.5 model terms.

## Develop locally

The checkout in `Documents/Git/okapi` is the development copy. The initial snapshot includes the exact frontend served by production. Use Rust 1.100.0 with the `wasm32-unknown-unknown` target and wasm-bindgen CLI 0.2.126.

```sh
rustup toolchain install 1.100.0 --profile minimal --target wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.126 --locked
RUSTUP_TOOLCHAIN=1.100.0 bash frontend/build.sh --current
```

Run the local Python server with a venv containing `aiohttp` and `av`, then open `http://127.0.0.1:18769/okapi`. The source, output, and review endpoints require a local ComfyUI installation and local runtime data. For UI-only work the editor still opens without an attached engine.

## Deploy

Push changes to `main` to trigger the Deploy okapi workflow. It packages the frontend and backend at the same commit. The Linux runner labeled `okapi-hmlh` activates the artifact in `~/services/okapi` and checks the page and WebAssembly response. The workflow preserves uploaded media and job records. The activated Git revision is written to `~/services/okapi/DEPLOYED_REVISION`. See [deployment runs](https://github.com/HEIMLICH-TECHNIK/okapi/actions/workflows/deploy.yml).

Use the versioning rules in AGENTS.md before pushing a release. Keep this deployment repository private while it contains the Alpha Gen workflow and uses the self-hosted production runner.
