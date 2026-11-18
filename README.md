<p align="center">
  <img src="static/assets/okapi.png" width="128" alt="okapi logo">
</p>

<h1 align="center">okapi</h1>

<p align="center">
  <strong>A node-based video workspace powered by ComfyUI</strong><br>
  ComfyUI 기반의 노드형 영상 워크스페이스
</p>

<p align="center">
  <a href="#한국어">한국어</a> · <a href="#english">English</a> · <a href="#quick-start">Quick start · 빠른 시작</a>
</p>

## 한국어

**okapi**는 오픈소스 공개를 준비 중인 브라우저 기반 영상 워크스페이스입니다. 타임라인에서 작업할 구간을 고르고 노드 그래프에서 영상 처리 순서를 구성할 수 있습니다.

- **노드 그래프**에서 영상 입력과 블러, 좌우 반전, 반전 등의 효과를 연결합니다.
- **뷰어**에서 원본 영상과 처리 결과를 비교합니다.

브라우저 편집기는 Rust와 WebAssembly로 구현했습니다. Python 서버가 업로드와 렌더링 작업을 관리하고, ComfyUI가 노드 그래프를 실행해 영상을 렌더링합니다. okapi 자체 코드는 [MIT 라이선스](LICENSE)를 따릅니다.

## English

**okapi** is a browser-based video workspace being prepared for open-source release. Select a clip range on the timeline and build a processing chain in the node graph.

- **Node graph** connects footage input to effects such as blur, mirroring, and inversion.
- **Viewer** lets you compare the source footage with the result.

The browser editor is built with Rust and WebAssembly. A Python server handles uploads and render jobs, and ComfyUI executes the node graph to render video. The okapi source code is available under the [MIT License](LICENSE).

## Quick start

저장소에 포함된 프런트엔드 빌드로 로컬 편집기 UI를 열 수 있습니다. 영상을 렌더링하려면 ComfyUI 인스턴스에 연결해야 합니다.

Use the prebuilt frontend in the repository to open the editor UI locally. Rendering video requires a connection to a ComfyUI instance.

```sh
uv venv --python 3.12 .local/venv
uv pip install --python .local/venv/bin/python -r requirements-dev.txt
.local/venv/bin/python dev.py
```

브라우저에서 열기 · Open in your browser [http://127.0.0.1:18769/okapi/](http://127.0.0.1:18769/okapi/)

### ComfyUI workflows

**Node Editor → Import workflow**에서 ComfyUI JSON을 가져오세요. 그룹 노드의 `+`를 누르면 내부 배선과 그룹 포트를 편집할 수 있습니다. **Export JSON**으로 편집본을 저장하고 ComfyUI에서 실행할 수 있습니다.

Choose **Node Editor → Import workflow** to load a ComfyUI JSON file. Click `+` on the group node to edit its connections and exposed ports. Use **Export JSON** to save the edited workflow for execution in ComfyUI.

<details>
<summary>Frontend development · 프런트엔드 개발</summary>

프런트엔드를 다시 빌드하려면 Rust 1.100.0과 wasm-bindgen CLI 0.2.126이 필요합니다.

Rebuilding the frontend requires Rust 1.100.0 and wasm-bindgen CLI 0.2.126.

```sh
rustup toolchain install 1.100.0 --profile minimal --target wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.126 --locked
RUSTUP_TOOLCHAIN=1.100.0 bash frontend/build.sh --current
```

</details>
