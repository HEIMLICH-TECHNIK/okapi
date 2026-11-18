mod graph;
mod viewer_slots;
mod workspace;

use gloo_net::http::{Request, Response};
use serde::de::DeserializeOwned;
use wasm_bindgen::prelude::*;
use web_sys::HtmlCanvasElement;

#[wasm_bindgen(module = "/src/browser.js")]
extern "C" {
    #[wasm_bindgen(js_name = bindBrowser)]
    fn bind_browser(callback: &js_sys::Function);
    #[wasm_bindgen(js_name = setFileEnabled)]
    fn set_file_enabled(enabled: bool);
    #[wasm_bindgen(js_name = setWorkspaceTyping)]
    fn set_workspace_typing(typing: bool);
    #[wasm_bindgen(js_name = chooseFile)]
    fn choose_file();
    #[wasm_bindgen(js_name = chooseWorkflow)]
    fn choose_workflow();
    #[wasm_bindgen(js_name = showWorkflow)]
    fn show_workflow(id: &str);
    #[wasm_bindgen(js_name = positionWorkflow)]
    fn position_workflow(x: f32, y: f32, width: f32, height: f32, zoom: f32);
    #[wasm_bindgen(js_name = removeWorkflow)]
    fn remove_workflow(id: &str);
    #[wasm_bindgen(js_name = connectJob)]
    fn connect_job(job: &str);
    #[wasm_bindgen(js_name = setMediaVisible)]
    fn set_media_visible(visible: bool);
    #[wasm_bindgen(js_name = setCompactViewer)]
    fn set_compact_viewer(compact: bool);
    #[wasm_bindgen(js_name = setTimeDisplay)]
    fn set_time_display(frames: bool, fps: f64, frame_count: u32);
    #[wasm_bindgen(js_name = setSoundEnabled)]
    fn set_sound_enabled(enabled: bool);
    #[wasm_bindgen(js_name = showAbout)]
    fn show_about();
    #[wasm_bindgen(js_name = positionProfile)]
    fn position_profile(x: f32, y: f32, width: f32, height: f32);
    #[wasm_bindgen(js_name = positionMedia)]
    fn position_media(x: f32, y: f32, width: f32, height: f32);
    #[wasm_bindgen(js_name = positionGraph)]
    fn position_graph(x: f32, y: f32, width: f32, height: f32);
    #[wasm_bindgen(js_name = showMedia)]
    fn show_media(job: &str, mode: &str, clip: &str);
    #[wasm_bindgen(js_name = fitViewer)]
    fn fit_viewer();
    #[wasm_bindgen(js_name = openDownload)]
    fn open_download(job: &str);
    #[wasm_bindgen(js_name = workspaceReady)]
    fn workspace_ready();
    #[wasm_bindgen(js_name = restoredWorkspace)]
    fn restored_workspace() -> String;
    #[wasm_bindgen(js_name = applyWorkspaceUpdate)]
    fn apply_workspace_update(workspace: &str);
}

async fn decode<T: DeserializeOwned>(response: Response) -> Result<T, String> {
    let status = response.status();
    if response.ok() {
        return response.json().await.map_err(|err| err.to_string());
    }
    let error = response.json::<serde_json::Value>().await.ok();
    Err(error
        .and_then(|value| value["error"].as_str().map(str::to_owned))
        .unwrap_or_else(|| format!("Request failed ({status}).")))
}

async fn request<T: DeserializeOwned>(path: &str) -> Result<T, String> {
    let response = Request::get(&format!("/okapi/api/{path}"))
        .send()
        .await
        .map_err(|err| err.to_string())?;
    decode(response).await
}

async fn new_version(job: &str) -> Result<String, String> {
    let response = Request::post(&format!("/okapi/api/jobs/{job}/versions"))
        .send()
        .await
        .map_err(|err| err.to_string())?;
    let value: serde_json::Value = decode(response).await?;
    value["id"]
        .as_str()
        .map(str::to_owned)
        .ok_or_else(|| "The new render could not be opened.".into())
}

async fn submit_graph(path: &str, settings: &graph::Settings) -> Result<serde_json::Value, String> {
    let response = Request::post(&format!("/okapi/api/{path}"))
        .json(settings)
        .map_err(|err| err.to_string())?
        .send()
        .await
        .map_err(|err| err.to_string())?;
    decode(response).await
}

#[wasm_bindgen]
pub async fn mount(canvas: HtmlCanvasElement) -> Result<(), JsValue> {
    let mut options = eframe::WebOptions::default();
    options.wgpu_options.wgpu_setup = wgpu_setup();
    eframe::WebRunner::new()
        .start(
            canvas,
            options,
            Box::new(|creation| Ok(Box::new(workspace::Workspace::new(&creation.egui_ctx)))),
        )
        .await
}

fn wgpu_setup() -> eframe::egui_wgpu::WgpuSetup {
    let mut options = eframe::egui_wgpu::WgpuSetupCreateNew::without_display_handle();
    options.instance_descriptor.backends = wgpu::Backends::GL;
    eframe::egui_wgpu::WgpuSetup::CreateNew(options)
}
