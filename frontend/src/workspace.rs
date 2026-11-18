use std::{cell::RefCell, rc::Rc, time::Duration};

use eframe::egui::{self, Align, Color32, Rect, RichText, Stroke, Ui, UiBuilder, Vec2, pos2, vec2};
use serde::{Deserialize, Serialize};
use wasm_bindgen::{JsCast, closure::Closure};
use wasm_bindgen_futures::spawn_local;

use crate::graph::{Graph, GraphView, Node, NodeKind, Settings};
use crate::set_compact_viewer;
use crate::viewer_slots::{CachedPreview, PreviewState, SLOT_COUNT, ViewerSlots, same_settings};
use crate::{
    apply_workspace_update, bind_browser, choose_file, connect_job, fit_viewer, new_version,
    open_download, open_media_properties, position_graph, position_media, position_profile,
    request, restored_workspace, set_file_enabled, set_media_visible, set_sound_enabled,
    set_time_display, set_workspace_geometry, set_workspace_typing, show_about, show_media, submit_graph, workspace_ready,
};

const AMBER: Color32 = Color32::from_rgb(139, 171, 255);
const MUTED: Color32 = Color32::from_gray(155);
const COMFYUI_URL: &str = "http://hmlh-server/comfyui/";

#[derive(Deserialize, Serialize)]
#[serde(default)]
struct LayoutPreferences {
    node_width: f32,
    node_viewer_height: f32,
    timeline_width: f32,
    timeline_viewer_height: f32,
    frame_display: bool,
    sound_enabled: bool,
}

impl Default for LayoutPreferences {
    fn default() -> Self {
        Self {
            node_width: 0.43,
            node_viewer_height: 0.62,
            timeline_width: 0.75,
            timeline_viewer_height: 0.62,
            frame_display: false,
            sound_enabled: false,
        }
    }
}

impl LayoutPreferences {
    fn restore() -> Self {
        let stored = web_sys::window()
            .and_then(|window| window.local_storage().ok().flatten())
            .and_then(|storage| storage.get_item("okapiLayout").ok().flatten());
        stored
            .as_deref()
            .and_then(|data| serde_json::from_str(data).ok())
            .unwrap_or_default()
    }

    fn save(&self) {
        if let Some(storage) =
            web_sys::window().and_then(|window| window.local_storage().ok().flatten())
            && let Ok(data) = serde_json::to_string(self)
        {
            let _ = storage.set_item("okapiLayout", &data);
        }
    }
}

#[derive(Deserialize)]
struct Engine {
    ready: bool,
    #[serde(default)]
    missing: Vec<String>,
}

#[derive(Deserialize)]
struct Size {
    width: u32,
    height: u32,
}

#[derive(Deserialize)]
struct Media {
    width: u32,
    height: u32,
    fps: f64,
    frames: u32,
}

#[derive(Deserialize)]
struct Upload {
    id: String,
    #[serde(flatten)]
    media: Media,
    original: Option<Size>,
    total_segments: u32,
    #[serde(default)]
    precision: Option<serde_json::Value>,
}

#[derive(Deserialize)]
struct Job {
    name: String,
    media: Media,
    original: Option<Size>,
    state: Phase,
    total_segments: u32,
    segment: Option<u32>,
    prompt: Option<String>,
    error: Option<String>,
    settings: Option<crate::graph::Settings>,
    #[serde(default)]
    precision: Option<serde_json::Value>,
}

#[derive(Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
enum Phase {
    Uploaded,
    Queued,
    Running,
    Joining,
    Complete,
    Failed,
}

#[derive(Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
enum Preview {
    Source,
    Compare,
    SourceVideo,
    MatteVideo,
}

#[derive(Deserialize, Serialize)]
struct WorkspaceSnapshot {
    job: String,
    node_mode: bool,
    settings_open: bool,
    preview: Preview,
    graph: GraphView,
    #[serde(default)]
    active_slot: Option<usize>,
    #[serde(default)]
    cached_previews: Vec<CachedPreview>,
}

#[derive(Deserialize)]
struct SlotHotkey {
    index: usize,
    bind_selected: bool,
}

impl Preview {
    fn key(self) -> &'static str {
        match self {
            Self::Source => "source",
            Self::Compare => "compare",
            Self::SourceVideo => "source-video",
            Self::MatteVideo => "matte-video",
        }
    }
}

enum Event {
    Browser(String, String),
    Engine(Result<Engine, String>),
    Submitted(Option<String>, Result<serde_json::Value, String>),
    Job(String, Result<Job, String>),
    PreviewSubmitted(u32, Settings, Result<String, String>),
    PreviewPolled(u32, String, Result<Job, String>),
}

pub struct Workspace {
    inbox: Rc<RefCell<Vec<Event>>>,
    _listener: Closure<dyn FnMut(String, String)>,
    logo: egui::TextureHandle,
    graph: Graph,
    slots: ViewerSlots,
    node_mode: bool,
    settings_open: bool,
    pending_update: bool,
    restore_preview: bool,
    layout: LayoutPreferences,
    result_is_matte: bool,
    precision_media: bool,
    full_settings: Option<Settings>,
    job: String,
    filename: String,
    phase: Phase,
    preview: Preview,
    media: Option<Media>,
    viewer_clock: String,
    original: Option<Size>,
    total_segments: u32,
    segment: u32,
    prompt: Option<String>,
    engine: Option<bool>,
    next_engine: f64,
    next_job: f64,
    polling: bool,
    uploading: bool,
    submitting: bool,
    upload_progress: f32,
    denoise_progress: Option<f32>,
    detail: String,
    notice: String,
}

impl Workspace {
    pub fn new(ctx: &egui::Context) -> Self {
        let mut visuals = egui::Visuals::dark();
        visuals.panel_fill = Color32::from_rgb(26, 27, 32);
        visuals.override_text_color = Some(Color32::from_rgb(209, 212, 223));
        visuals.window_fill = Color32::from_gray(49);
        visuals.extreme_bg_color = Color32::from_gray(26);
        visuals.selection.bg_fill = Color32::from_rgb(52, 69, 112);
        visuals.selection.stroke.color = AMBER;
        visuals.widgets.inactive.weak_bg_fill = Color32::from_gray(65);
        visuals.hyperlink_color = AMBER;
        visuals.widgets.inactive.bg_stroke = Stroke::new(1.0, Color32::from_gray(24));
        visuals.widgets.hovered.weak_bg_fill = Color32::from_gray(82);
        ctx.set_theme(egui::Theme::Dark);
        ctx.set_visuals(visuals);

        let mut fonts = egui::FontDefinitions::default();
        fonts.font_data.insert(
            "okapi".into(),
            egui::FontData::from_static(include_bytes!("fonts/InstrumentSerif-Regular.ttf")).into(),
        );
        fonts
            .families
            .insert(egui::FontFamily::Name("okapi".into()), vec!["okapi".into()]);
        ctx.set_fonts(fonts);
        let logo = image::load_from_memory(include_bytes!("../../static/assets/okapi.png"))
            .expect("valid bundled logo")
            .into_rgba8();
        let logo = ctx.load_texture(
            "okapi-symbol",
            egui::ColorImage::from_rgba_unmultiplied(
                [logo.width() as usize, logo.height() as usize],
                logo.as_raw(),
            ),
            egui::TextureOptions::LINEAR,
        );

        let inbox = Rc::new(RefCell::new(Vec::new()));
        let incoming = inbox.clone();
        let repaint = ctx.clone();
        let listener = Closure::new(move |kind: String, payload: String| {
            incoming.borrow_mut().push(Event::Browser(kind, payload));
            repaint.request_repaint();
        });
        bind_browser(listener.as_ref().unchecked_ref());
        let job = restored_job();
        let mut graph = Graph::restore();
        let mut slots = ViewerSlots::restore();
        if !slots.viewer.is_some_and(|node| graph.contains(node))
            && let Some(viewer) = graph.primary(NodeKind::Viewer)
        {
            slots.use_viewer(viewer);
        }
        let restored = serde_json::from_str::<WorkspaceSnapshot>(&restored_workspace())
            .ok()
            .filter(|state| state.job == job);
        let (node_mode, settings_open, preview, restore_preview) = match restored {
            Some(state) => {
                graph.restore_view(state.graph);
                slots.restore_cache(state.active_slot, state.cached_previews);
                (
                    state.node_mode,
                    state.settings_open,
                    state.preview,
                    !job.is_empty(),
                )
            }
            None => (false, false, Preview::Source, false),
        };
        workspace_ready();
        Self {
            inbox,
            _listener: listener,
            logo,
            graph,
            slots,
            node_mode,
            settings_open,
            pending_update: false,
            restore_preview,
            layout: LayoutPreferences::restore(),
            result_is_matte: false,
            precision_media: false,
            full_settings: None,
            job,
            filename: String::new(),
            phase: Phase::Uploaded,
            preview,
            media: None,
            viewer_clock: String::new(),
            original: None,
            total_segments: 1,
            segment: 1,
            prompt: None,
            engine: None,
            next_engine: 0.0,
            next_job: 0.0,
            polling: false,
            uploading: false,
            submitting: false,
            upload_progress: 0.0,
            denoise_progress: None,
            detail: String::new(),
            notice: String::new(),
        }
    }

    fn busy(&self) -> bool {
        self.uploading
            || self.submitting
            || (!self.job.is_empty() && self.media.is_none())
            || matches!(self.phase, Phase::Queued | Phase::Running | Phase::Joining)
    }

    fn can_run(&self, write: Option<Node>) -> bool {
        write
            .and_then(|node| self.graph.settings_for_write(node))
            .is_some_and(|settings| {
                !settings.operations.contains(&NodeKind::AlphaGen)
                    || (!self.precision_media && self.engine == Some(true))
            })
            && !self.busy()
            && self.media.is_some()
            && matches!(
                self.phase,
                Phase::Uploaded | Phase::Complete | Phase::Failed
            )
    }

    fn task<F>(&self, ctx: &egui::Context, work: F)
    where
        F: std::future::Future<Output = Event> + 'static,
    {
        let inbox = self.inbox.clone();
        let ctx = ctx.clone();
        spawn_local(async move {
            let event = work.await;
            inbox.borrow_mut().push(event);
            ctx.request_repaint();
        });
    }

    fn submit(&mut self, ctx: &egui::Context, write: Option<Node>) {
        if !self.can_run(write) {
            return;
        }
        let Some(settings) = write.and_then(|node| self.graph.settings_for_write(node)) else {
            return;
        };
        self.submitting = true;
        self.detail.clear();
        let previous = self.job.clone();
        let rerender = self.phase != Phase::Uploaded;
        self.task(ctx, async move {
            let job = if rerender {
                match new_version(&previous).await {
                    Ok(job) => job,
                    Err(error) => return Event::Submitted(None, Err(error)),
                }
            } else {
                previous
            };
            connect_job(&job);
            Event::Submitted(
                Some(job.clone()),
                submit_graph(&format!("jobs/{job}"), &settings).await,
            )
        });
    }

    fn browser_event(&mut self, kind: &str, payload: &str) {
        match kind {
            "workflow_import" | "workflow_updated" => {
                if let Ok(workflow) = serde_json::from_str(payload) {
                    self.graph
                        .update_workflow(workflow, kind == "workflow_import");
                }
            }
            "workflow_error" => {
                let message = serde_json::from_str(payload)
                    .unwrap_or_else(|_| "Workflow import failed.".into());
                self.graph.workflow_error(message);
            }
            "workflow_closed" => {
                if let Ok(id) = serde_json::from_str::<String>(payload) {
                    self.graph.close_workflow(&id);
                }
            }
            "workflow_pan" => {
                if let Ok(delta) = serde_json::from_str(payload) {
                    self.graph.pan_workflow(delta);
                }
            }
            "workflow_zoom" => {
                if let Ok(zoom) = serde_json::from_str(payload) {
                    self.graph.zoom_workflow(zoom);
                }
            }
            "upload_start" => {
                self.uploading = true;
                self.job.clear();
                self.slots.new_clip();
                self.full_settings = None;
                save_job_id("");
                self.media = None;
                self.original = None;
                self.phase = Phase::Uploaded;
                self.preview = Preview::Source;
                self.restore_preview = false;
                self.prompt = None;
                self.total_segments = 1;
                self.segment = 1;
                connect_job("");
                self.upload_progress = 0.0;
                self.detail.clear();
                self.notice.clear();
                self.filename = serde_json::from_str(payload).unwrap_or_default();
            }
            "upload_progress" => {
                self.upload_progress = serde_json::from_str(payload).unwrap_or(0.0)
            }
            "upload_done" => {
                self.uploading = false;
                if let Ok(upload) = serde_json::from_str::<Upload>(payload) {
                    self.precision_media = upload.precision.is_some();
                    self.job = upload.id;
                    save_job_id(&self.job);
                    self.media = Some(upload.media);
                    self.original = upload.original;
                    self.total_segments = upload.total_segments;
                    self.segment = 1;
                    self.phase = Phase::Uploaded;
                    self.preview = Preview::Source;
                    self.prompt = None;
                    self.denoise_progress = None;
                    self.next_job = 0.0;
                } else {
                    self.detail = "The server returned an unreadable upload response.".into();
                }
            }
            "upload_error" => {
                self.uploading = false;
                self.detail =
                    serde_json::from_str(payload).unwrap_or_else(|_| "Upload failed.".into());
                self.next_job = 0.0;
            }
            "preview_error" => self.notice = serde_json::from_str(payload).unwrap_or_default(),
            "media_color_changed" => {
                self.slots.new_clip();
                self.full_settings = None;
                self.notice =
                    "Source color settings changed. Render again to update the output.".into();
            }
            "viewer_clock" => {
                self.viewer_clock = serde_json::from_str(payload).unwrap_or_default();
            }
            "workspace_update" => self.pending_update = payload == "true",
            "engine" => self.engine_event(payload),
            _ => {}
        }
    }

    fn engine_event(&mut self, payload: &str) {
        let Ok(event) = serde_json::from_str::<serde_json::Value>(payload) else {
            return;
        };
        let data = &event["data"];
        if self.precision_media && data["job_id"].as_str() == Some(self.job.as_str()) {
            if let (Some(value), Some(max)) = (data["value"].as_f64(), data["max"].as_f64())
                && max > 0.0
            {
                self.denoise_progress = Some((value / max).clamp(0.0, 0.995) as f32);
            }
            if matches!(data["state"].as_str(), Some("complete" | "failed")) {
                self.next_job = 0.0;
            }
            return;
        }
        if !self.busy()
            || self.prompt.is_none()
            || data["prompt_id"].as_str() != self.prompt.as_deref()
        {
            return;
        }
        match event["type"].as_str() {
            Some("progress") if data["node"] == "denoise" => {
                if let (Some(value), Some(max)) = (data["value"].as_f64(), data["max"].as_f64())
                    && max > 0.0
                {
                    self.denoise_progress = Some((value / max).clamp(0.0, 0.995) as f32);
                }
            }
            Some("execution_success" | "execution_error" | "execution_interrupted") => {
                self.next_job = 0.0;
            }
            _ => {}
        }
    }

    fn apply_job(&mut self, job: Job) {
        self.precision_media = job.precision.is_some();
        let phase_before = self.phase;
        self.filename = job.name;
        self.media = Some(job.media);
        self.original = job.original;
        self.total_segments = job.total_segments.max(1);
        self.segment = job.segment.unwrap_or(1);
        if job.prompt != self.prompt {
            self.denoise_progress = None;
        }
        self.prompt = job.prompt;
        self.phase = job.state;
        self.result_is_matte = job.settings.as_ref().map_or(
            self.prompt.is_some() || self.phase == Phase::Complete,
            |settings| settings.operations.contains(&NodeKind::AlphaGen),
        );
        self.full_settings = job.settings;
        if phase_before == Phase::Uploaded && self.busy() {
            connect_job(&self.job);
        }
        if self.restore_preview {
            self.restore_preview = false;
            if self.phase != Phase::Complete
                && matches!(self.preview, Preview::Compare | Preview::MatteVideo)
            {
                self.preview = Preview::Source;
            }
        } else if phase_before != self.phase && self.phase == Phase::Complete {
            self.preview = Preview::Compare;
        }
        if !self.busy() {
            connect_job("");
        }
        if let Some(error) = job.error {
            self.detail = error;
        }
    }

    fn progress(&self) -> f32 {
        if self.uploading {
            return self.upload_progress;
        }
        match self.phase {
            Phase::Complete => 1.0,
            Phase::Joining => 0.99,
            Phase::Running | Phase::Queued => ((self.segment.saturating_sub(1) as f32
                + self.denoise_progress.unwrap_or(0.0))
                / self.total_segments.max(1) as f32)
                .min(0.99),
            _ => 0.0,
        }
    }

    fn status_text(&self) -> String {
        if self.uploading {
            return if self.upload_progress >= 1.0 {
                "Preparing clip…".into()
            } else {
                format!("Uploading · {:.0}%", self.upload_progress * 100.0)
            };
        }
        if self.submitting {
            return "Submitting to ComfyUI…".into();
        }
        let segment = if self.total_segments > 1 {
            format!(" · Segment {}/{}", self.segment, self.total_segments)
        } else {
            String::new()
        };
        match self.phase {
            Phase::Queued => format!("Queued{segment}"),
            Phase::Running => format!("Rendering{segment}"),
            Phase::Joining => "Joining output segments…".into(),
            Phase::Complete => "Output ready".into(),
            Phase::Failed => "Render failed".into(),
            Phase::Uploaded if self.media.is_some() => "Clip uploaded".into(),
            Phase::Uploaded if !self.job.is_empty() => "Restoring clip…".into(),
            Phase::Uploaded => "Choose a source clip".into(),
        }
    }

    fn header(&mut self, ui: &mut Ui) {
        ui.horizontal_centered(|ui| {
            ui.horizontal_centered(|ui| {
                ui.spacing_mut().item_spacing.x = 6.0;
                let (symbol, _) = ui.allocate_exact_size(vec2(27.0, 27.0), egui::Sense::hover());
                ui.painter().image(
                    self.logo.id(),
                    symbol.translate(vec2(0.0, 3.5)),
                    Rect::from_min_max(pos2(0.0, 0.0), pos2(1.0, 1.0)),
                    Color32::WHITE,
                );
                let wordmark = ui.painter().layout_no_wrap(
                    "okapi".into(),
                    egui::FontId::new(28.0, egui::FontFamily::Name("okapi".into())),
                    Color32::from_rgb(233, 224, 211),
                );
                let (wordmark_rect, _) =
                    ui.allocate_exact_size(wordmark.size(), egui::Sense::hover());
                ui.painter().galley(
                    wordmark_rect.min - vec2(0.0, 3.0),
                    wordmark,
                    Color32::from_rgb(233, 224, 211),
                );
            });
            ui.with_layout(egui::Layout::right_to_left(Align::Center), |ui| {
                if settings_button(ui, self.settings_open).clicked() {
                    self.settings_open = !self.settings_open;
                }
                if ui.button("About").clicked() {
                    show_about();
                }
                let profile_width = if ui.ctx().content_rect().width() < 480.0 {
                    66.0
                } else {
                    98.0
                };
                let (profile, _) =
                    ui.allocate_exact_size(vec2(profile_width, 25.0), egui::Sense::hover());
                position_profile(
                    profile.left(),
                    profile.top(),
                    profile.width(),
                    profile.height(),
                );
                if sound_button(ui, self.layout.sound_enabled).clicked() {
                    self.layout.sound_enabled = !self.layout.sound_enabled;
                    self.layout.save();
                }
                set_sound_enabled(self.layout.sound_enabled);
                let previous_display = self.layout.frame_display;
                egui::ComboBox::from_id_salt("time-display")
                    .selected_text(if previous_display {
                        "Frame"
                    } else {
                        "Timecode"
                    })
                    .width(86.0)
                    .show_ui(ui, |ui| {
                        ui.selectable_value(&mut self.layout.frame_display, true, "Frame");
                        ui.selectable_value(&mut self.layout.frame_display, false, "Timecode");
                    });
                if self.layout.frame_display != previous_display {
                    self.layout.save();
                }
                ui.separator();
                if ui
                    .selectable_label(self.node_mode && !self.settings_open, "Node Editor")
                    .clicked()
                {
                    self.node_mode = true;
                    self.settings_open = false;
                }
                if ui
                    .selectable_label(!self.node_mode && !self.settings_open, "Timeline")
                    .clicked()
                {
                    self.node_mode = false;
                    self.settings_open = false;
                }
            });
        });
    }

    fn properties_panel(&mut self, ui: &mut Ui) {
        ui.spacing_mut().item_spacing.y = 3.0;
        ui.strong("Properties");
        ui.separator();
        egui::ScrollArea::vertical()
            .id_salt("properties")
            .auto_shrink([false, false])
            .show(ui, |ui| {
                if std::mem::take(&mut self.graph.properties_scroll_to_top) {
                    ui.scroll_to_cursor(Some(Align::Min));
                }
                let editable = !self.busy();
                self.graph.dot_controls(ui, editable, &mut self.slots);
                for (index, mut panel) in self.graph.properties.clone().into_iter().enumerate() {
                    let kind = panel.node;
                    if index > 0 {
                        ui.separator();
                    }
                    ui.push_id(("node-properties", kind), |ui| {
                        let mut close = false;
                        ui.horizontal(|ui| {
                            let indicator = if panel.expanded { "-" } else { "+" };
                            if ui.add(egui::Button::new(indicator).frame(false)).clicked() {
                                panel.expanded = !panel.expanded;
                            }
                            let edit_id = ui.id().with("node-name");
                            if let Some(mut draft) =
                                ui.ctx().data_mut(|data| data.get_temp::<String>(edit_id))
                            {
                                let field = ui.add(
                                    egui::TextEdit::singleline(&mut draft)
                                        .id(edit_id)
                                        .char_limit(64)
                                        .desired_width(160.0),
                                );
                                let (confirm, cancel) = ui.input(|input| {
                                    (
                                        input.key_pressed(egui::Key::Enter),
                                        input.key_pressed(egui::Key::Escape),
                                    )
                                });
                                let keep_editing = !cancel
                                    && (!(confirm || field.lost_focus())
                                        || !self.graph.rename(kind, &draft));
                                if keep_editing {
                                    ui.ctx().data_mut(|data| data.insert_temp(edit_id, draft));
                                    if confirm {
                                        field.request_focus();
                                    }
                                } else {
                                    ui.ctx().data_mut(|data| data.remove::<String>(edit_id));
                                }
                            } else {
                                let name = self.graph.name(kind);
                                let color = if kind.kind == NodeKind::AlphaGen {
                                    Color32::from_rgb(172, 168, 255)
                                } else {
                                    kind.accent()
                                };
                                let title = RichText::new(&name).strong().color(color);
                                let label = ui
                                    .add(egui::Button::new(title).frame_when_inactive(false))
                                    .on_hover_cursor(egui::CursorIcon::Text)
                                    .on_hover_text("Double-click to rename");
                                if label.double_clicked() {
                                    ui.ctx().data_mut(|data| data.insert_temp(edit_id, name));
                                    ui.memory_mut(|memory| memory.request_focus(edit_id));
                                }
                            }
                            ui.with_layout(egui::Layout::right_to_left(Align::Center), |ui| {
                                close = ui
                                    .add(egui::Button::new("×").frame(false))
                                    .on_hover_text("Close properties")
                                    .clicked();
                            });
                        });
                        if close {
                            self.graph.properties.retain(|open| open.node != kind);
                            return;
                        }
                        if let Some(open) = self
                            .graph
                            .properties
                            .iter_mut()
                            .find(|open| open.node == kind)
                        {
                            open.expanded = panel.expanded;
                        }
                        if panel.expanded {
                            self.graph
                                .node_controls(ui, kind, editable, &mut self.slots);
                            match kind.kind {
                                NodeKind::Source => self.source_controls(ui),
                                NodeKind::Output => self.render_controls(ui, Some(kind)),
                                NodeKind::AlphaGen if self.graph.has_warning(kind) => {
                                    ui.horizontal_wrapped(|ui| {
                                        if ui.button("Recheck ComfyUI").clicked() {
                                            self.next_engine = 0.0;
                                        }
                                        ui.add(
                                            egui::Hyperlink::from_label_and_url(
                                                "Open ComfyUI ↗",
                                                COMFYUI_URL,
                                            )
                                            .open_in_new_tab(true),
                                        );
                                    });
                                }
                                _ => {}
                            }
                        }
                    });
                }
            });
    }

    fn clip_panel(&mut self, ui: &mut Ui) {
        ui.strong("Clip & Render");
        ui.separator();
        egui::ScrollArea::vertical()
            .id_salt("clip-render")
            .auto_shrink([false, false])
            .show(ui, |ui| {
                ui.strong("Source clip");
                self.source_controls(ui);
                ui.add_space(9.0);
                self.render_controls(ui, None);
            });
    }

    fn source_controls(&self, ui: &mut Ui) {
        ui.horizontal(|ui| {
            if ui
                .add_enabled(!self.busy(), egui::Button::new("Browse…"))
                .clicked()
            {
                choose_file();
            }
            ui.label(
                egui::RichText::new(if self.filename.is_empty() {
                    "No clip selected"
                } else {
                    &self.filename
                })
                .size(12.0),
            );
        });
        if self.precision_media && ui.button("Read color settings…").clicked() {
            open_media_properties(&self.job, "read");
        }
        if let Some(media) = &self.media {
            ui.label(
                RichText::new(format!(
                    "{} × {}  ·  {}f  ·  {:.3} fps",
                    media.width, media.height, media.frames, media.fps
                ))
                .monospace()
                .size(12.0),
            );
            if let Some(original) = &self.original {
                ui.label(
                    RichText::new(format!(
                        "Resized from {} × {}",
                        original.width, original.height
                    ))
                    .color(MUTED)
                    .size(11.0),
                );
            }
            if self.total_segments > 1 {
                ui.label(
                    RichText::new(format!("{} segments · one MP4", self.total_segments))
                        .color(MUTED)
                        .size(11.0),
                );
            }
        } else {
            ui.label(
                RichText::new("Original resolution · float IO")
                    .color(MUTED)
                    .size(11.0),
            );
        }
    }

    fn render_controls(&mut self, ui: &mut Ui, write: Option<Node>) {
        let write = write.or_else(|| self.graph.primary(NodeKind::Output));
        if self.precision_media
            && write
                .and_then(|node| self.graph.settings_for_write(node))
                .is_some_and(|settings| settings.operations.contains(&NodeKind::AlphaGen))
        {
            ui.label(RichText::new("Alpha Gen requires an explicit SDR model adapter. Float Read, Blur, Mirror, Invert and Write are available.").color(AMBER));
        }
        if ui
            .add_enabled(
                self.can_run(write),
                egui::Button::new(
                    RichText::new(if matches!(self.phase, Phase::Complete | Phase::Failed) {
                        "▶  Render again"
                    } else {
                        "▶  Run workflow"
                    })
                    .strong()
                    .color(AMBER),
                )
                .fill(Color32::from_rgb(45, 57, 87))
                .min_size(vec2(ui.available_width(), 29.0)),
            )
            .clicked()
        {
            self.submit(ui.ctx(), write);
        }
        if write
            .and_then(|node| self.graph.settings_for_write(node))
            .is_none()
        {
            let message = if self
                .graph
                .primary(NodeKind::Source)
                .is_some_and(|node| self.graph.is_disabled(node))
            {
                "Read is disabled."
            } else if write.is_some_and(|node| self.graph.is_disabled(node)) {
                "Write is disabled."
            } else {
                "Connect Read to Write."
            };
            ui.label(RichText::new(message).color(MUTED));
        }
        ui.label(RichText::new("Render Status").strong());
        ui.label(self.status_text());
        ui.add(
            egui::ProgressBar::new(self.progress())
                .fill(AMBER)
                .desired_height(9.0),
        );
        if !self.detail.is_empty() {
            ui.label(RichText::new(&self.detail).color(AMBER));
        }
        if self.phase == Phase::Complete
            && ui
                .button(if self.precision_media {
                    "Export EXR / ProRes / float video"
                } else if self.result_is_matte {
                    "Download matte"
                } else {
                    "Download video"
                })
                .clicked()
        {
            open_download(&self.job);
        }
    }

    fn select_viewer_slot(&mut self, index: usize, bind_selected: bool, ctx: &egui::Context) {
        if self.settings_open || index >= SLOT_COUNT {
            return;
        }
        if bind_selected
            && self.node_mode
            && let Some(node) = self.graph.selection()
        {
            let viewer = self
                .slots
                .viewer
                .filter(|&node| self.graph.contains(node))
                .unwrap_or_else(|| self.graph.ensure_viewer());
            self.slots.use_viewer(viewer);
            self.slots.bind(index, Some(node));
        }
        self.slots.active = Some(index);
        self.notice.clear();
        self.render_viewer_slot(ctx);
    }

    fn full_render_matches(&self, settings: &Settings) -> bool {
        if self.submitting || self.phase == Phase::Failed {
            return false;
        }
        self.full_settings
            .as_ref()
            .is_some_and(|current| same_settings(current, settings))
    }

    fn can_preview(&self, settings: &Settings) -> bool {
        self.media.is_some()
            && !self.uploading
            && !self.submitting
            && (!settings.operations.contains(&NodeKind::AlphaGen)
                || (!self.precision_media && self.engine == Some(true)))
            && !self.full_render_matches(settings)
            && self.slots.in_flight() < SLOT_COUNT
            && !matches!(
                self.slots.state(settings),
                Some(
                    PreviewState::Submitting
                        | PreviewState::Pending { .. }
                        | PreviewState::Ready(_)
                )
            )
    }

    fn render_viewer_slot(&mut self, ctx: &egui::Context) {
        if self
            .slots
            .viewer
            .is_some_and(|node| self.graph.is_disabled(node))
        {
            return;
        }
        let target = self
            .slots
            .active
            .and_then(|index| self.slots.bindings[index]);
        let Some(settings) = target.and_then(|node| self.graph.settings_through(node)) else {
            return;
        };
        if settings.operations.is_empty() || !self.can_preview(&settings) {
            return;
        }
        self.slots.start(settings.clone());
        let source = self.job.clone();
        let generation = self.slots.generation;
        self.task(ctx, async move {
            let result = async {
                let preview = new_version(&source).await?;
                submit_graph(&format!("jobs/{preview}"), &settings).await?;
                Ok(preview)
            }
            .await;
            Event::PreviewSubmitted(generation, settings, result)
        });
    }

    fn poll_previews(&mut self, time: f64, ctx: &egui::Context) {
        let generation = self.slots.generation;
        let jobs: Vec<_> = self
            .slots
            .renders
            .iter_mut()
            .filter_map(|entry| {
                let PreviewState::Pending {
                    job,
                    next_poll,
                    polling,
                    ..
                } = &mut entry.state
                else {
                    return None;
                };
                if *polling || time < *next_poll {
                    return None;
                }
                *polling = true;
                Some(job.clone())
            })
            .collect();
        for job in jobs {
            self.task(ctx, async move {
                let result = request(&format!("jobs/{job}")).await;
                Event::PreviewPolled(generation, job, result)
            });
        }
    }

    fn settings(&mut self, ui: &mut Ui) {
        ui.set_max_width(490.0);
        ui.add_space(8.0);
        ui.heading("Settings");
        ui.separator();
        ui.add_space(8.0);
        ui.label(RichText::new("Project Color Management").strong());
        if ui
            .add_enabled(
                self.precision_media,
                egui::Button::new("OCIO config and Working Space…"),
            )
            .clicked()
        {
            open_media_properties(&self.job, "project");
        }
        ui.add_space(8.0);
        ui.label(RichText::new("Workspace").strong());
        ui.add_space(6.0);
        ui.label(RichText::new("Drag a panel boundary to resize it.").color(MUTED));
        if ui.button("Reset panel sizes").clicked() {
            self.layout = LayoutPreferences::default();
            self.layout.save();
        }
        ui.add_space(10.0);
        ui.separator();
        ui.horizontal(|ui| {
            ui.label("Fit Viewer");
            ui.label(RichText::new("H").monospace().color(AMBER));
        });
        ui.horizontal(|ui| {
            ui.label("Connect selected node to Viewer");
            ui.label(RichText::new("1–5").monospace().color(AMBER));
        });
        ui.add_space(12.0);
        if ui.button("Back to workspace").clicked() {
            self.settings_open = false;
        }
    }

    fn viewer(&mut self, ui: &mut Ui, body: Rect) {
        ui.horizontal(|ui| {
            ui.label(RichText::new("Viewer").size(12.0).color(MUTED));
            ui.separator();
            if ui
                .selectable_label(
                    self.slots.active.is_none() && self.preview == Preview::Source,
                    "Source",
                )
                .clicked()
            {
                self.preview = Preview::Source;
                self.slots.active = None;
                self.notice.clear();
            }
            if ui
                .add_enabled(
                    self.phase == Phase::Complete,
                    egui::Button::selectable(
                        self.slots.active.is_none() && self.preview == Preview::Compare,
                        "Compare",
                    ),
                )
                .clicked()
            {
                self.preview = Preview::Compare;
                self.slots.active = None;
                self.notice.clear();
            }
            if ui
                .selectable_label(
                    self.slots.active.is_none()
                        && matches!(self.preview, Preview::SourceVideo | Preview::MatteVideo),
                    "Video",
                )
                .clicked()
            {
                self.preview = if self.phase == Phase::Complete {
                    Preview::MatteVideo
                } else {
                    Preview::SourceVideo
                };
                self.slots.active = None;
                self.notice.clear();
            }
            if ui.button("Fit").on_hover_text("Fit Viewer (H)").clicked() {
                fit_viewer();
            }
            if !self.node_mode && !self.viewer_clock.is_empty() && ui.available_width() >= 98.0 {
                ui.separator();
                ui.label(RichText::new(&self.viewer_clock).monospace().color(MUTED));
            }
            if !self.notice.is_empty() {
                ui.label(RichText::new(&self.notice).color(AMBER).size(11.0));
            }
        });
        ui.horizontal(|ui| {
            let width = ((ui.available_width() - ui.spacing().item_spacing.x * 4.0)
                / SLOT_COUNT as f32)
                .clamp(15.0, 24.0);
            for index in 0..SLOT_COUNT {
                let node = self.slots.bindings[index];
                let number = (index + 1).to_string();
                let label = RichText::new(&number).monospace().color(if node.is_some() {
                    AMBER
                } else {
                    MUTED
                });
                let slot = ui
                    .add(
                        egui::Button::selectable(self.slots.active == Some(index), label)
                            .min_size(vec2(width, 18.0)),
                    )
                    .on_hover_text(node.map_or_else(
                        || format!("Select a node and press {number} to connect Viewer {number}"),
                        |node| format!("Viewer {number} · {}", self.graph.name(node)),
                    ));
                if slot.clicked() {
                    if self.slots.active == Some(index) {
                        self.slots.active = None;
                    } else {
                        self.select_viewer_slot(index, false, ui.ctx());
                    }
                }
            }
            if let Some(index) = self.slots.active {
                ui.separator();
                if let Some(node) = self.slots.bindings[index] {
                    if ui
                        .small_button("×")
                        .on_hover_text("Disconnect Viewer slot")
                        .clicked()
                    {
                        self.slots.bind(index, None);
                        self.slots.active = None;
                    }
                    ui.label(RichText::new(self.graph.name(node)).color(MUTED));
                }
            }
        });
        let stage = Rect::from_min_max(
            pos2(body.left() + 6.0, body.top() + 58.0),
            body.max - vec2(6.0, 6.0),
        );
        ui.painter().rect_filled(stage, 0, Color32::from_gray(19));
        let mode = self.preview.key();
        let graph_viewer = self.node_mode || self.slots.active.is_some();
        let (shown, mode, message, can_preview) = if graph_viewer
            && self
                .slots
                .viewer
                .is_some_and(|node| self.graph.is_disabled(node))
        {
            ("", mode, "Viewer is disabled.".into(), false)
        } else if graph_viewer
            && self
                .graph
                .primary(NodeKind::Source)
                .is_some_and(|node| self.graph.is_disabled(node))
        {
            ("", mode, "Read is disabled.".into(), false)
        } else if let Some(index) = self.slots.active {
            self.slot_content(index)
        } else {
            (self.job.as_str(), mode, String::new(), false)
        };
        position_media(stage.left(), stage.top(), stage.width(), stage.height());
        if let Some(media) = &self.media {
            set_time_display(self.layout.frame_display, media.fps, media.frames);
        }
        set_compact_viewer(self.node_mode);
        show_media(
            if self.media.is_some() { shown } else { "" },
            mode,
            &self.job,
        );
        if self.media.is_none() && message.is_empty() {
            let button = Rect::from_center_size(stage.center(), vec2(190.0, 42.0));
            if ui
                .put(button, egui::Button::new("↑  Choose a source clip"))
                .clicked()
                && !self.busy()
            {
                choose_file();
            }
            ui.painter().text(
                stage.center() + vec2(0.0, 37.0),
                egui::Align2::CENTER_CENTER,
                "Or drop a video here",
                egui::FontId::proportional(12.0),
                MUTED,
            );
        } else if shown.is_empty() {
            ui.painter().text(
                stage.center() - vec2(0.0, if can_preview { 17.0 } else { 0.0 }),
                egui::Align2::CENTER_CENTER,
                message,
                egui::FontId::proportional(13.0),
                MUTED,
            );
            if can_preview
                && ui
                    .put(
                        Rect::from_center_size(stage.center() + vec2(0.0, 14.0), vec2(125.0, 24.0)),
                        egui::Button::new("Render preview"),
                    )
                    .clicked()
            {
                self.render_viewer_slot(ui.ctx());
            }
        }
    }

    fn slot_content(&self, index: usize) -> (&str, &'static str, String, bool) {
        let empty = |message: String, retry| ("", "output", message, retry);
        let Some(node) = self.slots.bindings[index] else {
            return empty(
                format!("Select a node and press {} to connect it", index + 1),
                false,
            );
        };
        if !self.graph.contains(node) {
            return empty("The connected node was removed.".into(), false);
        }
        let Some(settings) = self.graph.settings_through(node) else {
            return empty("Connect this node to Read.".into(), false);
        };
        if settings.operations.is_empty() {
            return (&self.job, "source", String::new(), false);
        }
        if self.full_render_matches(&settings) {
            return if self.phase == Phase::Complete {
                (&self.job, "output", String::new(), false)
            } else {
                empty(self.status_text(), false)
            };
        }
        match self.slots.state(&settings) {
            Some(PreviewState::Ready(job)) => (job.as_str(), "output", String::new(), false),
            Some(PreviewState::Submitting) => empty("Queuing node preview…".into(), false),
            Some(PreviewState::Pending { status, .. }) => empty(status.clone(), false),
            Some(PreviewState::Failed(error)) => empty(error.clone(), self.can_preview(&settings)),
            None if settings.operations.contains(&NodeKind::AlphaGen)
                && self.engine == Some(false) =>
            {
                empty("LTX models are unavailable.".into(), false)
            }
            None => empty(
                "Preview this node with the current settings.".into(),
                self.can_preview(&settings),
            ),
        }
    }
}

impl eframe::App for Workspace {
    fn logic(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        let extent = ctx.content_rect().size();
        set_workspace_geometry(extent.x, extent.y);
        let time = ctx.input(|input| input.time);
        let events = std::mem::take(&mut *self.inbox.borrow_mut());
        for event in events {
            match event {
                Event::Browser(kind, payload) if kind == "viewer_slot" => {
                    if let Ok(key) = serde_json::from_str::<SlotHotkey>(&payload) {
                        self.select_viewer_slot(key.index, key.bind_selected, ctx);
                    }
                }
                Event::Browser(kind, payload) if kind == "graph_shortcut" => {
                    if self.node_mode
                        && !self.settings_open
                        && let Ok(command) = serde_json::from_str::<String>(&payload)
                    {
                        self.graph.shortcut(command);
                    }
                }
                Event::Browser(kind, payload) if kind == "elbow_modifier" => {
                    self.graph.elbow_modifier = payload == "true";
                }
                Event::Browser(kind, payload) if kind == "viewer_cycle" => {
                    if let Ok(direction) = serde_json::from_str::<i32>(&payload) {
                        let start = self.slots.active.unwrap_or(if direction > 0 {
                            SLOT_COUNT - 1
                        } else {
                            0
                        });
                        for step in 1..=SLOT_COUNT {
                            let index = (start as i32 + step as i32 * direction)
                                .rem_euclid(SLOT_COUNT as i32)
                                as usize;
                            if self.slots.bindings[index].is_some() {
                                self.select_viewer_slot(index, false, ctx);
                                break;
                            }
                        }
                    }
                }
                Event::Browser(kind, payload) => self.browser_event(&kind, &payload),
                Event::Engine(result) => {
                    self.engine = result.as_ref().ok().map(|engine| engine.ready);
                    let messages = match result {
                        Ok(engine) => engine
                            .missing
                            .into_iter()
                            .map(|name| format!("Required model or node unavailable: {name}"))
                            .collect(),
                        Err(error) => vec![error],
                    };
                    self.graph.set_engine_warnings(messages);
                }
                Event::Submitted(job, result) => {
                    self.submitting = false;
                    if let Some(id) = job
                        && id != self.job
                    {
                        self.job = id;
                        save_job_id(&self.job);
                        self.preview = Preview::Source;
                        self.phase = Phase::Uploaded;
                        self.prompt = None;
                        self.denoise_progress = None;
                        self.segment = 1;
                        self.next_job = 0.0;
                    }
                    match result {
                        Ok(value) => {
                            self.prompt = value["prompt"].as_str().map(str::to_owned);
                            self.phase = Phase::Queued;
                            self.next_job = 0.0;
                        }
                        Err(error) => {
                            connect_job("");
                            self.detail = error;
                        }
                    }
                }
                Event::Job(id, result) => {
                    self.polling = false;
                    if id != self.job || self.uploading {
                        continue;
                    }
                    match result {
                        Ok(job) => self.apply_job(job),
                        Err(error) => {
                            self.detail = error;
                            if self.media.is_none() {
                                self.job.clear();
                                save_job_id("");
                            }
                        }
                    }
                }
                Event::PreviewSubmitted(generation, settings, result) => {
                    if generation != self.slots.generation {
                        continue;
                    }
                    if let Some(entry) = self
                        .slots
                        .renders
                        .iter_mut()
                        .find(|entry| entry.settings == settings)
                    {
                        entry.state = match result {
                            Ok(job) => PreviewState::Pending {
                                job,
                                next_poll: 0.0,
                                polling: false,
                                status: "Node preview queued…".into(),
                            },
                            Err(error) => PreviewState::Failed(error),
                        };
                    }
                }
                Event::PreviewPolled(generation, preview_job, result) => {
                    if generation != self.slots.generation {
                        continue;
                    }
                    if let Some(entry) = self.slots.renders.iter_mut().find(|entry| {
                        matches!(&entry.state, PreviewState::Pending { job, .. } if *job == preview_job)
                    }) {
                        entry.state = match result {
                            Ok(job) if job.state == Phase::Complete => PreviewState::Ready(preview_job),
                            Ok(job) if job.state == Phase::Failed => PreviewState::Failed(
                                job.error.unwrap_or_else(|| "Node preview failed.".into())
                            ),
                            result => {
                                let status = match result.map(|job| job.state) {
                                    Ok(Phase::Queued | Phase::Uploaded) => "Node preview queued…",
                                    Ok(Phase::Joining) => "Joining preview segments…",
                                    Ok(_) => "Rendering node preview…",
                                    Err(_) => "Reconnecting to preview…",
                                };
                                PreviewState::Pending {
                                    job: preview_job, next_poll: time + 1.5, polling: false, status: status.into()
                                }
                            }
                        };
                    }
                }
            }
        }
        self.poll_previews(time, ctx);
        if time >= self.next_engine {
            self.next_engine = time + 20.0;
            self.task(ctx, async { Event::Engine(request("status").await) });
        }
        if !self.polling
            && !self.uploading
            && !self.submitting
            && !self.job.is_empty()
            && time >= self.next_job
        {
            self.next_job = time + if self.busy() { 2.0 } else { 20.0 };
            self.polling = true;
            let id = self.job.clone();
            self.task(ctx, async move {
                Event::Job(id.clone(), request(&format!("jobs/{id}")).await)
            });
        }
        set_file_enabled(!self.busy());
        if self.pending_update
            && !self.busy()
            && self.slots.in_flight() == 0
            && !ctx.input(|input| input.pointer.any_down())
            && let Ok(state) = serde_json::to_string(&WorkspaceSnapshot {
                job: self.job.clone(),
                node_mode: self.node_mode,
                settings_open: self.settings_open,
                preview: self.preview,
                graph: self.graph.view(),
                active_slot: self.slots.active,
                cached_previews: self.slots.cached(),
            })
        {
            apply_workspace_update(&state);
        }
        ctx.request_repaint_after(Duration::from_secs(
            if self.busy() || self.slots.in_flight() > 0 {
                1
            } else {
                4
            },
        ));
    }

    fn ui(&mut self, ui: &mut Ui, _frame: &mut eframe::Frame) {
        let root = ui.max_rect();
        ui.painter()
            .rect_filled(root, 0, Color32::from_rgb(18, 19, 23));
        let header = Rect::from_min_size(root.min, vec2(root.width(), 40.0));
        self.header(&mut panel(ui, header, "header"));
        let footer = Rect::from_min_max(pos2(root.left(), root.bottom() - 26.0), root.max);
        panel(ui, footer, "footer").horizontal_centered(|ui| {
            let state = match self.engine {
                Some(true) => "ComfyUI · Ready",
                Some(false) => "ComfyUI · Unavailable",
                None if self.graph.has_warning(Node::first(NodeKind::AlphaGen)) => {
                    "ComfyUI · Unavailable"
                }
                None => "Connecting to ComfyUI…",
            };
            ui.label(
                RichText::new(state)
                    .size(11.0)
                    .color(if self.engine == Some(true) {
                        Color32::from_rgb(143, 178, 123)
                    } else {
                        MUTED
                    }),
            );
            if self.pending_update {
                ui.label(RichText::new("UI update ready").size(11.0).color(AMBER));
            }
            ui.with_layout(egui::Layout::right_to_left(Align::Center), |ui| {
                ui.add(
                    egui::Hyperlink::from_label_and_url("ComfyUI ↗", COMFYUI_URL)
                        .open_in_new_tab(true),
                );
            });
        });
        let work = Rect::from_min_max(
            pos2(root.left() + 4.0, header.bottom() + 4.0),
            pos2(root.right() - 4.0, footer.top() - 4.0),
        );
        set_media_visible(!self.settings_open);
        if self.settings_open {
            position_graph(0.0, 0.0, 0.0, 0.0);
            self.settings(&mut panel(ui, work, "settings"));
            set_workspace_typing(ui.ctx().text_edit_focused());
            return;
        }

        let (viewer, inspector, changed) = if self.node_mode {
            let (graph, right, columns_changed) = split_panel(
                ui,
                work,
                Split::SideBySide,
                &mut self.layout.node_width,
                "node-columns",
            );
            let (viewer, inspector, rows_changed) = split_panel(
                ui,
                right,
                Split::Stacked,
                &mut self.layout.node_viewer_height,
                "node-viewer",
            );
            let editable = !self.busy();
            position_graph(graph.left(), graph.top(), graph.width(), graph.height());
            if self.graph.edit(
                &mut panel(ui, graph, "graph"),
                graph,
                editable,
                &mut self.slots,
            ) {
                self.render_viewer_slot(ui.ctx());
            }
            (viewer, inspector, columns_changed || rows_changed)
        } else if root.width() < 660.0 {
            position_graph(0.0, 0.0, 0.0, 0.0);
            split_panel(
                ui,
                work,
                Split::Stacked,
                &mut self.layout.timeline_viewer_height,
                "timeline-rows",
            )
        } else {
            position_graph(0.0, 0.0, 0.0, 0.0);
            split_panel(
                ui,
                work,
                Split::SideBySide,
                &mut self.layout.timeline_width,
                "timeline-columns",
            )
        };
        if changed {
            self.layout.save();
        }
        self.viewer(&mut panel(ui, viewer, "viewer"), viewer);
        if self.node_mode {
            self.properties_panel(&mut panel(ui, inspector, "properties"));
        } else {
            self.clip_panel(&mut panel(ui, inspector, "clip"));
        }
        set_workspace_typing(ui.ctx().text_edit_focused());
    }
}

enum Split {
    SideBySide,
    Stacked,
}

fn split_panel(
    ui: &Ui,
    bounds: Rect,
    split: Split,
    ratio: &mut f32,
    id: &str,
) -> (Rect, Rect, bool) {
    let horizontal = matches!(split, Split::SideBySide);
    let (start, extent, cursor) = if horizontal {
        (
            bounds.left(),
            bounds.width(),
            egui::CursorIcon::ResizeHorizontal,
        )
    } else {
        (
            bounds.top(),
            bounds.height(),
            egui::CursorIcon::ResizeVertical,
        )
    };
    let minimum = (145.0 / extent.max(1.0)).clamp(0.16, 0.42);
    let gutter = 4.0;
    let divider = |position| {
        if horizontal {
            Rect::from_min_max(
                pos2(position - gutter, bounds.top()),
                pos2(position + gutter, bounds.bottom()),
            )
        } else {
            Rect::from_min_max(
                pos2(bounds.left(), position - gutter),
                pos2(bounds.right(), position + gutter),
            )
        }
    };
    let mut position = start + extent * ratio.clamp(minimum, 1.0 - minimum);
    let grip = ui
        .interact(divider(position), ui.id().with(id), egui::Sense::drag())
        .on_hover_and_drag_cursor(cursor);
    if grip.dragged() {
        let motion = grip.drag_motion();
        let delta = if horizontal { motion.x } else { motion.y };
        *ratio = ((position + delta - start) / extent.max(1.0)).clamp(minimum, 1.0 - minimum);
        position = start + extent * *ratio;
    }
    let grip_rect = divider(position);
    let color = if grip.dragged() || grip.hovered() {
        AMBER
    } else {
        Color32::from_gray(55)
    };
    if horizontal {
        ui.painter().vline(
            position,
            (grip_rect.top() + 1.0)..=(grip_rect.bottom() - 1.0),
            Stroke::new(1.0, color),
        );
        ui.painter().vline(
            position,
            (grip_rect.center().y - 13.0)..=(grip_rect.center().y + 13.0),
            Stroke::new(3.0, color),
        );
    } else {
        ui.painter().hline(
            (grip_rect.left() + 1.0)..=(grip_rect.right() - 1.0),
            position,
            Stroke::new(1.0, color),
        );
        ui.painter().hline(
            (grip_rect.center().x - 13.0)..=(grip_rect.center().x + 13.0),
            position,
            Stroke::new(3.0, color),
        );
    }
    let (first, second) = if horizontal {
        (
            pos2(grip_rect.left(), bounds.bottom()),
            pos2(grip_rect.right(), bounds.top()),
        )
    } else {
        (
            pos2(bounds.right(), grip_rect.top()),
            pos2(bounds.left(), grip_rect.bottom()),
        )
    };
    (
        Rect::from_min_max(bounds.min, first),
        Rect::from_min_max(second, bounds.max),
        grip.drag_stopped(),
    )
}

fn settings_button(ui: &mut Ui, active: bool) -> egui::Response {
    let response = ui
        .add(
            egui::Button::selectable(active, "")
                .min_size(vec2(27.0, 24.0))
                .frame(true),
        )
        .on_hover_text("Settings");
    response.widget_info(|| egui::WidgetInfo::labeled(egui::WidgetType::Button, true, "Settings"));
    let center = response.rect.center();
    let color = ui.style().interact(&response).fg_stroke.color;
    let stroke = Stroke::new(1.15, color);
    ui.painter().circle_stroke(center, 5.4, stroke);
    ui.painter().circle_stroke(center, 2.0, stroke);
    for tooth in 0..8 {
        let direction = Vec2::angled(tooth as f32 * std::f32::consts::TAU / 8.0);
        ui.painter()
            .line_segment([center + direction * 5.4, center + direction * 7.6], stroke);
    }
    response
}

fn sound_button(ui: &mut Ui, enabled: bool) -> egui::Response {
    let label = if enabled {
        "Mute sound"
    } else {
        "Unmute sound"
    };
    let response = ui
        .add(
            egui::Button::selectable(enabled, "")
                .min_size(vec2(27.0, 24.0))
                .frame(true),
        )
        .on_hover_text(label);
    response.widget_info(|| egui::WidgetInfo::labeled(egui::WidgetType::Button, true, label));
    let center = response.rect.center();
    let color = ui.style().interact(&response).fg_stroke.color;
    let painter = ui.painter();
    let speaker = [
        vec2(-8.0, -2.7),
        vec2(-5.0, -2.7),
        vec2(-1.0, -6.2),
        vec2(-1.0, 6.2),
        vec2(-5.0, 2.7),
        vec2(-8.0, 2.7),
    ];
    painter.add(egui::Shape::convex_polygon(
        speaker.into_iter().map(|point| center + point).collect(),
        color,
        Stroke::NONE,
    ));
    let stroke = Stroke::new(1.2, color);
    if enabled {
        for radius in [4.1, 7.2] {
            let points = (-3..=3).map(|i| center + Vec2::angled(i as f32 * 0.25) * radius);
            painter.add(egui::Shape::line(points.collect(), stroke));
        }
    } else {
        painter.line_segment([center + vec2(2.2, -2.6), center + vec2(7.4, 2.6)], stroke);
        painter.line_segment([center + vec2(2.2, 2.6), center + vec2(7.4, -2.6)], stroke);
    }
    response
}

fn panel(ui: &mut Ui, rect: Rect, id: &str) -> Ui {
    let background = if id == "header" || id == "footer" {
        22
    } else {
        30
    };
    ui.painter().rect(
        rect,
        2,
        Color32::from_gray(background),
        Stroke::new(1.0, Color32::from_gray(23)),
        egui::StrokeKind::Inside,
    );
    let mut child = ui.new_child(
        UiBuilder::new()
            .id_salt(id)
            .max_rect(rect.shrink2(Vec2::new(8.0, 6.0))),
    );
    child.set_clip_rect(rect);
    child
}

fn restored_job() -> String {
    let Some(window) = web_sys::window() else {
        return String::new();
    };
    let query = window.location().search().unwrap_or_default();
    let provided = web_sys::UrlSearchParams::new_with_str(&query)
        .ok()
        .and_then(|params| params.get("job"));
    let previous = window
        .session_storage()
        .ok()
        .flatten()
        .and_then(|storage| storage.get_item("okapiJob").ok().flatten());
    let job = provided.or(previous).unwrap_or_default();
    if job.len() == 32
        && job
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
    {
        job
    } else {
        String::new()
    }
}

fn save_job_id(job: &str) {
    if let Some(storage) =
        web_sys::window().and_then(|window| window.session_storage().ok().flatten())
    {
        if job.is_empty() {
            let _ = storage.remove_item("okapiJob");
        } else {
            let _ = storage.set_item("okapiJob", job);
        }
    }
}
