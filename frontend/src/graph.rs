use eframe::egui::{self, Color32, Pos2, Rect, RichText, Stroke, Ui, Vec2, pos2, vec2};
use serde::{Deserialize, Serialize};

use crate::viewer_slots::{SLOT_COUNT, ViewerSlots};
use crate::{choose_workflow, position_workflow, remove_workflow, show_workflow};

const BLUE: Color32 = Color32::from_rgb(132, 166, 255);
const MIN_ZOOM: f32 = 0.001;
const MAX_ZOOM: f32 = 256.0;
const MUTED: Color32 = Color32::from_rgb(154, 158, 172);
const NODE_SNAP_DISTANCE: f32 = 10.0;
const WARNING: Color32 = Color32::from_rgb(246, 190, 79);
const WORKFLOW_SIZE: Vec2 = vec2(720.0, 480.0);

#[derive(Clone, Copy, Debug, Hash, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeKind {
    Source,
    AlphaGen,
    Invert,
    Flip,
    Blur,
    Output,
    Viewer,
    Workflow,
}

const EFFECTS: [NodeKind; 4] = [
    NodeKind::AlphaGen,
    NodeKind::Blur,
    NodeKind::Flip,
    NodeKind::Invert,
];
const TOOLS: [NodeKind; 7] = [
    NodeKind::AlphaGen,
    NodeKind::Blur,
    NodeKind::Flip,
    NodeKind::Invert,
    NodeKind::Viewer,
    NodeKind::Source,
    NodeKind::Output,
];

impl NodeKind {
    pub fn title(self) -> &'static str {
        match self {
            Self::Source => "Read",
            Self::AlphaGen => "Alpha Gen",
            Self::Invert => "Invert",
            Self::Flip => "Mirror",
            Self::Blur => "Blur",
            Self::Output => "Write",
            Self::Viewer => "Viewer",
            Self::Workflow => "Workflow",
        }
    }

    pub(crate) fn accent(self) -> Color32 {
        match self {
            Self::Source => BLUE,
            Self::Output => Color32::from_rgb(241, 201, 68),
            Self::Viewer => Color32::from_rgb(157, 174, 209),
            Self::AlphaGen => Color32::from_rgb(9, 0, 255),
            Self::Workflow => Color32::from_rgb(211, 161, 255),
            _ => Color32::from_rgb(124, 209, 193),
        }
    }
}

#[derive(Clone, Copy, Debug, Hash, PartialEq, Eq, Serialize, Deserialize)]
#[serde(from = "StoredNode", into = "StoredNode")]
pub struct Node {
    pub kind: NodeKind,
    number: u32,
}

#[derive(Serialize, Deserialize)]
#[serde(untagged)]
enum StoredNode {
    First(NodeKind),
    Numbered(NodeKind, u32),
}

impl From<StoredNode> for Node {
    fn from(value: StoredNode) -> Self {
        match value {
            StoredNode::First(kind) => Self::first(kind),
            StoredNode::Numbered(kind, number) => Self { kind, number },
        }
    }
}

impl From<Node> for StoredNode {
    fn from(node: Node) -> Self {
        if node.number == 1 {
            Self::First(node.kind)
        } else {
            Self::Numbered(node.kind, node.number)
        }
    }
}

impl Node {
    pub const fn first(kind: NodeKind) -> Self {
        Self { kind, number: 1 }
    }

    pub(crate) fn accent(self) -> Color32 {
        self.kind.accent()
    }

    fn default_name(self) -> String {
        format!("{}{}", self.kind.title().replace(' ', ""), self.number)
    }
}

#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Settings {
    pub operations: Vec<NodeKind>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub parameters: Vec<OperationParameters>,
    pub seed: Option<u32>,
    pub blur_radius: u8,
}

#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OperationParameters {
    seed: Option<u32>,
    blur_radius: u8,
}

#[derive(Serialize, Deserialize)]
pub struct GraphView {
    selected: Option<Node>,
    #[serde(default)]
    group: Vec<Node>,
    #[serde(default)]
    selected_dots: Vec<usize>,
    #[serde(default)]
    properties: Vec<PropertyPanel>,
    pan: [f32; 2],
    zoom: f32,
}

#[derive(Clone, Copy, Serialize, Deserialize)]
pub(crate) struct PropertyPanel {
    pub node: Node,
    pub expanded: bool,
}

#[derive(Serialize, Deserialize)]
struct Placement {
    kind: Node,
    x: f32,
    y: f32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    parameters: Option<OperationParameters>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    workflow: Option<WorkflowSummary>,
}

#[derive(Serialize, Deserialize)]
pub(crate) struct WorkflowSummary {
    id: String,
    title: String,
    inputs: Vec<String>,
    outputs: Vec<String>,
    #[serde(default)]
    diagnostics: Vec<String>,
}

impl Placement {
    fn new(kind: Node, point: Pos2) -> Self {
        Self {
            kind,
            x: point.x,
            y: point.y,
            name: None,
            parameters: None,
            workflow: None,
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
struct WireDot {
    link: (Node, Node),
    #[serde(default, skip_serializing_if = "Option::is_none")]
    viewer_slot: Option<usize>,
    position: [f32; 2],
}

#[derive(Clone, Copy)]
enum WireDrag {
    Output(Node),
    Input(Node),
    Viewer(Node, usize),
}

enum CanvasDrag {
    Select { origin: Pos2, extend: bool },
    Pan,
    Zoom,
}

struct NodeDrag {
    kind: Node,
    grab_offset: Vec2,
}

fn default_viewer() -> Option<[f32; 2]> {
    Some([90.0, -12.0])
}

#[derive(Serialize, Deserialize)]
pub struct Graph {
    nodes: Vec<Placement>,
    links: Vec<(Node, Node)>,
    seed: Option<u32>,
    blur_radius: u8,
    #[serde(default)]
    bypassed: Vec<Node>,
    #[serde(default)]
    dots: Vec<WireDot>,
    #[serde(default = "default_viewer")]
    viewer: Option<[f32; 2]>,
    #[serde(default)]
    counters: std::collections::HashMap<NodeKind, u32>,
    #[serde(default)]
    vertical_layout: bool,
    #[serde(skip)]
    selected: Option<Node>,
    #[serde(skip)]
    pub(crate) properties: Vec<PropertyPanel>,
    #[serde(skip)]
    pub(crate) properties_scroll_to_top: bool,
    #[serde(skip)]
    group: Vec<Node>,
    #[serde(skip)]
    selected_dots: Vec<usize>,
    #[serde(skip)]
    canvas_drag: Option<CanvasDrag>,
    #[serde(skip)]
    node_drag: Option<NodeDrag>,
    #[serde(skip)]
    navigator_grab: Option<Vec2>,
    #[serde(skip)]
    wiring: Option<WireDrag>,
    #[serde(skip)]
    dot_selected: Option<usize>,
    #[serde(skip)]
    search: String,
    #[serde(skip)]
    open_search: bool,
    #[serde(skip)]
    search_anchor: Option<Pos2>,
    #[serde(skip)]
    search_index: usize,
    #[serde(skip)]
    shortcuts: Vec<String>,
    #[serde(skip)]
    workflow_error: String,
    #[serde(skip)]
    reveal_workflow: Option<Node>,
    #[serde(skip)]
    engine_warnings: Vec<String>,
    #[serde(skip)]
    heimlich_symbol: Option<egui::TextureHandle>,
    #[serde(skip)]
    expanded_workflow: Option<(Node, Vec2)>,
    #[serde(skip)]
    fit_expanded_workflow: bool,
    #[serde(skip)]
    canvas_area: Option<Rect>,
    #[serde(skip)]
    pub elbow_modifier: bool,
    #[serde(skip)]
    pan: Vec2,
    #[serde(skip, default = "one")]
    zoom: f32,
}

fn one() -> f32 {
    1.0
}

impl Default for Graph {
    fn default() -> Self {
        Self {
            nodes: vec![
                Placement::new(Node::first(NodeKind::Source), pos2(-87.0, -105.0)),
                Placement::new(Node::first(NodeKind::Output), pos2(-87.0, 105.0)),
                Placement::new(Node::first(NodeKind::Viewer), pos2(90.0, -12.0)),
            ],
            links: vec![(Node::first(NodeKind::Source), Node::first(NodeKind::Output))],
            seed: None,
            blur_radius: 3,
            bypassed: Vec::new(),
            dots: Vec::new(),
            viewer: None,
            counters: Default::default(),
            vertical_layout: true,
            selected: None,
            properties: Vec::new(),
            properties_scroll_to_top: false,
            group: Vec::new(),
            selected_dots: Vec::new(),
            canvas_drag: None,
            node_drag: None,
            navigator_grab: None,
            wiring: None,
            dot_selected: None,
            search: String::new(),
            open_search: false,
            search_anchor: None,
            search_index: 0,
            shortcuts: Vec::new(),
            workflow_error: String::new(),
            reveal_workflow: None,
            engine_warnings: Vec::new(),
            heimlich_symbol: None,
            expanded_workflow: None,
            fit_expanded_workflow: false,
            canvas_area: None,
            elbow_modifier: false,
            pan: Vec2::ZERO,
            zoom: 1.0,
        }
    }
}

impl Graph {
    pub(crate) fn update_workflow(&mut self, workflow: WorkflowSummary, imported: bool) {
        self.workflow_error.clear();
        let node = self.nodes.iter().find_map(|placement| {
            placement
                .workflow
                .as_ref()
                .filter(|item| item.id == workflow.id)
                .map(|_| placement.kind)
        });
        if let Some(node) = node.or_else(|| imported.then(|| self.add(NodeKind::Workflow))) {
            if let Some(placement) = self
                .nodes
                .iter_mut()
                .find(|placement| placement.kind == node)
            {
                placement.name.get_or_insert_with(|| workflow.title.clone());
                placement.workflow = Some(workflow);
                if imported {
                    self.reveal_workflow = Some(node);
                }
                self.persist();
            }
        }
    }

    pub(crate) fn workflow_error(&mut self, message: String) {
        self.workflow_error = message;
    }

    pub(crate) fn set_engine_warnings(&mut self, warnings: Vec<String>) {
        self.engine_warnings = warnings;
    }

    pub(crate) fn has_warning(&self, node: Node) -> bool {
        !self.warnings(node).is_empty()
    }

    fn warnings(&self, node: Node) -> &[String] {
        match node.kind {
            NodeKind::AlphaGen => &self.engine_warnings,
            NodeKind::Workflow => self
                .workflow(node)
                .map_or(&[], |workflow| workflow.diagnostics.as_slice()),
            _ => &[],
        }
    }

    fn workflow(&self, node: Node) -> Option<&WorkflowSummary> {
        if node.kind != NodeKind::Workflow {
            return None;
        }
        self.nodes
            .iter()
            .find(|placement| placement.kind == node)?
            .workflow
            .as_ref()
    }

    pub fn view(&self) -> GraphView {
        GraphView {
            selected: self.selected,
            group: self.group.clone(),
            selected_dots: self.selected_dots.clone(),
            properties: self.properties.clone(),
            pan: [self.pan.x, self.pan.y],
            zoom: self.zoom,
        }
    }

    pub fn restore_view(&mut self, view: GraphView) {
        self.selected = view.selected.filter(|kind| self.contains(*kind));
        self.properties = view
            .properties
            .into_iter()
            .filter(|panel| self.contains(panel.node))
            .collect();
        self.group = view
            .group
            .into_iter()
            .filter(|node| self.contains(*node))
            .collect();
        if self.group.is_empty()
            && let Some(node) = self.selected
        {
            self.group.push(node);
        }
        self.selected_dots = view
            .selected_dots
            .into_iter()
            .filter(|index| *index < self.dots.len())
            .collect();
        self.dot_selected = if self.selected.is_none() {
            self.selected_dots.first().copied()
        } else {
            None
        };
        self.pan = vec2(view.pan[0], view.pan[1]);
        self.zoom = view.zoom.clamp(MIN_ZOOM, MAX_ZOOM);
    }

    pub fn restore() -> Self {
        let stored = web_sys::window()
            .and_then(|window| window.local_storage().ok().flatten())
            .and_then(|storage| storage.get_item("okapiGraph").ok().flatten());
        let mut graph: Self = stored
            .as_deref()
            .and_then(|data| serde_json::from_str(data).ok())
            .unwrap_or_default();
        if let Some([x, y]) = graph.viewer.take()
            && !graph.contains(Node::first(NodeKind::Viewer))
        {
            graph
                .nodes
                .push(Placement::new(Node::first(NodeKind::Viewer), pos2(x, y)));
        }
        for node in &graph.nodes {
            let counter = graph.counters.entry(node.kind.kind).or_default();
            *counter = (*counter).max(node.kind.number);
        }
        if !graph.vertical_layout {
            for node in &mut graph.nodes {
                (node.x, node.y) = (-87.0 + node.y * 0.65, node.x * 0.70);
            }
            graph.vertical_layout = true;
            graph.persist();
        }
        graph
    }

    fn persist(&self) {
        if let Some(storage) =
            web_sys::window().and_then(|window| window.local_storage().ok().flatten())
            && let Ok(data) = serde_json::to_string(self)
        {
            let _ = storage.set_item("okapiGraph", &data);
        }
    }

    pub fn settings_for_write(&self, node: Node) -> Option<Settings> {
        if self.is_disabled(node) {
            return None;
        }
        self.settings_through(node)
    }

    pub fn primary(&self, kind: NodeKind) -> Option<Node> {
        self.nodes
            .iter()
            .map(|node| node.kind)
            .filter(|node| node.kind == kind)
            .min_by_key(|node| node.number)
    }

    pub fn name(&self, node: Node) -> String {
        self.nodes
            .iter()
            .find(|item| item.kind == node)
            .and_then(|item| item.name.clone())
            .unwrap_or_else(|| node.default_name())
    }

    pub fn rename(&mut self, node: Node, name: &str) -> bool {
        let name = name.trim();
        if name.is_empty()
            || self
                .nodes
                .iter()
                .any(|item| item.kind != node && self.name(item.kind) == name)
        {
            return false;
        }
        if let Some(item) = self.nodes.iter_mut().find(|item| item.kind == node) {
            item.name = (name != node.default_name()).then(|| name.to_owned());
            self.persist();
        }
        true
    }

    pub fn selection(&self) -> Option<Node> {
        self.selected.filter(|node| node.kind != NodeKind::Viewer)
    }

    fn clear_selection(&mut self) {
        self.selected = None;
        self.dot_selected = None;
        self.group.clear();
        self.selected_dots.clear();
    }

    fn select_node(&mut self, node: Node, preserve_group: bool) {
        if !preserve_group || !self.group.contains(&node) {
            self.clear_selection();
            self.group.push(node);
        }
        self.selected = Some(node);
        self.dot_selected = None;
    }

    fn open_properties(&mut self, node: Node) {
        self.properties.retain(|panel| panel.node != node);
        self.properties.insert(
            0,
            PropertyPanel {
                node,
                expanded: true,
            },
        );
        self.properties_scroll_to_top = true;
    }

    fn select_dot(&mut self, index: usize, preserve_group: bool) {
        if !preserve_group || !self.selected_dots.contains(&index) {
            self.clear_selection();
            self.selected_dots.push(index);
        }
        self.selected = None;
        self.dot_selected = Some(index);
    }

    fn move_selection(&mut self, delta: Vec2) {
        for node in &mut self.nodes {
            if self.group.contains(&node.kind) {
                node.x += delta.x;
                node.y += delta.y;
            }
        }
        for &index in &self.selected_dots {
            if let Some(dot) = self.dots.get_mut(index) {
                dot.position[0] += delta.x;
                dot.position[1] += delta.y;
            }
        }
    }

    fn autoplace(&mut self, slots: &ViewerSlots) {
        let mut selected: Vec<_> = self
            .group
            .iter()
            .filter_map(|&kind| self.position(kind).map(|point| (kind, point)))
            .collect();
        if selected.len() < 2 {
            return;
        }
        let chosen = |kind| self.group.contains(&kind);
        let mut origins = std::collections::HashSet::new();
        let mut links: Vec<_> = self
            .links
            .iter()
            .copied()
            .filter(|&(from, to)| chosen(from) && chosen(to) && origins.insert(from))
            .collect();
        if let Some(viewer) = slots.viewer.filter(|&viewer| chosen(viewer))
            && let Some(input) = slots
                .active
                .and_then(|index| slots.bindings[index])
                .into_iter()
                .chain(slots.bindings.iter().copied().flatten())
                .find(|&kind| chosen(kind) && links.iter().all(|&(from, _)| from != kind))
        {
            links.push((input, viewer));
        }
        let bounds = selected
            .iter()
            .fold(Rect::NOTHING, |bounds, &(kind, point)| {
                bounds.union(Rect::from_center_size(point, node_size(kind)))
            });
        let anchor = bounds.center();
        let mut columns = Vec::new();
        if links.is_empty() {
            selected.sort_by(|a, b| a.1.y.total_cmp(&b.1.y).then(a.1.x.total_cmp(&b.1.x)));
            columns.push(selected.iter().map(|&(kind, _)| kind).collect::<Vec<_>>());
        } else {
            selected.sort_by(|a, b| a.1.x.total_cmp(&b.1.x).then(a.1.y.total_cmp(&b.1.y)));
            for &(root, _) in &selected {
                if links.iter().any(|&(_, to)| to == root) {
                    continue;
                }
                let mut column = vec![root];
                while let Some(&(_, next)) = links
                    .iter()
                    .find(|&&(from, _)| from == *column.last().unwrap())
                {
                    column.push(next);
                }
                columns.push(column);
            }
        }
        let spacing_x = 162.0;
        let spacing_y = 62.0;
        let first_x = anchor.x - (columns.len().saturating_sub(1) as f32 * spacing_x) * 0.5;
        let mut placements = Vec::with_capacity(selected.len());
        for (index, column) in columns.into_iter().enumerate() {
            let height = column.iter().map(|&kind| node_size(kind).y).sum::<f32>()
                + column.len().saturating_sub(1) as f32 * spacing_y;
            let mut y = anchor.y - height * 0.5;
            for kind in column {
                let size = node_size(kind);
                let point = pos2(first_x + index as f32 * spacing_x, y + size.y * 0.5);
                placements.push((kind, Rect::from_center_size(point, size)));
                y += size.y + spacing_y;
            }
        }
        let fixed: Vec<_> = self
            .nodes
            .iter()
            .map(|node| node.kind)
            .filter(|&kind| !chosen(kind))
            .filter_map(|kind| {
                self.position(kind)
                    .map(|point| Rect::from_center_size(point, node_size(kind)).expand(12.0))
            })
            .collect();
        // Move the arrangement to the nearest clear position if a stationary node is in the way.
        let mut offsets = vec![0.0];
        for &(_, target) in &placements {
            for other in &fixed {
                if target.left() <= other.right() && target.right() >= other.left() {
                    offsets.extend([
                        other.top() - target.bottom() - 1.0,
                        other.bottom() - target.top() + 1.0,
                    ]);
                }
            }
        }
        offsets.sort_by(|a, b| a.abs().total_cmp(&b.abs()));
        let offset = offsets
            .into_iter()
            .find(|&dy| {
                placements.iter().all(|&(_, target)| {
                    fixed
                        .iter()
                        .all(|other| !target.translate(vec2(0.0, dy)).intersects(*other))
                })
            })
            .unwrap_or(0.0);
        for (kind, target) in placements {
            let point = target.center() + vec2(0.0, offset);
            if let Some(node) = self.nodes.iter_mut().find(|node| node.kind == kind) {
                (node.x, node.y) = (point.x, point.y);
            }
        }
        self.persist();
    }

    pub fn ensure_viewer(&mut self) -> Node {
        self.primary(NodeKind::Viewer)
            .unwrap_or_else(|| self.spawn(NodeKind::Viewer, pos2(90.0, -12.0)))
    }

    pub fn settings_through(&self, endpoint: Node) -> Option<Settings> {
        let mut chain = Vec::new();
        let mut current = endpoint;
        loop {
            let item = self.nodes.iter().find(|item| item.kind == current)?;
            match current.kind {
                NodeKind::Source => {
                    if self.is_disabled(current) {
                        return None;
                    }
                    break;
                }
                NodeKind::Viewer | NodeKind::Workflow => return None,
                _ => {}
            }
            if chain.len() >= self.nodes.len() {
                return None;
            }
            chain.push(item);
            current = self.links.iter().find(|(_, to)| *to == current)?.0;
        }
        let mut operations = Vec::new();
        let mut parameters = Vec::new();
        for item in chain.into_iter().rev() {
            if EFFECTS.contains(&item.kind.kind) && !self.is_disabled(item.kind) {
                operations.push(item.kind.kind);
                parameters.push(self.parameters(item));
            }
        }
        Some(Settings {
            operations,
            parameters,
            seed: None,
            blur_radius: 3,
        })
    }

    fn parameters(&self, item: &Placement) -> OperationParameters {
        item.parameters.clone().unwrap_or(OperationParameters {
            seed: (item.kind.kind == NodeKind::AlphaGen)
                .then_some(self.seed)
                .flatten(),
            blur_radius: if item.kind.kind == NodeKind::Blur {
                self.blur_radius
            } else {
                3
            },
        })
    }

    pub fn contains(&self, node: Node) -> bool {
        self.nodes.iter().any(|item| item.kind == node)
    }

    fn can_connect(&self, source: Node, target: Node) -> bool {
        if source == target
            || matches!(
                source.kind,
                NodeKind::Output | NodeKind::Viewer | NodeKind::Workflow
            )
            || matches!(
                target.kind,
                NodeKind::Source | NodeKind::Viewer | NodeKind::Workflow
            )
        {
            return false;
        }
        let mut upstream = source;
        for _ in 0..self.nodes.len() {
            if upstream == target {
                return false;
            }
            let Some((previous, _)) = self.links.iter().find(|(_, to)| *to == upstream) else {
                return true;
            };
            upstream = *previous;
        }
        false
    }

    fn connect(&mut self, source: Node, target: Node) {
        if !self.can_connect(source, target) {
            return;
        }
        self.links.retain(|(_, to)| *to != target);
        self.links.push((source, target));
        self.dots
            .retain(|dot| dot.viewer_slot.is_some() || self.links.contains(&dot.link));
        self.dot_selected = None;
        self.selected_dots.clear();
        self.persist();
    }

    fn wire_target(&self, drag: WireDrag, boxes: &[(Node, Rect)], point: Pos2) -> Option<Node> {
        let valid = |kind: Node| match drag {
            WireDrag::Output(from) => kind.kind == NodeKind::Viewer || self.can_connect(from, kind),
            WireDrag::Input(to) => self.can_connect(kind, to),
            WireDrag::Viewer(_, _) => !matches!(kind.kind, NodeKind::Viewer | NodeKind::Workflow),
        };
        boxes
            .iter()
            .filter(|(kind, rect)| valid(*kind) && rect.expand(10.0).contains(point))
            .min_by(|(_, a), (_, b)| {
                a.center()
                    .distance_sq(point)
                    .total_cmp(&b.center().distance_sq(point))
            })
            .map(|(node, _)| *node)
    }

    fn insert_on_wire(&mut self, node: Node, link: (Node, Node), segment: usize) {
        let mut index = 0;
        for dot in self.dots.iter_mut().filter(|dot| dot.link == link) {
            dot.link = if index < segment {
                (link.0, node)
            } else {
                (node, link.1)
            };
            index += 1;
        }
        self.links.retain(|wire| *wire != link);
        self.links.extend([(link.0, node), (node, link.1)]);
        self.persist();
    }

    fn spawn(&mut self, kind: NodeKind, point: Pos2) -> Node {
        let mut node = Node {
            kind,
            number: self.counters.get(&kind).copied().unwrap_or(0) + 1,
        };
        while self
            .nodes
            .iter()
            .any(|item| self.name(item.kind) == node.default_name())
        {
            node.number += 1;
        }
        self.counters.insert(kind, node.number);
        let mut placement = Placement::new(node, point);
        placement.parameters = Some(OperationParameters {
            seed: None,
            blur_radius: 3,
        });
        self.nodes.push(placement);
        self.select_node(node, false);
        self.persist();
        node
    }

    fn add(&mut self, kind: NodeKind) -> Node {
        let from = self
            .selection()
            .filter(|node| node.kind != NodeKind::Output)
            .or_else(|| {
                let output = self.primary(NodeKind::Output)?;
                self.links
                    .iter()
                    .find(|(_, to)| *to == output)
                    .map(|(from, _)| *from)
            });
        let to = from.and_then(|node| {
            self.links
                .iter()
                .find(|(from, _)| *from == node)
                .map(|(_, to)| *to)
        });
        let from_point = from.and_then(|node| self.position(node));
        let to_point = to.and_then(|node| self.position(node));
        let mut point = if kind == NodeKind::Workflow {
            Pos2::ZERO + (vec2(0.0, 45.0) - self.pan) / self.zoom
        } else if EFFECTS.contains(&kind) {
            match (from_point, to_point) {
                (Some(a), Some(b)) => a.lerp(b, 0.5),
                (Some(a), None) => a + vec2(0.0, 76.0),
                _ => pos2(-87.0, 0.0),
            }
        } else {
            from_point.unwrap_or(Pos2::ZERO) + vec2(150.0, 52.0)
        };
        while self.nodes.iter().any(|item| {
            Rect::from_center_size(pos2(item.x, item.y), node_size(item.kind))
                .expand(9.0)
                .intersects(Rect::from_center_size(
                    point,
                    if kind == NodeKind::Workflow {
                        node_size(Node::first(kind))
                    } else {
                        vec2(118.0, 44.0)
                    },
                ))
        }) {
            if kind == NodeKind::Workflow {
                point.y += 54.0;
            } else {
                point.x += 140.0;
            }
        }
        let node = self.spawn(kind, point);
        if (EFFECTS.contains(&kind) || kind == NodeKind::Output)
            && let Some(from) = from
        {
            self.connect(from, node);
            if EFFECTS.contains(&kind)
                && let Some(to) = to
            {
                self.connect(node, to);
            }
        }
        node
    }

    fn position(&self, kind: Node) -> Option<Pos2> {
        self.nodes
            .iter()
            .find(|node| node.kind == kind)
            .map(|node| pos2(node.x, node.y))
    }

    fn disconnect_input(&mut self, node: Node) {
        self.links.retain(|(_, to)| *to != node);
        self.dots
            .retain(|dot| dot.viewer_slot.is_some() || self.links.contains(&dot.link));
        self.dot_selected = None;
        self.selected_dots.clear();
        self.persist();
    }

    pub(crate) fn is_disabled(&self, node: Node) -> bool {
        self.bypassed.contains(&node)
    }

    fn toggle_bypass(&mut self, node: Node) {
        if self.is_disabled(node) {
            self.bypassed.retain(|kind| *kind != node);
        } else {
            self.bypassed.push(node);
        }
        self.persist();
    }

    fn add_dot(&mut self) {
        let selected = self.dot_selected.and_then(|index| self.dots.get(index));
        let viewer_slot = selected.and_then(|dot| dot.viewer_slot);
        let link = selected.map(|dot| dot.link).or_else(|| {
            let node = self.selection()?;
            self.links
                .iter()
                .copied()
                .find(|(from, _)| *from == node)
                .or_else(|| self.links.iter().copied().find(|(_, to)| *to == node))
        });
        let Some(link) = link else { return };
        let Some((from, to)) = self.position(link.0).zip(self.position(link.1)) else {
            return;
        };
        let index = self
            .dot_selected
            .filter(|index| {
                self.dots
                    .get(*index)
                    .is_some_and(|d| d.link == link && d.viewer_slot == viewer_slot)
            })
            .or_else(|| {
                self.dots
                    .iter()
                    .rposition(|dot| dot.link == link && dot.viewer_slot == viewer_slot)
            });
        let start = index.map_or(from, |i| {
            let [x, y] = self.dots[i].position;
            pos2(x, y)
        });
        let end = index
            .and_then(|i| {
                self.dots[i + 1..]
                    .iter()
                    .find(|d| d.link == link && d.viewer_slot == viewer_slot)
            })
            .map_or(to, |d| pos2(d.position[0], d.position[1]));
        let point = start.lerp(end, 0.5);
        let index = index.map_or(self.dots.len(), |i| i + 1);
        self.dots.insert(
            index,
            WireDot {
                link,
                viewer_slot,
                position: [point.x, point.y],
            },
        );
        self.select_dot(index, false);
        self.persist();
    }

    fn insert_dot(
        &mut self,
        link: (Node, Node),
        viewer_slot: Option<usize>,
        segment: usize,
        point: Pos2,
    ) {
        let index = self
            .dots
            .iter()
            .enumerate()
            .filter(|(_, dot)| dot.link == link && dot.viewer_slot == viewer_slot)
            .nth(segment)
            .map_or(self.dots.len(), |(index, _)| index);
        self.dots.insert(
            index,
            WireDot {
                link,
                viewer_slot,
                position: [point.x, point.y],
            },
        );
        self.select_dot(index, false);
        self.persist();
    }

    fn remove(&mut self, kind: Node) {
        if let Some(workflow) = self.workflow(kind) {
            remove_workflow(&workflow.id);
        }
        let before = self
            .links
            .iter()
            .find(|(_, to)| *to == kind)
            .map(|(from, _)| *from);
        let after: Vec<_> = self
            .links
            .iter()
            .filter(|(from, _)| *from == kind)
            .map(|(_, to)| *to)
            .collect();
        self.links.retain(|(from, to)| *from != kind && *to != kind);
        self.nodes.retain(|node| node.kind != kind);
        self.bypassed.retain(|node| *node != kind);
        self.dots
            .retain(|dot| dot.viewer_slot.is_some() || self.links.contains(&dot.link));
        self.clear_selection();
        if let Some(from) = before {
            for to in after {
                self.connect(from, to);
            }
        }
        self.persist();
    }

    pub fn shortcut(&mut self, command: String) {
        self.shortcuts.push(command);
    }

    fn zoom_at(&mut self, area: Rect, anchor: Pos2, factor: f32) {
        let zoom = (self.zoom * factor).clamp(MIN_ZOOM, MAX_ZOOM);
        if zoom != self.zoom {
            let offset = anchor - area.center();
            self.pan = offset + (self.pan - offset) * (zoom / self.zoom);
            self.zoom = zoom;
        }
    }

    fn visible_world(&self, area: Rect) -> Rect {
        Rect::from_center_size(
            pos2(-self.pan.x / self.zoom, -self.pan.y / self.zoom),
            area.size() / self.zoom,
        )
    }

    fn navigator(&self, area: Rect) -> Option<(Rect, Rect)> {
        if area.width() < 100.0 || area.height() < 95.0 {
            return None;
        }
        let mut world = Rect::NOTHING;
        for kind in self.nodes.iter().map(|node| node.kind) {
            if let Some(point) = self.position(kind) {
                world = world.union(Rect::from_center_size(point, node_size(kind)));
            }
        }
        for dot in &self.dots {
            world.extend_with(pos2(dot.position[0], dot.position[1]));
        }
        if !world.is_finite()
            || (self.navigator_grab.is_none()
                && self
                    .visible_world(area)
                    .expand(0.5 / self.zoom)
                    .contains_rect(world))
        {
            return None;
        }
        let size = vec2(
            (area.width() * 0.34).clamp(90.0, 178.0),
            (area.height() * 0.28).clamp(75.0, 128.0),
        );
        let upper_right = area.right_top() + vec2(-9.0, 9.0);
        let frame = Rect::from_min_size(upper_right - vec2(size.x, 0.0), size);
        Some((frame, world.expand(12.0)))
    }

    fn draw_navigator(
        &mut self,
        ui: &Ui,
        painter: &egui::Painter,
        area: Rect,
        pointer: Option<Pos2>,
        press_origin: Option<Pos2>,
    ) {
        let Some((frame, world)) = self.navigator(area) else {
            self.navigator_grab = None;
            return;
        };
        let inner = frame.shrink(6.0);
        let scale = (inner.width() / world.width()).min(inner.height() / world.height());
        let project = |point: Pos2| inner.center() + (point - world.center()) * scale;
        let unproject = |point: Pos2| world.center() + (point - inner.center()) / scale;
        let visible_rect = |camera: Rect| {
            Rect::from_center_size(
                project(camera.center()),
                (camera.size() * scale).max(Vec2::splat(6.0)),
            )
        };
        let response = ui
            .interact(
                frame,
                ui.id().with("graph-navigator"),
                egui::Sense::click_and_drag(),
            )
            .on_hover_and_drag_cursor(egui::CursorIcon::Grab);
        if response.drag_started_by(egui::PointerButton::Primary) {
            let visible = self.visible_world(area);
            let origin = press_origin.unwrap_or(frame.center());
            self.navigator_grab = Some(if visible_rect(visible).contains(origin) {
                unproject(origin) - visible.center()
            } else {
                Vec2::ZERO
            });
        }
        if let Some(point) = pointer
            && (response.clicked_by(egui::PointerButton::Primary)
                || response.dragged_by(egui::PointerButton::Primary)
                || response.drag_stopped_by(egui::PointerButton::Primary))
        {
            let point = pos2(
                point.x.clamp(inner.left(), inner.right()),
                point.y.clamp(inner.top(), inner.bottom()),
            );
            let center = unproject(point) - self.navigator_grab.unwrap_or(Vec2::ZERO);
            self.pan = -center.to_vec2() * self.zoom;
            ui.ctx().request_repaint();
        }
        if response.drag_stopped() {
            self.navigator_grab = None;
        }

        painter.rect(
            frame,
            3.0,
            Color32::from_rgb(33, 36, 43),
            Stroke::new(1.0, Color32::from_rgb(76, 84, 103)),
            egui::StrokeKind::Inside,
        );
        let map = painter.with_clip_rect(frame.shrink(2.0));
        for &link in &self.links {
            if let Some((start, end)) = self.position(link.0).zip(self.position(link.1)) {
                let mut point = project(start);
                for dot in self.dots.iter().filter(|dot| dot.link == link) {
                    let next = project(pos2(dot.position[0], dot.position[1]));
                    map.line_segment([point, next], Stroke::new(1.0, MUTED.gamma_multiply(0.7)));
                    point = next;
                }
                map.line_segment(
                    [point, project(end)],
                    Stroke::new(1.0, MUTED.gamma_multiply(0.7)),
                );
            }
        }
        for kind in self.nodes.iter().map(|node| node.kind) {
            if let Some(point) = self.position(kind) {
                let bounds = Rect::from_center_size(
                    project(point),
                    (node_size(kind) * scale).max(Vec2::splat(2.0)),
                );
                let color = if self.group.contains(&kind) {
                    BLUE
                } else {
                    kind.accent().gamma_multiply(0.75)
                };
                map.rect_filled(bounds, 1.0, color);
            }
        }
        let camera = visible_rect(self.visible_world(area));
        let viewport = camera.intersect(frame.shrink(3.0));
        if viewport.is_positive() {
            map.rect_filled(viewport, 0, BLUE.gamma_multiply(0.11));
            map.rect_stroke(camera, 0, Stroke::new(1.3, BLUE), egui::StrokeKind::Inside);
        } else {
            let point = pos2(
                camera.center().x.clamp(inner.left(), inner.right()),
                camera.center().y.clamp(inner.top(), inner.bottom()),
            );
            map.circle_filled(point, 3.0, BLUE);
        }
    }

    fn workflow_frame(&self) -> Option<(Node, Rect)> {
        let (node, offset) = self.expanded_workflow?;
        let rect = Rect::from_min_size(self.position(node)? + offset, WORKFLOW_SIZE);
        Some((node, rect))
    }

    fn toggle_workflow(&mut self, node: Node) {
        if self.expanded_workflow.is_some_and(|(open, _)| open == node) {
            self.expanded_workflow = None;
            return;
        }
        let Some(id) = self.workflow(node).map(|workflow| workflow.id.clone()) else {
            return;
        };
        let Some(anchor) = self.position(node) else {
            return;
        };
        let scene = self.nodes.iter().fold(Rect::NOTHING, |bounds, item| {
            bounds.union(Rect::from_center_size(
                pos2(item.x, item.y),
                node_size(item.kind),
            ))
        });
        let beside = pos2(scene.right() + 36.0, anchor.y - 16.0);
        let below = pos2(anchor.x - WORKFLOW_SIZE.x / 2.0, scene.bottom() + 36.0);
        let area = self
            .canvas_area
            .unwrap_or_else(|| Rect::from_min_size(Pos2::ZERO, WORKFLOW_SIZE));
        let visible_scale = |corner| {
            let bounds = scene.union(Rect::from_min_size(corner, WORKFLOW_SIZE));
            (area.width() / bounds.width()).min(area.height() / bounds.height())
        };
        let corner = if visible_scale(below) > visible_scale(beside) {
            below
        } else {
            beside
        };
        self.expanded_workflow = Some((node, corner - anchor));
        self.fit_expanded_workflow = true;
        show_workflow(&id);
    }

    pub(crate) fn close_workflow(&mut self, id: &str) {
        if self.expanded_workflow.is_some_and(|(node, _)| {
            self.workflow(node)
                .is_some_and(|workflow| workflow.id == id)
        }) {
            self.expanded_workflow = None;
        }
    }

    pub(crate) fn pan_workflow(&mut self, [x, y]: [f32; 2]) {
        self.pan += vec2(x, y);
    }

    pub(crate) fn zoom_workflow(&mut self, [x, y, delta]: [f32; 3]) {
        if let Some(area) = self.canvas_area {
            self.zoom_at(area, pos2(x, y), (delta * -0.004).exp());
        }
    }

    fn fit(&mut self, area: Rect, selection: bool) {
        let chosen = selection && (!self.group.is_empty() || !self.selected_dots.is_empty());
        let mut bounds = Rect::NOTHING;
        for node in self.nodes.iter().map(|node| node.kind) {
            if (!chosen || self.group.contains(&node))
                && let Some(point) = self.position(node)
            {
                bounds = bounds.union(Rect::from_center_size(point, vec2(128.0, 76.0)));
            }
        }
        if let Some((node, frame)) = self.workflow_frame()
            && (!chosen || self.group.contains(&node))
        {
            bounds = bounds.union(frame);
        }
        for (index, dot) in self.dots.iter().enumerate() {
            if !chosen || self.selected_dots.contains(&index) {
                let point = pos2(dot.position[0], dot.position[1]);
                bounds = bounds.union(Rect::from_center_size(point, vec2(24.0, 24.0)));
            }
        }
        self.zoom = ((area.width() - 50.0) / bounds.width())
            .min((area.height() - 56.0) / bounds.height())
            .clamp(MIN_ZOOM, if chosen { 1.7 } else { 1.15 });
        self.pan = -bounds.center().to_vec2() * self.zoom;
    }

    fn remove_selected(&mut self, slots: &mut ViewerSlots) {
        if let Some(node) = self.selected {
            self.remove_node(node, slots);
        } else if let Some(index) = self.dot_selected.take() {
            self.dots.remove(index);
            self.clear_selection();
            self.persist();
        }
    }

    fn remove_node(&mut self, node: Node, slots: &mut ViewerSlots) {
        self.remove(node);
        slots.remove_node(node);
        self.dots
            .retain(|dot| dot.link.0 != node && dot.link.1 != node);
        self.properties.retain(|panel| panel.node != node);
        self.persist();
    }

    fn handle_shortcuts(
        &mut self,
        area: Rect,
        editable: bool,
        slots: &mut ViewerSlots,
        pointer: Option<Pos2>,
    ) -> bool {
        let mut activate = false;
        for command in std::mem::take(&mut self.shortcuts) {
            match command.as_str() {
                "search" if editable => {
                    self.open_search = true;
                    self.search_anchor = pointer.filter(|point| area.contains(*point));
                }
                "fit" => self.fit(area, true),
                "zoom-in" | "zoom-out" => {
                    let factor = if command == "zoom-in" { 1.2 } else { 1.0 / 1.2 };
                    let anchor = pointer
                        .filter(|point| area.contains(*point))
                        .unwrap_or(area.center());
                    self.zoom_at(area, anchor, factor);
                }
                "blur" if editable => {
                    self.add(NodeKind::Blur);
                }
                "autoplace" if self.node_drag.is_none() => self.autoplace(slots),
                "dot" if editable => self.add_dot(),
                "viewer" => {
                    let selected = self.selection();
                    let viewer = self.ensure_viewer();
                    slots.use_viewer(viewer);
                    if let Some(node) = selected {
                        slots.bind(0, Some(node));
                        slots.active = Some(0);
                        activate = true;
                    }
                    self.select_node(viewer, false);
                }
                "disable" if editable => {
                    let enable = self.group.iter().all(|node| self.is_disabled(*node));
                    for node in self.group.clone() {
                        if self.is_disabled(node) == enable {
                            self.toggle_bypass(node);
                        }
                    }
                }
                "disconnect" if editable => {
                    if let Some(viewer) = self.selected.filter(|node| node.kind == NodeKind::Viewer)
                    {
                        slots.use_viewer(viewer);
                        if let Some(index) = slots.active.take() {
                            slots.bind(index, None);
                        }
                    } else if let Some(node) = self.selection() {
                        self.disconnect_input(node);
                    }
                }
                "delete" if editable => self.remove_selected(slots),
                "clear" => {
                    self.clear_selection();
                    self.wiring = None;
                    slots.active = None;
                }
                "upstream" | "downstream" => {
                    if let Some(node) = self.selection() {
                        let next = self.links.iter().find_map(|&(from, to)| {
                            if command == "upstream" && to == node {
                                Some(from)
                            } else if command == "downstream" && from == node {
                                Some(to)
                            } else {
                                None
                            }
                        });
                        if let Some(next) = next {
                            self.select_node(next, false);
                        }
                    }
                }
                "snap" | "snap-selected" if editable => {
                    let all = command == "snap";
                    let snap = |value: f32| (value / 19.0).round() * 19.0;
                    for node in &mut self.nodes {
                        if all || self.group.contains(&node.kind) {
                            (node.x, node.y) = (snap(node.x), snap(node.y));
                        }
                    }
                    for (index, dot) in self.dots.iter_mut().enumerate() {
                        if all || self.selected_dots.contains(&index) {
                            dot.position = dot.position.map(snap);
                        }
                    }
                    self.persist();
                }
                _ => {}
            }
        }
        activate
    }

    pub fn edit(
        &mut self,
        ui: &mut Ui,
        bounds: Rect,
        editable: bool,
        slots: &mut ViewerSlots,
    ) -> bool {
        let area = Rect::from_min_max(bounds.min + vec2(0.0, 37.0), bounds.max).intersect(bounds);
        self.canvas_area = Some(area);
        if std::mem::take(&mut self.fit_expanded_workflow) {
            self.fit(area, false);
        }
        if let Some(node) = self.reveal_workflow.take()
            && let Some(position) = self.position(node)
        {
            let center = area.center() + self.pan + position.to_vec2() * self.zoom;
            if !area
                .shrink(12.0)
                .contains_rect(Rect::from_center_size(center, node_size(node) * self.zoom))
            {
                self.pan = -position.to_vec2() * self.zoom;
            }
        }
        let dot_count = self.dots.len();
        self.dots.retain(|dot| {
            dot.viewer_slot.is_none_or(|index| {
                self.nodes.iter().any(|item| item.kind == dot.link.1)
                    && slots.inputs(dot.link.1).get(index).copied().flatten() == Some(dot.link.0)
            })
        });
        if self.dots.len() != dot_count {
            self.dot_selected = None;
            self.selected_dots.clear();
            self.persist();
        }
        let mut activate = self.handle_shortcuts(
            area,
            editable,
            slots,
            ui.input(|input| input.pointer.hover_pos()),
        );
        ui.horizontal(|ui| {
            ui.label(RichText::new("Node Graph").strong());
            ui.separator();
            let search = ui
                .add_enabled(editable, egui::Button::new("Add node"))
                .on_hover_text("Search nodes · Tab");
            let id = ui.id().with("node-search");
            let opened = self.open_search || search.clicked();
            if opened {
                if search.clicked() {
                    self.search_anchor = None;
                }
                self.open_search = false;
                self.search.clear();
                egui::Popup::open_id(ui.ctx(), id);
            }
            let mut choice = None;
            let mut dot = false;
            let mut popup = egui::Popup::from_response(&search);
            if let Some(anchor) = self.search_anchor {
                popup = popup.anchor(anchor);
            }
            popup
                .id(id)
                .open_memory(None)
                .close_behavior(egui::PopupCloseBehavior::CloseOnClickOutside)
                .show(|ui| {
                    ui.set_min_width(165.0);
                    let field = ui.add(
                        egui::TextEdit::singleline(&mut self.search)
                            .desired_width(165.0)
                            .hint_text("Search nodes"),
                    );
                    if opened {
                        field.request_focus();
                    }
                    let query = self.search.to_lowercase();
                    let tools: Vec<_> = TOOLS
                        .into_iter()
                        .map(Some)
                        .chain([None])
                        .filter(|tool| {
                            tool.map_or("Dot", NodeKind::title)
                                .to_lowercase()
                                .contains(&query)
                        })
                        .collect();
                    if opened || field.changed() {
                        self.search_index = 0;
                    }
                    if !tools.is_empty() {
                        let (up, down, enter) = ui.input(|input| {
                            (
                                input.key_pressed(egui::Key::ArrowUp),
                                input.key_pressed(egui::Key::ArrowDown),
                                input.key_pressed(egui::Key::Enter),
                            )
                        });
                        if up {
                            self.search_index = (self.search_index + tools.len() - 1) % tools.len();
                        }
                        if down {
                            self.search_index = (self.search_index + 1) % tools.len();
                        }
                        for (index, tool) in tools.into_iter().enumerate() {
                            if ui
                                .add(
                                    egui::Button::new(tool.map_or("Dot", NodeKind::title))
                                        .frame(false)
                                        .selected(index == self.search_index && !query.is_empty()),
                                )
                                .clicked()
                                || (enter && index == self.search_index)
                            {
                                choice = tool;
                                dot = tool.is_none();
                                break;
                            }
                        }
                    } else {
                        ui.weak("No matching nodes");
                    }
                    if choice.is_some()
                        || dot
                        || ui.input(|input| input.key_pressed(egui::Key::Escape))
                    {
                        field.surrender_focus();
                        ui.close();
                    }
                });
            if let Some(kind) = choice {
                let node = self.add(kind);
                if kind == NodeKind::Viewer {
                    slots.use_viewer(node);
                }
            }
            if dot {
                self.add_dot();
            }
            if ui
                .add_enabled(editable, egui::Button::new("Import workflow"))
                .on_hover_text("Import a ComfyUI workflow or API JSON file")
                .clicked()
            {
                self.workflow_error.clear();
                choose_workflow();
            }
            if ui
                .button("Fit")
                .on_hover_text("Fit graph · F fits selection")
                .clicked()
            {
                self.fit(area, false);
            }
            if slots.active.is_some()
                && ui
                    .button("Clear active")
                    .on_hover_text("Keep Viewer inputs · Esc")
                    .clicked()
            {
                slots.active = None;
            }
            if !self.workflow_error.is_empty() {
                ui.add(
                    egui::Label::new(RichText::new(&self.workflow_error).color(Color32::LIGHT_RED))
                        .truncate(),
                )
                .on_hover_text(&self.workflow_error);
            }
        });

        let background = ui.interact(area, ui.id().with("grid"), egui::Sense::click_and_drag());
        let (pointer, press_origin, alt, shift) = ui.input(|input| {
            (
                input.pointer.interact_pos(),
                input.pointer.press_origin(),
                input.modifiers.alt,
                input.modifiers.shift,
            )
        });
        let navigator = self.navigator(area);
        let over_navigator =
            |point: Pos2| navigator.is_some_and(|(frame, _)| frame.contains(point));
        if background.drag_started_by(egui::PointerButton::Middle) {
            self.canvas_drag = Some(if alt {
                CanvasDrag::Zoom
            } else {
                CanvasDrag::Pan
            });
        } else if background.drag_started_by(egui::PointerButton::Primary)
            && !press_origin.is_some_and(over_navigator)
        {
            self.canvas_drag = if alt {
                Some(CanvasDrag::Pan)
            } else {
                press_origin.map(|origin| CanvasDrag::Select {
                    origin,
                    extend: shift,
                })
            };
        }
        if background.dragged() || background.drag_stopped() {
            match self.canvas_drag {
                Some(CanvasDrag::Zoom) => {
                    let anchor = press_origin.or(pointer).unwrap_or(area.center());
                    self.zoom_at(area, anchor, (background.drag_motion().x * 0.009).exp());
                }
                Some(CanvasDrag::Pan) => self.pan += background.drag_motion(),
                _ => {}
            }
        }
        if background.clicked_by(egui::PointerButton::Middle) {
            self.fit(area, false);
        }
        if background.clicked_by(egui::PointerButton::Primary)
            && !alt
            && !shift
            && !pointer.is_some_and(over_navigator)
        {
            self.clear_selection();
            self.wiring = None;
        }
        let painter = ui.painter().with_clip_rect(area);
        painter.rect_filled(area, 0, Color32::from_rgb(22, 23, 27));
        if self.canvas_drag.is_none()
            && ui.rect_contains_pointer(area)
            && let Some(point) = pointer
        {
            let factor =
                ui.input(|input| input.zoom_delta() * (input.smooth_scroll_delta.y * 0.004).exp());
            if factor != 1.0 {
                self.zoom_at(area, point, factor);
            }
        }
        let scale = self.zoom;
        let origin = area.center() + self.pan;
        let pixel = |point: Pos2| origin + point.to_vec2() * scale;
        if let Some((node, frame)) = self.workflow_frame()
            && let Some(anchor) = self.position(node)
        {
            let (from, to) = if frame.left() > anchor.x {
                (
                    anchor + vec2(node_size(node).x / 2.0, 0.0),
                    frame.left_top() + vec2(0.0, 16.0),
                )
            } else {
                (
                    anchor + vec2(0.0, node_size(node).y / 2.0),
                    pos2(anchor.x, frame.top()),
                )
            };
            painter.line_segment([pixel(from), pixel(to)], Stroke::new(1.0, node.accent()));
        }
        let boxes: Vec<_> = self
            .nodes
            .iter()
            .map(|p| p.kind)
            .filter_map(|kind| {
                self.position(kind).map(|point| {
                    (
                        kind,
                        Rect::from_center_size(pixel(point), node_size(kind) * scale),
                    )
                })
            })
            .collect();
        let rect_for = |kind: Node| {
            boxes
                .iter()
                .find(|(node, _)| *node == kind)
                .map(|(_, rect)| *rect)
        };
        let marquee = match (self.canvas_drag.as_ref(), pointer) {
            (Some(CanvasDrag::Select { origin, extend }), Some(pointer)) => Some((
                Rect::from_two_pos(*origin, pointer).intersect(area),
                *extend,
            )),
            _ => None,
        };
        let hits: Vec<_> = boxes
            .iter()
            .filter_map(|(kind, bounds)| {
                marquee
                    .filter(|(rect, _)| rect.intersects(*bounds))
                    .map(|_| *kind)
            })
            .collect();
        let dot_hits: Vec<_> = self
            .dots
            .iter()
            .enumerate()
            .filter_map(|(index, dot)| {
                let point = pixel(pos2(dot.position[0], dot.position[1]));
                marquee
                    .filter(|(rect, _)| rect.contains(point))
                    .map(|_| index)
            })
            .collect();
        if background.drag_stopped() {
            if let Some((_, extend)) = marquee {
                if !extend {
                    self.clear_selection();
                }
                for &kind in &hits {
                    if !self.group.contains(&kind) {
                        self.group.push(kind);
                    }
                }
                for &index in &dot_hits {
                    if !self.selected_dots.contains(&index) {
                        self.selected_dots.push(index);
                    }
                }
                self.selected = self
                    .group
                    .iter()
                    .copied()
                    .find(|kind| kind.kind != NodeKind::Viewer)
                    .or_else(|| self.group.first().copied());
                self.dot_selected = self
                    .selected
                    .is_none()
                    .then(|| self.selected_dots.first().copied())
                    .flatten();
            }
            self.canvas_drag = None;
        }
        let viewed = slots.active.and_then(|index| slots.bindings[index]);
        let mut upstream = viewed;
        let mut active = Vec::new();
        for _ in 0..self.nodes.len() {
            let Some(link) = self
                .links
                .iter()
                .copied()
                .find(|(_, to)| Some(*to) == upstream)
            else {
                break;
            };
            active.push(link);
            upstream = Some(link.0);
        }
        let magnet = pointer
            .filter(|point| area.contains(*point))
            .and_then(|point| {
                self.wiring
                    .and_then(|drag| self.wire_target(drag, &boxes, point))
            });
        let mut input_tips = Vec::new();
        let mut output_tails = Vec::new();
        let mut segments = Vec::new();
        let mut viewer_segments = Vec::new();
        for &(from, to) in &self.links {
            if let Some((a, b)) = rect_for(from).zip(rect_for(to)) {
                let mut points: Vec<Pos2> = self
                    .dots
                    .iter()
                    .filter(|dot| dot.link == (from, to))
                    .map(|dot| pixel(pos2(dot.position[0], dot.position[1])))
                    .collect();
                let first = points.first().copied().unwrap_or(b.center());
                let last = points.last().copied().unwrap_or(a.center());
                let start = edge(a, first);
                let end = edge(b, last);
                points.insert(0, start);
                points.push(end);
                let highlighted = active.contains(&(from, to));
                let color = if highlighted {
                    BLUE
                } else {
                    Color32::from_rgb(102, 109, 124)
                };
                let rewiring = matches!(self.wiring, Some(WireDrag::Output(node)) if node == from)
                    || matches!(self.wiring, Some(WireDrag::Input(node)) if node == to);
                for (index, pair) in points.windows(2).enumerate() {
                    segments.push(((from, to), index, [pair[0], pair[1]]));
                    if !rewiring {
                        painter.line_segment(
                            [pair[0], pair[1]],
                            Stroke::new(if highlighted { 1.9 } else { 1.1 }, color),
                        );
                    }
                }
                if !rewiring {
                    arrow(&painter, last, end, color, scale);
                }
                input_tips.push((to, end, last));
                output_tails.push((from, start, first));
            }
        }

        for &(viewer, rect) in boxes
            .iter()
            .filter(|(node, _)| node.kind == NodeKind::Viewer)
        {
            let inputs = slots.inputs(viewer);
            for index in 0..SLOT_COUNT {
                let hot = slots.viewer == Some(viewer)
                    && slots.active == Some(index)
                    && !self.is_disabled(viewer);
                let color = if hot { BLUE } else { Color32::BLACK };
                if let Some((kind, source)) =
                    inputs[index].and_then(|kind| rect_for(kind).map(|rect| (kind, rect)))
                {
                    if !matches!(self.wiring, Some(WireDrag::Viewer(node, slot)) if node == viewer && slot == index)
                    {
                        let link = (kind, viewer);
                        let mut points: Vec<_> = self
                            .dots
                            .iter()
                            .filter(|dot| dot.link == link && dot.viewer_slot == Some(index))
                            .map(|dot| pixel(pos2(dot.position[0], dot.position[1])))
                            .collect();
                        let first = points.first().copied().unwrap_or(rect.center());
                        let last = points.last().copied().unwrap_or(source.center());
                        let start = edge(source, first);
                        let end = edge(rect, last);
                        points.insert(0, start);
                        points.push(end);
                        for (segment, pair) in points.windows(2).enumerate() {
                            if hot {
                                painter.line_segment([pair[0], pair[1]], Stroke::new(2.0, color));
                            } else {
                                dotted(&painter, pair[0], pair[1], color);
                            }
                            viewer_segments.push((link, Some(index), segment, [pair[0], pair[1]]));
                        }
                        arrow(&painter, last, end, color, scale);
                        if scale >= 0.45 && area.expand(30.0).contains(end) {
                            let label_scale = scale.clamp(0.85, 2.0);
                            let direction = (last - end).normalized();
                            let side = vec2(-direction.y, direction.x);
                            let side = if side.y > 0.0 { -side } else { side };
                            painter.text(
                                end + (direction * 7.0 + side * 9.0) * label_scale,
                                egui::Align2::CENTER_CENTER,
                                (index + 1).to_string(),
                                egui::FontId::monospace(10.0 * label_scale),
                                if hot { BLUE } else { MUTED },
                            );
                        }
                    }
                }
            }
        }

        let mut moved = false;
        let mut group_motion = Vec2::ZERO;
        let mut moving_node = None;
        let mut drag_started = None;
        let mut drag_ended = false;
        let mut activate_slot = None;
        for &(kind, rect) in &boxes {
            if !area.expand(16.0).intersects(rect)
                && self.wiring.is_none()
                && !ui.ctx().is_being_dragged(ui.id().with(("node", kind)))
            {
                continue;
            }
            if scale < 0.06 {
                painter.circle_filled(rect.center(), 1.25, kind.accent());
                continue;
            }
            let body = ui.interact(
                rect.shrink(1.0),
                ui.id().with(("node", kind)),
                egui::Sense::click_and_drag(),
            );
            if body.dragged() && (alt || body.dragged_by(egui::PointerButton::Middle)) {
                self.pan += body.drag_motion();
            } else {
                if body.clicked_by(egui::PointerButton::Primary) && !alt {
                    if shift {
                        if !self.group.contains(&kind) {
                            self.group.push(kind);
                        }
                        self.select_node(kind, true);
                    } else {
                        self.select_node(kind, false);
                    }
                }
                if body.drag_started_by(egui::PointerButton::Primary) && !alt {
                    self.select_node(kind, true);
                    self.node_drag = press_origin.or(pointer).map(|start| NodeDrag {
                        kind,
                        grab_offset: (rect.center() - start) / scale,
                    });
                }
                if !alt
                    && (body.dragged_by(egui::PointerButton::Primary)
                        || body.drag_stopped_by(egui::PointerButton::Primary))
                {
                    moving_node = Some((
                        kind,
                        rect,
                        body.drag_stopped_by(egui::PointerButton::Primary),
                    ));
                }
                moved |= body.drag_stopped_by(egui::PointerButton::Primary);
            }
            let primary = egui::PointerButton::Primary;
            let opens_properties = body.double_clicked_by(primary)
                || (body.triple_clicked_by(primary)
                    && self
                        .properties
                        .first()
                        .is_none_or(|panel| panel.node != kind));
            if opens_properties && !alt {
                self.open_properties(kind);
                if kind.kind == NodeKind::Viewer {
                    slots.use_viewer(kind);
                }
            }
            node_face(
                &painter,
                kind,
                &self.name(kind),
                rect,
                scale,
                hits.contains(&kind)
                    || (marquee.is_none_or(|(_, extend)| extend) && self.group.contains(&kind))
                    || magnet == Some(kind),
                self.is_disabled(kind),
                viewed == Some(kind),
            );

            if kind.kind == NodeKind::AlphaGen && scale >= 0.40 {
                let symbol = self.heimlich_symbol.get_or_insert_with(|| {
                    let image = image::load_from_memory(include_bytes!("heimlich-symbol.png"))
                        .expect("valid bundled HEIMLICH symbol")
                        .into_rgba8();
                    ui.ctx().load_texture(
                        "heimlich-symbol",
                        egui::ColorImage::from_rgba_unmultiplied(
                            [image.width() as usize, image.height() as usize],
                            image.as_raw(),
                        ),
                        egui::TextureOptions::LINEAR,
                    )
                });
                painter.image(
                    symbol.id(),
                    Rect::from_center_size(
                        rect.left_center() + vec2(23.0, 0.0) * scale,
                        vec2(30.0, 30.0 * 112.0 / 256.0) * scale,
                    ),
                    Rect::from_min_max(Pos2::ZERO, pos2(1.0, 1.0)),
                    Color32::WHITE,
                );
            }

            if self.has_warning(kind) {
                let center = rect.left_top() + vec2(3.0, 2.0);
                let badge = ui.interact(
                    Rect::from_center_size(center, Vec2::splat(20.0)),
                    ui.id().with(("warning", kind)),
                    egui::Sense::click(),
                );
                let hint = self
                    .warnings(kind)
                    .first()
                    .map(String::as_str)
                    .unwrap_or_default();
                painter.add(egui::Shape::convex_polygon(
                    vec![
                        center + vec2(0.0, -9.0),
                        center + vec2(9.0, 7.0),
                        center + vec2(-9.0, 7.0),
                    ],
                    WARNING,
                    Stroke::new(1.0, Color32::from_gray(34)),
                ));
                painter.text(
                    center + vec2(0.0, 2.0),
                    egui::Align2::CENTER_CENTER,
                    "!",
                    egui::FontId::monospace(12.0),
                    Color32::from_gray(25),
                );
                if badge.on_hover_text(hint).clicked() {
                    self.select_node(kind, false);
                    self.open_properties(kind);
                }
            }

            if let Some(workflow) = self.workflow(kind) {
                let expanded = self.expanded_workflow.is_some_and(|(node, _)| node == kind);
                let button = Rect::from_center_size(
                    rect.right_center() - vec2(14.0 * scale, 0.0),
                    Vec2::splat(21.0 * scale),
                );
                let response = ui.interact(
                    button,
                    ui.id().with(("workflow", kind)),
                    egui::Sense::click(),
                );
                painter.text(
                    button.center(),
                    egui::Align2::CENTER_CENTER,
                    if expanded { "−" } else { "+" },
                    egui::FontId::proportional(17.0 * scale),
                    Color32::WHITE,
                );
                if scale >= 0.58 {
                    painter.with_clip_rect(area.intersect(rect)).text(
                        rect.center_bottom() - vec2(0.0, 10.0) * scale,
                        egui::Align2::CENTER_CENTER,
                        format!(
                            "{} in · {} out",
                            workflow.inputs.len(),
                            workflow.outputs.len()
                        ),
                        egui::FontId::proportional(9.0 * scale.min(3.0)),
                        Color32::from_gray(194),
                    );
                }
                if response
                    .on_hover_text(if expanded {
                        "Collapse workflow"
                    } else {
                        "Expand workflow"
                    })
                    .clicked()
                {
                    self.toggle_workflow(kind);
                    ui.ctx().request_repaint();
                }
            }
            if !matches!(
                kind.kind,
                NodeKind::Viewer | NodeKind::Output | NodeKind::Workflow
            ) {
                let (point, toward) = output_tails
                    .iter()
                    .find(|(node, _, _)| *node == kind)
                    .map(|(_, point, toward)| (*point, *toward))
                    .unwrap_or((rect.center_bottom(), rect.center_bottom() + vec2(0.0, 30.0)));
                let outward = (toward - point).normalized();
                let handle = ui
                    .interact(
                        Rect::from_center_size(point + outward * 5.5, Vec2::splat(15.0)),
                        ui.id().with(("out", kind)),
                        egui::Sense::drag(),
                    )
                    .on_hover_cursor(egui::CursorIcon::Crosshair);
                if editable && handle.drag_started() {
                    drag_started = Some(WireDrag::Output(kind));
                }
                drag_ended |= handle.drag_stopped();
                if handle.hovered()
                    || (self.selected == Some(kind)
                        && !output_tails.iter().any(|(node, _, _)| *node == kind))
                {
                    let color = if handle.hovered() { BLUE } else { MUTED };
                    arrow(
                        &painter,
                        point,
                        point + outward * (7.0 * scale),
                        color,
                        scale,
                    );
                }
            }
            if !matches!(
                kind.kind,
                NodeKind::Viewer | NodeKind::Source | NodeKind::Workflow
            ) {
                let (tip, upstream) = input_tips
                    .iter()
                    .find(|(node, _, _)| *node == kind)
                    .map(|(_, tip, upstream)| (*tip, *upstream))
                    .unwrap_or((rect.center_top(), rect.center_top() - vec2(0.0, 30.0)));
                let outward = (upstream - tip).normalized();
                let handle = ui
                    .interact(
                        Rect::from_center_size(tip + outward * 5.5, Vec2::splat(15.0)),
                        ui.id().with(("in", kind)),
                        egui::Sense::drag(),
                    )
                    .on_hover_cursor(egui::CursorIcon::Crosshair);
                if editable && handle.drag_started() {
                    drag_started = Some(WireDrag::Input(kind));
                }
                drag_ended |= handle.drag_stopped();
                if handle.hovered()
                    || (!input_tips.iter().any(|(node, _, _)| *node == kind)
                        && self.selected == Some(kind))
                {
                    arrow(
                        &painter,
                        tip + outward * 11.0,
                        tip,
                        if handle.hovered() { BLUE } else { MUTED },
                        scale,
                    );
                }
            }
            if kind.kind == NodeKind::Viewer {
                for index in 0..SLOT_COUNT {
                    let tip = viewer_tip(rect, index, scale);
                    let handle = ui
                        .interact(
                            Rect::from_center_size(
                                tip - vec2(7.0 * scale, 0.0),
                                vec2(23.0, 8.5 * scale),
                            ),
                            ui.id().with(("viewer-input", kind, index)),
                            egui::Sense::click_and_drag(),
                        )
                        .on_hover_cursor(egui::CursorIcon::Crosshair);
                    if handle.clicked() {
                        activate_slot = Some((kind, index));
                    }
                    if editable && handle.drag_started() {
                        drag_started = Some(WireDrag::Viewer(kind, index));
                    }
                    drag_ended |= handle.drag_stopped();
                    if handle.hovered() {
                        arrow(&painter, tip - vec2(20.0, 0.0), tip, BLUE, scale);
                    }
                    let inputs = slots.inputs(kind);
                    if let Some(source) = inputs[index] {
                        let preferred = slots
                            .active
                            .filter(|slot| {
                                slots.viewer == Some(kind) && inputs[*slot] == Some(source)
                            })
                            .or_else(|| inputs.iter().position(|node| *node == Some(source)));
                        if preferred == Some(index)
                            && let Some(upstream) = rect_for(source)
                        {
                            let endpoint = edge(rect, upstream.center());
                            let toward_source = (upstream.center() - endpoint).normalized();
                            let connector = ui
                                .interact(
                                    Rect::from_center_size(
                                        endpoint + toward_source * 6.0,
                                        Vec2::splat(14.0),
                                    ),
                                    ui.id().with(("viewer-wire", kind, index)),
                                    egui::Sense::click_and_drag(),
                                )
                                .on_hover_cursor(egui::CursorIcon::Crosshair);
                            if connector.clicked() {
                                activate_slot = Some((kind, index));
                            }
                            if editable && connector.drag_started() {
                                drag_started = Some(WireDrag::Viewer(kind, index));
                            }
                            drag_ended |= connector.drag_stopped();
                        }
                    }
                }
            }
        }
        for index in 0..self.dots.len() {
            let dot = &self.dots[index];
            let point = pixel(pos2(dot.position[0], dot.position[1]));
            let active_dot = active.contains(&dot.link)
                || slots.viewer == Some(dot.link.1)
                    && dot.viewer_slot == slots.active
                    && dot.viewer_slot.is_some();
            let response = ui.interact(
                Rect::from_center_size(point, Vec2::splat((18.0 * scale).min(24.0))),
                ui.id().with(("dot", index)),
                egui::Sense::click_and_drag(),
            );
            if response.dragged() && (alt || response.dragged_by(egui::PointerButton::Middle)) {
                self.pan += response.drag_motion();
            } else {
                if response.clicked_by(egui::PointerButton::Primary) && !alt {
                    self.select_dot(index, false);
                }
                if response.drag_started_by(egui::PointerButton::Primary) {
                    self.select_dot(index, true);
                }
                if response.dragged_by(egui::PointerButton::Primary) {
                    group_motion = response.drag_motion() / scale;
                }
                moved |= response.drag_stopped_by(egui::PointerButton::Primary);
            }
            painter.circle(
                point,
                (4.2 * scale).min(9.0),
                if dot_hits.contains(&index)
                    || (marquee.is_none_or(|(_, extend)| extend)
                        && self.selected_dots.contains(&index))
                    || active_dot
                {
                    BLUE
                } else {
                    MUTED
                },
                Stroke::new(1.0, Color32::from_rgb(12, 13, 16)),
            );
        }
        if let Some(drag) = drag_started {
            self.wiring = Some(drag);
        }
        if let Some((kind, rect, _)) = moving_node
            && let Some(drag) = self.node_drag.as_ref().filter(|drag| drag.kind == kind)
            && let Some(point) = pointer
        {
            // Derive motion from the pointer so a snapped position never becomes the drag origin.
            let raw = point + drag.grab_offset * scale - rect.center();
            group_motion = snap_node_motion(&boxes, &self.group, raw) / scale;
        }
        if let Some(drag) = self.wiring {
            if let Some(point) = pointer {
                if drag_ended {
                    let node = self
                        .wire_target(drag, &boxes, point)
                        .filter(|_| area.contains(point));
                    let empty =
                        area.contains(point) && !boxes.iter().any(|(_, rect)| rect.contains(point));
                    match drag {
                        WireDrag::Output(from) => {
                            if let Some(target) = node {
                                if target.kind == NodeKind::Viewer {
                                    slots.use_viewer(target);
                                    let index = slots
                                        .bindings
                                        .iter()
                                        .position(Option::is_none)
                                        .or(slots.active)
                                        .unwrap_or(0);
                                    slots.bind(index, Some(from));
                                    activate_slot = Some((target, index));
                                } else {
                                    self.connect(from, target);
                                }
                            } else if empty {
                                self.links.retain(|(source, _)| *source != from);
                                self.dots.retain(|dot| {
                                    dot.viewer_slot.is_some() || self.links.contains(&dot.link)
                                });
                                self.selected_dots.clear();
                                self.dot_selected = None;
                                self.persist();
                            }
                        }
                        WireDrag::Input(target) => {
                            if let Some(from) = node.filter(|node| *node != target) {
                                self.connect(from, target);
                            } else if empty {
                                self.disconnect_input(target);
                            }
                        }
                        WireDrag::Viewer(kind, index) => {
                            slots.use_viewer(kind);
                            if let Some(from) = node.filter(|node| node.kind != NodeKind::Viewer) {
                                slots.bind(index, Some(from));
                                activate_slot = Some((kind, index));
                            } else if empty {
                                slots.bind(index, None);
                                if slots.active == Some(index) {
                                    slots.active = None;
                                }
                            }
                        }
                    }
                } else {
                    let snapped = magnet.and_then(rect_for);
                    let center = snapped.map_or(point, |rect| rect.center());
                    let (from, to) = match drag {
                        WireDrag::Output(kind) => (
                            rect_for(kind).map_or(point, |rect| edge(rect, center)),
                            snapped.map_or(point, |rect| {
                                edge(rect, rect_for(kind).map_or(point, |r| r.center()))
                            }),
                        ),
                        WireDrag::Input(kind) => {
                            let end = rect_for(kind);
                            (
                                snapped.map_or(point, |rect| {
                                    edge(rect, end.map_or(point, |r| r.center()))
                                }),
                                end.map_or(point, |rect| edge(rect, center)),
                            )
                        }
                        WireDrag::Viewer(viewer, _) => (
                            snapped.map_or(point, |rect| {
                                edge(rect, rect_for(viewer).map_or(point, |r| r.center()))
                            }),
                            rect_for(viewer).map_or(point, |rect| edge(rect, center)),
                        ),
                    };
                    painter.line_segment([from, to], Stroke::new(1.7, BLUE));
                    arrow(&painter, from, to, BLUE, scale);
                }
            }
            if drag_ended {
                self.wiring = None;
            }
        }
        if let Some((kind, rect, released)) = moving_node
            && editable
            && EFFECTS.contains(&kind.kind)
            && self.group.len() == 1
            && self.selected_dots.is_empty()
            && !self
                .links
                .iter()
                .any(|(from, to)| *from == kind || *to == kind)
            && pointer.is_some_and(|point| area.contains(point))
        {
            let center = rect.center() + group_motion * scale;
            let candidate = segments
                .iter()
                .filter_map(|(link, segment, line)| {
                    let distance = segment_distance(center, *line);
                    (distance <= (11.0 * scale).clamp(7.0, 14.0))
                        .then_some((link, segment, distance))
                })
                .filter(|(link, _, _)| {
                    ![link.0, link.1].into_iter().any(|node| {
                        rect_for(node)
                            .is_some_and(|endpoint| endpoint.expand(12.0).contains(center))
                    })
                })
                .min_by(|a, b| a.2.total_cmp(&b.2));
            if let Some((&link, &segment, _)) = candidate {
                if released {
                    self.insert_on_wire(kind, link, segment);
                } else {
                    for &(_, _, line) in segments
                        .iter()
                        .filter(|(candidate, _, _)| *candidate == link)
                    {
                        painter.line_segment(line, Stroke::new(2.5, BLUE));
                    }
                    painter.rect_stroke(rect, 0, Stroke::new(2.5, BLUE), egui::StrokeKind::Outside);
                }
            }
        }
        if group_motion != Vec2::ZERO {
            self.move_selection(group_motion);
            ui.ctx().request_repaint();
        }
        if moved {
            self.persist();
        }
        if ui.input(|input| !input.pointer.primary_down()) {
            self.node_drag = None;
        }
        if let Some((rect, _)) = marquee.filter(|_| !background.drag_stopped()) {
            painter.rect(
                rect,
                0,
                BLUE.gamma_multiply(0.15),
                Stroke::new(1.0, BLUE),
                egui::StrokeKind::Inside,
            );
        }
        if editable
            && self.elbow_modifier
            && !alt
            && !shift
            && self.canvas_drag.is_none()
            && self.node_drag.is_none()
            && self.wiring.is_none()
            && ui.rect_contains_pointer(area)
        {
            let visible = area.intersect(ui.clip_rect());
            let wires = segments
                .iter()
                .map(|&(link, segment, line)| (link, None, segment, line))
                .chain(viewer_segments);
            let mut markers: Vec<Pos2> = Vec::new();
            for (link, slot, segment, line) in wires {
                let Some(center) = visible_wire_center(visible, line) else {
                    continue;
                };
                if over_navigator(center)
                    || boxes.iter().any(|(_, rect)| rect.contains(center))
                    || markers.iter().any(|other| other.distance_sq(center) < 16.0)
                {
                    continue;
                }
                markers.push(center);
                let response = ui
                    .interact(
                        Rect::from_center_size(center, Vec2::splat(16.0)),
                        ui.id().with(("wire-elbow", link.0, link.1, slot, segment)),
                        egui::Sense::click(),
                    )
                    .on_hover_cursor(egui::CursorIcon::PointingHand);
                let color = if response.hovered() {
                    Color32::from_rgb(255, 230, 135)
                } else {
                    Color32::from_rgb(223, 193, 92)
                };
                let radius = 5.0;
                painter.add(egui::Shape::convex_polygon(
                    vec![
                        center - vec2(radius, 0.0),
                        center - vec2(0.0, radius),
                        center + vec2(radius, 0.0),
                        center + vec2(0.0, radius),
                    ],
                    color,
                    Stroke::new(1.0, Color32::from_gray(31)),
                ));
                if response.clicked_by(egui::PointerButton::Primary) || response.secondary_clicked()
                {
                    let point = ((center - origin) / scale).to_pos2();
                    self.insert_dot(link, slot, segment, point);
                    ui.ctx().request_repaint();
                    break;
                }
            }
        }
        self.draw_navigator(ui, &painter, area, pointer, press_origin);
        if let Some((_, frame)) = self.workflow_frame() {
            let top_left = area.center() + self.pan + frame.min.to_vec2() * self.zoom;
            position_workflow(
                top_left.x,
                top_left.y,
                frame.width(),
                frame.height(),
                self.zoom,
            );
        } else {
            self.expanded_workflow = None;
            position_workflow(0.0, 0.0, 0.0, 0.0, self.zoom);
        }
        if let Some((viewer, index)) = activate_slot {
            slots.use_viewer(viewer);
            slots.active = Some(index);
            activate = true;
        }
        activate
    }

    pub(crate) fn dot_controls(&mut self, ui: &mut Ui, editable: bool, slots: &mut ViewerSlots) {
        if self.dot_selected.is_some() {
            ui.horizontal(|ui| {
                ui.label("Dot");
                if ui
                    .add_enabled(editable, egui::Button::new("Remove dot"))
                    .clicked()
                {
                    self.remove_selected(slots);
                }
            });
        }
    }

    pub(crate) fn node_controls(
        &mut self,
        ui: &mut Ui,
        kind: Node,
        editable: bool,
        slots: &mut ViewerSlots,
    ) {
        if self.has_warning(kind) {
            ui.label(RichText::new("Diagnostics").strong().color(WARNING));
            for warning in self.warnings(kind) {
                ui.label(RichText::new(warning).monospace().size(11.0));
            }
            if kind.kind == NodeKind::AlphaGen {
                ui.weak("Start ComfyUI or install the listed dependency, then recheck.");
            }
            if self.workflow(kind).is_some() && ui.button("Review workflow issues").clicked() {
                self.toggle_workflow(kind);
            }
            ui.separator();
        }
        let mut disabled = self.is_disabled(kind);
        if ui
            .add_enabled(editable, egui::Checkbox::new(&mut disabled, "Disabled (D)"))
            .changed()
        {
            self.toggle_bypass(kind);
        }
        if kind.kind == NodeKind::Viewer {
            let inputs = slots.inputs(kind);
            for index in 0..SLOT_COUNT {
                ui.horizontal(|ui| {
                    let color = if slots.viewer == Some(kind) && slots.active == Some(index) {
                        BLUE
                    } else {
                        MUTED
                    };
                    ui.label(
                        RichText::new((index + 1).to_string())
                            .monospace()
                            .color(color),
                    );
                    ui.label(inputs[index].map_or_else(|| "—".into(), |node| self.name(node)));
                    if inputs[index].is_some()
                        && ui
                            .small_button("×")
                            .on_hover_text("Disconnect input")
                            .clicked()
                    {
                        slots.use_viewer(kind);
                        slots.bind(index, None);
                        if slots.active == Some(index) {
                            slots.active = None;
                        }
                    }
                });
            }
            if slots.viewer == Some(kind)
                && slots.active.is_some()
                && ui.button("Clear active input").clicked()
            {
                slots.active = None;
            }
            return;
        }
        ui.add_enabled_ui(editable, |ui| {
            let mut changed = false;
            let mut parameters = self
                .nodes
                .iter()
                .find(|item| item.kind == kind)
                .map(|item| self.parameters(item))
                .unwrap();
            match kind.kind {
                NodeKind::Source => {}
                NodeKind::AlphaGen => {
                    let mut fixed = parameters.seed.is_some();
                    if ui.checkbox(&mut fixed, "Fixed seed").changed() {
                        parameters.seed = fixed.then_some(0);
                        changed = true;
                    }
                    if let Some(seed) = &mut parameters.seed {
                        changed |= ui
                            .add(egui::DragValue::new(seed).prefix("Seed  "))
                            .changed();
                    }
                }
                NodeKind::Blur => {
                    changed |= ui
                        .add(egui::Slider::new(&mut parameters.blur_radius, 1..=31).text("Radius"))
                        .changed();
                }
                NodeKind::Flip => {
                    ui.label("Horizontal mirror");
                }
                NodeKind::Invert => {
                    ui.label("Invert video or matte values");
                }
                NodeKind::Output => {
                    ui.label("MP4 · H.264");
                }
                NodeKind::Workflow => {
                    if let Some(workflow) = self.workflow(kind) {
                        for (label, ports) in
                            [("Inputs", &workflow.inputs), ("Outputs", &workflow.outputs)]
                        {
                            ui.strong(label);
                            if ports.is_empty() {
                                ui.weak("None exposed");
                            }
                            for port in ports {
                                ui.label(port);
                            }
                        }
                        let expanded = self.expanded_workflow.is_some_and(|(node, _)| node == kind);
                        if ui
                            .button(if expanded {
                                "Collapse workflow"
                            } else {
                                "Expand workflow"
                            })
                            .clicked()
                        {
                            self.toggle_workflow(kind);
                        }
                        ui.weak("Export the edited workflow to render it in ComfyUI.");
                    }
                }
                NodeKind::Viewer => unreachable!(),
            }
            if kind.kind != NodeKind::Source
                && self.links.iter().any(|(_, target)| *target == kind)
                && ui.button("Disconnect input").clicked()
            {
                self.disconnect_input(kind);
            }
            if EFFECTS.contains(&kind.kind) && ui.button("Remove node").clicked() {
                self.remove_node(kind, slots);
            }
            if changed && let Some(item) = self.nodes.iter_mut().find(|item| item.kind == kind) {
                item.parameters = Some(parameters);
                self.persist();
            }
        });
    }
}

fn node_size(kind: Node) -> Vec2 {
    match kind.kind {
        NodeKind::Viewer => vec2(112.0, 44.0),
        NodeKind::AlphaGen => vec2(130.0, 32.0),
        NodeKind::Workflow => vec2(156.0, 48.0),
        _ => vec2(118.0, 32.0),
    }
}

fn snap_node_motion(boxes: &[(Node, Rect)], moving: &[Node], raw: Vec2) -> Vec2 {
    let mut column: Option<f32> = None;
    let mut row: Option<f32> = None;
    for &(kind, source) in boxes {
        if !moving.contains(&kind) {
            continue;
        }
        let target = source.translate(raw);
        for &(other, fixed) in boxes {
            if moving.contains(&other) {
                continue;
            }
            let delta = fixed.center() - target.center();
            if (target.bottom() < fixed.top() || fixed.bottom() < target.top())
                && delta.x.abs() <= NODE_SNAP_DISTANCE.min(target.width() * 0.25)
                && column.is_none_or(|best| delta.x.abs() < best.abs())
            {
                column = Some(delta.x);
            }
            if (target.right() < fixed.left() || fixed.right() < target.left())
                && delta.y.abs() <= NODE_SNAP_DISTANCE.min(target.height() * 0.25)
                && row.is_none_or(|best| delta.y.abs() < best.abs())
            {
                row = Some(delta.y);
            }
        }
    }
    raw + vec2(column.unwrap_or(0.0), row.unwrap_or(0.0))
}

fn edge(rect: Rect, target: Pos2) -> Pos2 {
    let center = rect.center();
    let delta = target - center;
    let ratio = (delta.x.abs() / (rect.width() * 0.5)).max(delta.y.abs() / (rect.height() * 0.5));
    if ratio <= 1.0 {
        center
    } else {
        center + delta / ratio
    }
}

fn segment_distance(point: Pos2, [start, end]: [Pos2; 2]) -> f32 {
    let direction = end - start;
    let length = direction.length_sq();
    if length == 0.0 {
        return point.distance(start);
    }
    let t = ((point - start).dot(direction) / length).clamp(0.0, 1.0);
    point.distance(start + direction * t)
}

fn visible_wire_center(clip: Rect, [start, end]: [Pos2; 2]) -> Option<Pos2> {
    let direction = end - start;
    let mut enter = 0.0_f32;
    let mut leave = 1.0_f32;
    for (point, step, min, max) in [
        (start.x, direction.x, clip.left(), clip.right()),
        (start.y, direction.y, clip.top(), clip.bottom()),
    ] {
        if step == 0.0 {
            if point < min || point > max {
                return None;
            }
            continue;
        }
        let first = (min - point) / step;
        let second = (max - point) / step;
        enter = enter.max(first.min(second));
        leave = leave.min(first.max(second));
    }
    if enter >= leave || direction.length() * (leave - enter) < 10.0 {
        return None;
    }
    Some(start + direction * ((enter + leave) * 0.5))
}

fn viewer_tip(rect: Rect, index: usize, scale: f32) -> Pos2 {
    let offset = index as f32 - 2.0;
    pos2(
        rect.left() + offset.abs() * 2.0 * scale,
        rect.center().y + offset * 10.0 * scale,
    )
}

fn arrow(painter: &egui::Painter, start: Pos2, tip: Pos2, color: Color32, scale: f32) {
    let direction = (tip - start).normalized();
    let length = (9.0 * scale).min(18.0).min(start.distance(tip));
    let base = tip - direction * length;
    let side = vec2(-direction.y, direction.x) * length * 0.43;
    painter.add(egui::Shape::convex_polygon(
        vec![tip, base + side, base - side],
        color,
        Stroke::NONE,
    ));
}

fn dotted(painter: &egui::Painter, start: Pos2, end: Pos2, color: Color32) {
    const DASH_SPACING: usize = 9;
    let clip = painter.clip_rect().expand(2.0);
    if !Rect::from_two_pos(start, end).expand(2.0).intersects(clip) {
        return;
    }
    let length = start.distance(end);
    let unit = (end - start).normalized();
    let projections = [
        clip.left_top(),
        clip.right_top(),
        clip.left_bottom(),
        clip.right_bottom(),
    ]
    .map(|corner| (corner - start).dot(unit));
    let first = (projections
        .into_iter()
        .fold(f32::INFINITY, f32::min)
        .max(0.0)
        / DASH_SPACING as f32)
        .floor() as usize
        * DASH_SPACING;
    let last = projections
        .into_iter()
        .fold(f32::NEG_INFINITY, f32::max)
        .min(length)
        .max(0.0)
        .ceil() as usize;
    for distance in (first..last).step_by(DASH_SPACING) {
        painter.line_segment(
            [
                start + unit * distance as f32,
                start + unit * (distance as f32 + 2.0).min(length),
            ],
            Stroke::new(1.5, color),
        );
    }
}

fn node_face(
    painter: &egui::Painter,
    kind: Node,
    name: &str,
    rect: Rect,
    scale: f32,
    selected: bool,
    disabled: bool,
    viewed: bool,
) {
    let accent = if disabled {
        Color32::from_gray(110)
    } else {
        kind.accent()
    };
    let blend = |first: Color32, second: Color32, t: f32| {
        let mix = |a, b| (a as f32 + (b as f32 - a as f32) * t) as u8;
        Color32::from_rgb(
            mix(first.r(), second.r()),
            mix(first.g(), second.g()),
            mix(first.b(), second.b()),
        )
    };
    let yellow_write = kind.kind == NodeKind::Output && !disabled;
    let (bright, dark) = if yellow_write {
        (accent, Color32::from_rgb(193, 147, 33))
    } else if kind.kind == NodeKind::AlphaGen && !disabled {
        (accent, accent)
    } else {
        (
            blend(
                Color32::from_rgb(47, 49, 56),
                accent,
                if viewed { 0.68 } else { 0.47 },
            ),
            blend(Color32::from_rgb(24, 25, 29), accent, 0.22),
        )
    };
    let outline = Stroke::new(
        if selected { 1.8 } else { 1.0 },
        if selected {
            BLUE
        } else {
            Color32::from_rgb(13, 14, 17)
        },
    );
    painter.rect_filled(
        rect.translate(vec2(1.0, 2.0)),
        0,
        Color32::from_black_alpha(140),
    );
    if kind.kind == NodeKind::Viewer {
        let cut = 8.0 * scale;
        let points = vec![
            rect.left_top() + vec2(cut, 0.0),
            rect.right_top() - vec2(cut, 0.0),
            rect.right_center(),
            rect.right_bottom() - vec2(cut, 0.0),
            rect.left_bottom() + vec2(cut, 0.0),
            rect.left_center(),
        ];
        painter.add(egui::Shape::convex_polygon(points, bright, outline));
    } else {
        let mut mesh = egui::Mesh::default();
        for (pos, color) in [
            (rect.left_top(), bright),
            (rect.right_top(), bright),
            (rect.right_bottom(), dark),
            (rect.left_bottom(), dark),
        ] {
            mesh.colored_vertex(pos, color);
        }
        mesh.add_triangle(0, 1, 2);
        mesh.add_triangle(0, 2, 3);
        painter.add(egui::Shape::mesh(mesh));
        painter.rect_stroke(rect, 0, outline, egui::StrokeKind::Inside);
        painter.hline(
            (rect.left() + 1.0)..=(rect.right() - 1.0),
            rect.top() + 1.0,
            Stroke::new(1.0, blend(bright, Color32::WHITE, 0.18)),
        );
        for (channel, color) in [
            Color32::from_rgb(200, 86, 93),
            Color32::from_rgb(104, 169, 124),
            Color32::from_rgb(105, 141, 212),
            Color32::from_gray(190),
        ]
        .into_iter()
        .enumerate()
        {
            let start = rect.left_bottom() + vec2(4.0 + channel as f32 * 7.0, -4.0) * scale;
            painter.rect_filled(Rect::from_min_size(start, vec2(6.0, 2.0) * scale), 0, color);
        }
    }
    if scale < 0.40 {
        return;
    }
    let font_scale = scale.min(4.0);
    let title_bounds = match kind.kind {
        NodeKind::Workflow => Rect::from_min_max(
            rect.min + vec2(4.0, 0.0) * scale,
            rect.max - vec2(28.0, 0.0) * scale,
        ),
        NodeKind::AlphaGen => Rect::from_min_max(
            rect.min + vec2(43.0, 0.0) * scale,
            rect.max - vec2(5.0, 0.0) * scale,
        ),
        _ => rect,
    };
    let title_center = if kind.kind == NodeKind::Workflow {
        title_bounds.center() - vec2(0.0, 6.0) * scale
    } else {
        title_bounds.center()
    };
    painter
        .with_clip_rect(title_bounds.intersect(painter.clip_rect()))
        .text(
            title_center,
            egui::Align2::CENTER_CENTER,
            name,
            egui::FontId::proportional(13.0 * font_scale),
            if yellow_write {
                Color32::from_gray(24)
            } else {
                Color32::from_gray(239)
            },
        );
    if disabled {
        let cross = Stroke::new(1.5, Color32::from_gray(210));
        painter.line_segment([rect.left_top(), rect.right_bottom()], cross);
        painter.line_segment([rect.left_bottom(), rect.right_top()], cross);
    }
}
