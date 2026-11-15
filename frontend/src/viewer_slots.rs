use serde::{Deserialize, Serialize};

use crate::graph::{Node, NodeKind, Settings};

pub const SLOT_COUNT: usize = 5;

#[derive(Default)]
pub struct ViewerSlots {
    pub viewer: Option<Node>,
    other_viewers: Vec<(Node, [Option<Node>; SLOT_COUNT])>,
    pub bindings: [Option<Node>; SLOT_COUNT],
    pub active: Option<usize>,
    pub renders: Vec<PreviewRender>,
    pub generation: u32,
}

pub struct PreviewRender {
    pub settings: Settings,
    pub state: PreviewState,
}

pub enum PreviewState {
    Submitting,
    Pending {
        job: String,
        next_poll: f64,
        polling: bool,
        status: String,
    },
    Ready(String),
    Failed(String),
}

#[derive(Clone, Serialize, Deserialize)]
pub struct CachedPreview {
    pub settings: Settings,
    pub job: String,
}

impl ViewerSlots {
    pub fn restore() -> Self {
        let Some(storage) =
            web_sys::window().and_then(|window| window.local_storage().ok().flatten())
        else {
            return Self::default();
        };
        if let Some((viewer, bindings, other_viewers)) = storage
            .get_item("okapiViewerInputs")
            .ok()
            .flatten()
            .and_then(|json| serde_json::from_str(&json).ok())
        {
            return Self {
                viewer,
                bindings,
                other_viewers,
                ..Self::default()
            };
        }
        let bindings = storage
            .get_item("okapiViewerSlots")
            .ok()
            .flatten()
            .and_then(|json| serde_json::from_str(&json).ok())
            .unwrap_or_default();
        Self {
            viewer: Some(Node::first(NodeKind::Viewer)),
            bindings,
            ..Self::default()
        }
    }

    pub fn inputs(&self, viewer: Node) -> [Option<Node>; SLOT_COUNT] {
        if self.viewer == Some(viewer) {
            self.bindings
        } else {
            self.other_viewers
                .iter()
                .find(|(node, _)| *node == viewer)
                .map(|(_, inputs)| *inputs)
                .unwrap_or_default()
        }
    }

    pub fn use_viewer(&mut self, viewer: Node) {
        if self.viewer == Some(viewer) {
            return;
        }
        let inputs = self.inputs(viewer);
        self.other_viewers.retain(|(node, _)| *node != viewer);
        if let Some(previous) = self.viewer.replace(viewer) {
            self.other_viewers.push((previous, self.bindings));
        }
        self.bindings = inputs;
        self.active = None;
        self.persist();
    }

    pub fn remove_node(&mut self, removed: Node) {
        for inputs in std::iter::once(&mut self.bindings)
            .chain(self.other_viewers.iter_mut().map(|(_, inputs)| inputs))
        {
            for input in inputs {
                if *input == Some(removed) {
                    *input = None;
                }
            }
        }
        self.other_viewers.retain(|(viewer, _)| *viewer != removed);
        if self.viewer == Some(removed) {
            self.viewer = None;
            self.bindings = Default::default();
        }
        if self
            .active
            .is_some_and(|index| self.bindings[index].is_none())
        {
            self.active = None;
        }
        self.persist();
    }

    fn persist(&self) {
        if let Some(storage) =
            web_sys::window().and_then(|window| window.local_storage().ok().flatten())
            && let Ok(data) =
                serde_json::to_string(&(self.viewer, self.bindings, &self.other_viewers))
        {
            let _ = storage.set_item("okapiViewerInputs", &data);
        }
    }

    pub fn bind(&mut self, index: usize, node: Option<Node>) {
        self.bindings[index] = node;
        self.persist();
    }

    pub fn new_clip(&mut self) {
        self.active = None;
        self.renders.clear();
        self.generation = self.generation.wrapping_add(1);
    }

    pub fn cached(&self) -> Vec<CachedPreview> {
        self.renders
            .iter()
            .filter_map(|entry| match &entry.state {
                PreviewState::Ready(job) => Some(CachedPreview {
                    settings: entry.settings.clone(),
                    job: job.clone(),
                }),
                _ => None,
            })
            .collect()
    }

    pub fn restore_cache(&mut self, active: Option<usize>, cache: Vec<CachedPreview>) {
        self.active = active.filter(|index| *index < SLOT_COUNT);
        self.renders = cache
            .into_iter()
            .map(|entry| PreviewRender {
                settings: entry.settings,
                state: PreviewState::Ready(entry.job),
            })
            .collect();
    }

    pub fn in_flight(&self) -> usize {
        self.renders
            .iter()
            .filter(|entry| entry.state.in_flight())
            .count()
    }

    pub fn state(&self, settings: &Settings) -> Option<&PreviewState> {
        self.renders
            .iter()
            .find(|entry| same_settings(&entry.settings, settings))
            .map(|entry| &entry.state)
    }

    pub fn start(&mut self, settings: Settings) {
        self.renders
            .retain(|entry| !same_settings(&entry.settings, &settings));
        if self.renders.len() >= 24
            && let Some(index) = self
                .renders
                .iter()
                .position(|entry| !entry.state.in_flight())
        {
            self.renders.remove(index);
        }
        self.renders.push(PreviewRender {
            settings,
            state: PreviewState::Submitting,
        });
    }
}

impl PreviewState {
    pub fn in_flight(&self) -> bool {
        matches!(self, Self::Submitting | Self::Pending { .. })
    }
}

pub fn same_settings(left: &Settings, right: &Settings) -> bool {
    left.operations == right.operations
        && left.parameters == right.parameters
        && (!left.parameters.is_empty()
            || ((!left.operations.contains(&NodeKind::AlphaGen) || left.seed == right.seed)
                && (!left.operations.contains(&NodeKind::Blur)
                    || left.blur_radius == right.blur_radius)))
}
