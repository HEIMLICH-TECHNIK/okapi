import {
  connectPorts, describeGraph, disconnectPort, exposePort, interfaceFor, loadWorkflow, scopeId, setInputValue,
} from './workflow-graph.js';
import { diagnose, readCatalog, workflowDiagnostics } from './workflow-diagnostics.js';

const stylesheet = document.createElement('link');
stylesheet.rel = 'stylesheet';
stylesheet.href = new URL('./workflow-editor.css', import.meta.url).href;
const styled = new Promise(resolve => {
  stylesheet.onload = stylesheet.onerror = resolve;
  document.head.append(stylesheet);
});

const storeName = 'workflows';
let activeEditor;
const database = new Promise((resolve, reject) => {
  const request = indexedDB.open('okapiWorkflows', 1);
  request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: 'id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

async function storage(mode, action) {
  const db = await database;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error || new Error('The workflow could not be saved.'));
  });
}

function summary(record, model, issues = []) {
  const ports = interfaceFor(model, model.root, record.mappings[scopeId(model, model.root)]);
  const names = list => list.map(entry => `${entry.name} · ${entry.type}`);
  const diagnostics = issues.slice(0, 8);
  if (issues.length > diagnostics.length) diagnostics.push(`${issues.length - diagnostics.length} more issues`);
  return { id: record.id, title: record.title, inputs: names(ports.inputs), outputs: names(ports.outputs), diagnostics };
}

export async function importWorkflow(file) {
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose a JSON file smaller than 20 MB.');
  let document;
  try {
    document = JSON.parse(await file.text());
  } catch {
    throw new Error('This file does not contain valid JSON.');
  }
  const model = loadWorkflow(document);
  const name = typeof model.root.name === 'string' ? model.root.name : '';
  const record = {
    id: crypto.randomUUID(),
    title: (name || file.name.replace(/\.json$/i, '') || 'Workflow').slice(0, 120),
    document,
    positions: {},
    mappings: {},
  };
  if (model.document.extra?.okapiWorkflowPorts) {
    const { inputs, outputs } = model.document.extra.okapiWorkflowPorts;
    if ([inputs, outputs].every(list => Array.isArray(list) && list.every(item =>
      typeof item?.name === 'string' && typeof item.type === 'string'))) {
      record.mappings.root = { inputs, outputs };
    }
  }
  await storage('readwrite', store => store.add(record));
  return summary(record, model);
}

export async function checkWorkflow(id) {
  const record = await storage('readonly', store => store.get(id));
  if (!record) return null;
  const model = loadWorkflow(record.document);
  try {
    const issues = await workflowDiagnostics(record.document);
    return summary(record, model, issues.map(issue => `${issue.title} · ${issue.message}`));
  } catch (error) {
    return summary(record, model, [error.message]);
  }
}

export async function deleteWorkflow(id) {
  if (activeEditor?.id === id) {
    const editor = activeEditor;
    editor.close();
    await editor.saveQueue.catch(() => {});
  }
  await storage('readwrite', store => store.delete(id));
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, handler) {
  const node = element('button', '', text);
  node.type = 'button';
  node.addEventListener('click', handler);
  return node;
}

const socketKey = (node, direction, slot) => JSON.stringify([node, direction, slot]);
const scopePositionKey = (scope, node) => JSON.stringify([scope, node]);
const point = (left, top) => [Math.max(0, left), Math.max(0, top)];

class WorkflowEditor {
  constructor(record, actions) {
    this.id = record.id;
    this.record = record;
    this.model = loadWorkflow(record.document);
    this.actions = actions;
    this.stack = [this.model.root];
    this.path = [];
    this.issues = [];
    this.checking = false;
    this.zoom = 1;
    this.selected = null;
    this.sockets = new Map();
    this.saveQueue = Promise.resolve();

    this.frame = element('section');
    this.frame.id = 'okapi-workflow-editor';
    this.frame.setAttribute('aria-labelledby', 'okapi-workflow-title');
    const header = element('header', 'workflow-header');
    const heading = element('h2', '', record.title);
    heading.id = 'okapi-workflow-title';
    const toolbar = element('div', 'workflow-tools');
    this.back = button('Back', () => this.navigate(this.stack.slice(0, -1), this.path.slice(0, -1)));
    this.breadcrumb = element('span', 'workflow-path');
    toolbar.append(this.back, this.breadcrumb, button('Fit contents', () => this.fit()));
    header.append(heading, button('Export JSON', () => this.download()), button('Collapse', () => this.close()));

    const body = element('div', 'workflow-body');
    const viewport = element('div', 'workflow-viewport');
    this.scroll = element('div', 'workflow-scroll');
    this.extent = element('div', 'workflow-extent');
    this.layout = element('div', 'workflow-layout');
    this.wires = element('canvas', 'workflow-wires');
    this.wires.setAttribute('aria-hidden', 'true');
    this.extent.append(this.layout);
    this.scroll.append(this.extent);
    viewport.append(this.scroll, this.wires);
    this.details = element('aside', 'workflow-details');
    body.append(viewport, this.details);

    this.status = element('div', 'workflow-status');
    this.status.setAttribute('role', 'status');
    this.frame.append(header, toolbar, body, this.status);
    this.frame.addEventListener('workflow-close', () => this.close());
    this.frame.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
      }
    });
    this.frame.addEventListener('wheel', event => {
      if (event.target.closest('.workflow-details')) return;
      event.preventDefault();
      this.actions.zoom(event);
    }, { passive: false });
    this.bindPan();
    this.scroll.addEventListener('scroll', () => this.draw());
    this.resize = new ResizeObserver(() => this.draw());
    this.resize.observe(viewport);
    actions.layer.append(this.frame);
    actions.position();
    this.paint();
    this.fit();
    this.refreshDiagnostics();
  }

  get scope() {
    return this.stack.at(-1);
  }

  get scopeKey() {
    return scopeId(this.model, this.scope);
  }

  close() {
    this.resize.disconnect();
    this.frame.remove();
    this.actions.layer.hidden = true;
    if (activeEditor === this) activeEditor = undefined;
    this.actions.close();
  }

  bindPan() {
    let previous;
    this.frame.addEventListener('pointerdown', event => {
      if (event.target.closest('.workflow-details') ||
          (event.button !== 1 && !(event.button === 0 && event.altKey))) return;
      event.preventDefault();
      event.stopPropagation();
      previous = [event.clientX, event.clientY];
      this.frame.setPointerCapture(event.pointerId);
    }, true);
    this.frame.addEventListener('pointermove', event => {
      if (!previous || !this.frame.hasPointerCapture(event.pointerId)) return;
      this.actions.pan([event.clientX - previous[0], event.clientY - previous[1]]);
      previous = [event.clientX, event.clientY];
    });
    this.frame.addEventListener('lostpointercapture', () => { previous = undefined; });
  }

  navigate(stack, path) {
    if (!stack.length) return;
    this.stack = stack;
    this.path = path;
    this.selected = null;
    this.warningNode = null;
    this.paint();
    this.fit();
  }

  message(text = '') {
    this.status.textContent = text;
  }

  diagnosticsSummary() {
    const issues = this.catalogError ? [this.catalogError]
      : this.issues.map(issue => `${issue.title} · ${issue.message}`);
    return summary(this.record, this.model, issues);
  }

  async refreshDiagnostics() {
    if (this.checking) return;
    this.checking = true;
    this.paintPorts();
    try {
      this.catalog = await readCatalog(this.model);
      this.catalogError = '';
    } catch (error) {
      this.catalog = null;
      this.catalogError = error.message;
    }
    this.checking = false;
    if (this.frame.isConnected) {
      this.paint();
      this.actions.change(this.diagnosticsSummary());
    }
  }

  scopedIssues(nodeId) {
    return this.issues.filter(issue => this.path.every((instance, index) => issue.path[index] === instance)
      && (nodeId === undefined || (issue.path.length === this.path.length
        ? issue.id === nodeId : issue.path[this.path.length] === nodeId)));
  }

  save() {
    const snapshot = structuredClone(this.record);
    this.saveQueue = this.saveQueue.catch(() => {}).then(() =>
      storage('readwrite', store => store.put(snapshot)));
    this.saveQueue.then(() => this.actions.change(this.diagnosticsSummary()), error =>
      this.message(error.message || 'The workflow could not be saved.'));
  }

  download() {
    const data = structuredClone(this.record.document);
    if (!this.model.api && this.record.mappings.root) {
      data.extra ||= {};
      data.extra.okapiWorkflowPorts = this.record.mappings.root;
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = element('a');
    link.href = url;
    link.download = `${this.record.title}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  setZoom(value) {
    const before = this.zoom;
    this.zoom = Math.max(0.08, Math.min(2, value));
    const x = (this.scroll.scrollLeft + this.scroll.clientWidth / 2) / before;
    const y = (this.scroll.scrollTop + this.scroll.clientHeight / 2) / before;
    this.size();
    this.scroll.scrollTo(x * this.zoom - this.scroll.clientWidth / 2, y * this.zoom - this.scroll.clientHeight / 2);
    this.draw();
  }

  fit() {
    this.setZoom(Math.min(1, this.scroll.clientWidth / this.width, this.scroll.clientHeight / this.height));
    this.scroll.scrollTo(0, 0);
    this.draw();
  }

  size() {
    this.layout.style.transform = `scale(${this.zoom})`;
    this.extent.style.width = `${this.width * this.zoom}px`;
    this.extent.style.height = `${this.height * this.zoom}px`;
  }

  draw() {
    const canvas = this.wires;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const pixelRatio = window.devicePixelRatio || 1;
    const logicalWidth = canvas.clientWidth;
    const logicalHeight = canvas.clientHeight;
    const scale = rect.width / logicalWidth;
    const width = Math.round(logicalWidth * pixelRatio);
    const height = Math.round(logicalHeight * pixelRatio);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    ctx.lineWidth = 1.25;
    const positions = new Map();
    const socket = key => {
      if (!positions.has(key)) positions.set(key, this.sockets.get(key)?.getBoundingClientRect());
      return positions.get(key);
    };
    for (const link of this.graph.links) {
      const from = socket(socketKey(link.from, 'output', link.output));
      const to = socket(socketKey(link.to, 'input', link.input));
      if (!from || !to) continue;
      const a = [(from.right - rect.left) / scale, ((from.top + from.bottom) / 2 - rect.top) / scale];
      const b = [(to.left - rect.left) / scale, ((to.top + to.bottom) / 2 - rect.top) / scale];
      const bend = Math.max(22, Math.abs(b[0] - a[0]) * 0.5);
      ctx.strokeStyle = link.type === '*' ? '#8792ab' : '#8495d8';
      ctx.beginPath();
      ctx.moveTo(...a);
      ctx.bezierCurveTo(a[0] + bend, a[1], b[0] - bend, b[1], ...b);
      ctx.stroke();
    }
  }

  paint() {
    this.graph = describeGraph(this.model, this.scope);
    this.issues = this.catalog ? diagnose(this.model, this.catalog) : [];
    this.breadcrumb.textContent = this.stack.map(scope => scope.name || this.record.title).join(' / ');
    this.back.hidden = this.stack.length === 1;
    this.layout.replaceChildren();
    this.sockets.clear();

    const positions = this.graph.nodes.map((node, index) => {
      const saved = this.record.positions[scopePositionKey(this.scopeKey, node.id)];
      const fallback = [index % 4 * 278, Math.floor(index / 4) * 220];
      const position = saved || node.position || fallback;
      return [0, 1].map(axis => {
        const coordinate = Number(position[axis]);
        return Number.isFinite(coordinate) ? Math.max(-100000, Math.min(100000, coordinate)) : 0;
      });
    });
    this.origin = positions.length ? [0, 1].map(axis => Math.min(...positions.map(pos => pos[axis])) - 35) : [0, 0];
    this.width = 0;
    this.height = 0;
    for (const [index, node] of this.graph.nodes.entries()) {
      const position = positions[index].map((value, axis) => value - this.origin[axis]);
      this.addNode(node, position);
    }
    this.size();
    this.paintPorts();
    this.draw();
  }

  addNode(node, [x, y]) {
    const card = element('article', 'workflow-card');
    card.classList.toggle('workflow-group-card', !!node.subgraph);
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
    const header = element('header', 'workflow-card-title');
    const title = element('strong', '', node.title);
    title.title = `${node.title} (#${node.id})`;
    header.append(title);
    if (node.subgraph) {
      const expand = button('+', () => {
        const scope = this.model.definitions.get(node.subgraph);
        if (this.stack.includes(scope)) {
          this.message('This subgraph already appears in the current path.');
          return;
        }
        this.navigate([...this.stack, scope], [...this.path, node.id]);
      });
      expand.setAttribute('aria-label', `Expand ${node.title}`);
      header.append(expand);
    }
    card.append(header);
    const warnings = this.scopedIssues(node.id);
    if (warnings.length) {
      const badge = button('!', () => {
        this.warningNode = node.id;
        this.selected = null;
        this.paintPorts();
        this.details.scrollTop = 0;
      });
      badge.className = 'workflow-warning';
      badge.setAttribute('aria-label', `Problems in ${node.title}`);
      badge.title = warnings[0].message;
      card.append(badge);
    }
    const columns = element('div', 'workflow-card-ports');
    for (const [direction, ports] of [['input', node.inputs], ['output', node.outputs]]) {
      const column = element('div', `workflow-column workflow-${direction}`);
      for (const entry of ports) {
        const key = socketKey(node.id, direction, entry.slot);
        const socket = button(entry.name, () => this.select({ direction, node, entry, key }));
        socket.className = entry.widget ? 'workflow-socket workflow-widget' : 'workflow-socket';
        socket.title = `${direction} · ${entry.name} · ${entry.type}`;
        socket.setAttribute('aria-label', `${node.title} ${direction} ${entry.name} (${entry.type})`);
        socket.dataset.key = key;
        column.append(socket);
        this.sockets.set(key, socket);
      }
      columns.append(column);
    }
    card.append(columns);
    this.layout.append(card);
    this.width = Math.max(this.width, x + card.offsetWidth + 35);
    this.height = Math.max(this.height, y + card.offsetHeight + 35);
    this.drag(header, card, node);
  }

  drag(handle, card, node) {
    let start;
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('button')) return;
      start = [event.clientX, event.clientY, card.offsetLeft, card.offsetTop, card.getBoundingClientRect().width / card.offsetWidth];
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', event => {
      if (!start) return;
      const [x, y] = point(start[2] + (event.clientX - start[0]) / start[4],
        start[3] + (event.clientY - start[1]) / start[4]);
      card.style.left = `${x}px`;
      card.style.top = `${y}px`;
      this.width = Math.max(this.width, x + card.offsetWidth + 35);
      this.height = Math.max(this.height, y + card.offsetHeight + 35);
      this.size();
      this.draw();
    });
    handle.addEventListener('lostpointercapture', () => {
      if (!start) return;
      const position = [card.offsetLeft + this.origin[0], card.offsetTop + this.origin[1]];
      const moved = card.offsetLeft !== start[2] || card.offsetTop !== start[3];
      start = null;
      if (!moved) return;
      this.record.positions[scopePositionKey(this.scopeKey, node.id)] = position;
      if (!this.model.api) {
        const raw = this.scope.nodes.find(raw => String(raw.id) === node.id);
        if (raw) raw.pos = position;
        else {
          const boundary = [this.scope.inputNode, this.scope.outputNode]
            .find(raw => raw && String(raw.id) === node.id);
          if (boundary?.bounding) boundary.bounding.splice(0, 2, ...position);
        }
      }
      this.save();
    });
  }

  select(port) {
    const before = this.selected;
    if (before && before.direction !== port.direction && !before.entry.widget && !port.entry.widget) {
      const [source, target] = before.direction === 'output' ? [before, port] : [port, before];
      try {
        connectPorts(this.model, this.scope, source.node.id, source.entry.slot, target.node.id, target.entry.slot);
        this.selected = null;
        this.message();
        this.paint();
        this.save();
      } catch (error) {
        this.message(error.message);
      }
      return;
    }
    this.selected = before?.key === port.key ? null : port;
    this.warningNode = null;
    this.message(this.selected && !port.entry.widget ? 'Select a compatible port to connect.' : '');
    this.paintPorts();
  }

  paintPorts() {
    const selection = this.selected;
    for (const socket of this.sockets.values()) {
      socket.classList.toggle('selected', socket.dataset.key === selection?.key);
    }
    this.details.replaceChildren();
    this.paintDiagnostics();
    const group = interfaceFor(this.model, this.scope, this.record.mappings[this.scopeKey]);
    this.details.append(element('h3', '', 'Group ports'));
    for (const [heading, ports] of [['Inputs', group.inputs], ['Outputs', group.outputs]]) {
      this.details.append(element('h4', '', heading));
      if (!ports.length) this.details.append(element('p', 'workflow-muted', 'None exposed'));
      for (const item of ports) {
        const row = element('div', 'workflow-port-row');
        row.append(element('span', '', item.name), element('code', '', item.type));
        this.details.append(row);
      }
    }
    if (!selection) return;
    const { direction, node, entry } = selection;
    this.details.append(element('h3', '', `${node.title} · ${entry.name}`));
    const boundary = [this.scope.inputNode, this.scope.outputNode].some(
      endpoint => endpoint && String(endpoint.id) === node.id);
    if (!boundary && (!entry.widget || !this.scope.inputNode)) {
      this.details.append(button(`Expose as group ${direction}`, () => {
        const mappings = this.record.mappings[this.scopeKey] ||= structuredClone(group);
        try {
          exposePort(this.model, this.scope, mappings, direction, node.id, entry, entry.name);
          this.message();
          this.selected = null;
          this.paint();
          this.save();
        } catch (error) {
          this.message(error.message);
        }
      }));
    }
    if (direction === 'input' && this.graph.links.some(link => link.to === node.id && link.input === entry.slot)) {
      this.details.append(button('Disconnect input', () => {
        disconnectPort(this.model, this.scope, node.id, entry.slot);
        this.selected = null;
        this.message();
        this.paint();
        this.save();
      }));
    }
    if ((this.model.api || entry.widget) && direction === 'input' && entry.value !== undefined) {
      const field = element('textarea');
      field.setAttribute('aria-label', 'Input value (JSON)');
      field.value = JSON.stringify(entry.value);
      this.details.append(field, button('Set input value', () => {
        try {
          setInputValue(this.model, this.scope, node.id, entry, JSON.parse(field.value));
          this.selected = null;
          this.message();
          this.paint();
          this.save();
        } catch {
          this.message('Enter a valid JSON value.');
        }
      }));
    }
  }

  paintDiagnostics() {
    const title = element('h3', '', 'Properties');
    const recheck = button(this.checking ? 'Checking…' : 'Recheck ComfyUI', () => this.refreshDiagnostics());
    recheck.disabled = this.checking;
    this.details.append(title, recheck);
    if (this.catalogError) this.details.append(element('p', 'workflow-diagnostic-log', this.catalogError));
    const issues = this.scopedIssues(this.warningNode ?? undefined);
    if (!issues.length) return;
    const section = element('section', 'workflow-diagnostics');
    const header = this.warningNode ? 'Node diagnostics' : 'Workflow diagnostics';
    section.append(element('h4', '', `${header} · ${issues.length}`));
    if (this.warningNode) section.append(button('Show all', () => {
      this.warningNode = null;
      this.paintPorts();
    }));
    for (const issue of issues) {
      const item = element('div', 'workflow-diagnostic');
      item.append(element('strong', '', issue.title), element('p', 'workflow-diagnostic-log', issue.message));
      if (issue.choices?.length) {
        const select = element('select');
        select.setAttribute('aria-label', `Installed model for ${issue.title}`);
        for (const name of issue.choices) {
          const option = element('option', '', name);
          option.value = name;
          select.append(option);
        }
        item.append(select, button('Use selected model', () => {
          issue.apply(select.value);
          this.paint();
          this.save();
        }));
      } else if (issue.dependency) {
        item.append(element('p', 'workflow-muted', `Install ${issue.dependency} in ComfyUI, then recheck.`),
          button('Copy dependency', async () => {
            try {
              await navigator.clipboard.writeText(issue.dependency);
              this.message('Dependency name copied.');
            } catch {
              this.message('The clipboard is unavailable.');
            }
          }));
      } else {
        item.append(element('p', 'workflow-muted', 'Add a compatible model to ComfyUI, then recheck.'));
      }
      section.append(item);
    }
    this.details.append(section);
  }
}

export async function openWorkflow(id, actions) {
  const record = await storage('readonly', store => store.get(id));
  if (!actions.isCurrent()) return;
  if (!record) throw new Error('The workflow file is no longer stored in this browser.');
  await styled;
  if (!actions.isCurrent()) return;
  activeEditor?.close();
  activeEditor = new WorkflowEditor(record, actions);
}
