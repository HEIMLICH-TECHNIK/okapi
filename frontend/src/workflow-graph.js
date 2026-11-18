const ports = value => Array.isArray(value) ? value : [];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const idOf = value => String(value);
const keyOf = (node, slot) => JSON.stringify([String(node), String(slot)]);
const loaderInput = type => /^(?:VHS_)?Load(Video|Image|Audio)/.exec(type)?.[1].toLowerCase();

function widgetType(value) {
  if (typeof value === 'string') return 'STRING';
  if (typeof value === 'boolean') return 'BOOLEAN';
  if (typeof value === 'number') return Number.isInteger(value) ? 'INT' : 'FLOAT';
  return '*';
}

function widgetInputs(node, sockets) {
  const group = object(node.widgets_values_named) ? 'widgets_values_named'
    : object(node.widgets_values) ? 'widgets_values' : null;
  const named = group ? Object.entries(node[group]) : [];
  const loader = loaderInput(node.type);
  const values = named.length
    ? named.map(([name, value]) => [group, name, name, value])
    : loader && typeof node.widgets_values?.[0] === 'string'
      ? [['widgets_values', 0, loader, node.widgets_values[0]]] : [];
  return values.filter(([, , name]) => sockets.every(socket => socket.name !== name))
    .map(([key, index, name, value]) => ({
      name, slot: `widget:${key}:${index}`, value, type: widgetType(value), widget: [key, index],
    }));
}

const port = (value, index) => ({
  name: value?.label || value?.name || `Port ${index + 1}`,
  type: Array.isArray(value?.type) ? 'COMBO' : value?.type || '*',
});

function linkFrom(value) {
  const parts = Array.isArray(value)
    ? value
    : [value.id, value.origin_id, value.origin_slot, value.target_id, value.target_slot, value.type];
  const [id, from, output, to, input, type] = parts;
  return { id, from: idOf(from), output, to: idOf(to), input, type: type || '*' };
}

function validateScope(graph) {
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.links ?? [])) {
    throw new Error('The workflow has an invalid node or link list.');
  }
  const seen = new Set();
  for (const node of graph.nodes) {
    if (!object(node) || !['string', 'number'].includes(typeof node.id) ||
        typeof node.type !== 'string' || seen.has(idOf(node.id))) {
      throw new Error('The workflow contains a missing or duplicate node ID.');
    }
    seen.add(idOf(node.id));
  }
  if (ports(graph.links).some(link => !Array.isArray(link) && !object(link))) {
    throw new Error('The workflow has an invalid link.');
  }
}

function apiGraph(value) {
  const entries = Object.values(value);
  return entries.length > 0 && entries.every(node =>
    object(node) && typeof node.class_type === 'string' && object(node.inputs));
}

export function loadWorkflow(document) {
  if (!object(document)) throw new Error('Choose a ComfyUI workflow JSON file.');
  const definitions = new Map();
  const pending = [document];
  let count = 0;
  if (Array.isArray(document.nodes)) {
    while (pending.length) {
      const graph = pending.pop();
      validateScope(graph);
      count += graph.nodes.length;
      for (const definition of ports(graph.definitions?.subgraphs)) {
        if (!object(definition) || typeof definition.id !== 'string' || definitions.has(definition.id)) {
          throw new Error('The workflow has a missing or duplicate subgraph ID.');
        }
        definitions.set(definition.id, definition);
        pending.push(definition);
      }
    }
    if (count === 0 || count > 5000) throw new Error('Choose a workflow with 1 to 5,000 nodes.');
    const [single] = document.nodes;
    const root = document.nodes.length === 1 && definitions.get(single.type);
    return { document, root: root || document, definitions, api: false, count };
  }
  const prompt = object(document.prompt) && apiGraph(document.prompt) ? document.prompt : document;
  if (!apiGraph(prompt)) throw new Error('Choose a ComfyUI workflow or API-format JSON file.');
  count = Object.keys(prompt).length;
  if (count > 5000) throw new Error('Choose a workflow with up to 5,000 nodes.');
  return { document, root: prompt, definitions, api: true, count };
}

export function scopeId(model, scope) {
  return model.definitions.get(scope.id) === scope ? scope.id : 'root';
}

function apiConnection(value, scope) {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' &&
    Number.isInteger(value[1]) && value[1] >= 0 && Object.hasOwn(scope, value[0]);
}

export function describeGraph(model, scope) {
  if (model.api) {
    const outputCounts = new Map();
    const links = [];
    for (const [to, node] of Object.entries(scope)) {
      for (const [input, value] of Object.entries(node.inputs)) {
        if (!apiConnection(value, scope)) continue;
        const [from, output] = value;
        outputCounts.set(from, Math.max(outputCounts.get(from) || 0, output + 1));
        links.push({ id: keyOf(to, input), from, output, to, input, type: '*' });
      }
    }
    return {
      links,
      nodes: Object.entries(scope).map(([id, node]) => ({
        id, title: node._meta?.title || node.class_type, type: node.class_type,
        inputs: Object.entries(node.inputs).map(([name, value]) => ({
          name, slot: name, type: '*', value: apiConnection(value, scope) ? undefined : value,
        })),
        outputs: Array.from({ length: Math.max(1, Math.min(256, outputCounts.get(id) || 0)) },
          (_, slot) => ({ name: `Output ${slot + 1}`, slot, type: '*' })),
      })),
    };
  }
  const links = ports(scope.links).map(linkFrom);
  const nodes = scope.nodes.map(node => {
    const inputs = ports(node.inputs).map((value, slot) => ({ ...port(value, slot), slot }));
    return {
      id: idOf(node.id), title: node.title || model.definitions.get(node.type)?.name || node.type,
      type: node.type, position: node.pos, subgraph: model.definitions.get(node.type)?.id,
      inputs: [...inputs, ...widgetInputs(node, inputs)],
      outputs: ports(node.outputs).map((value, slot) => ({ ...port(value, slot), slot })),
    };
  });
  if (scope.inputNode && Array.isArray(scope.inputs)) {
    nodes.unshift({
      id: idOf(scope.inputNode.id), title: 'Group inputs', position: scope.inputNode.bounding,
      inputs: [], outputs: scope.inputs.map((value, slot) => ({ ...port(value, slot), slot })),
    });
  }
  if (scope.outputNode && Array.isArray(scope.outputs)) {
    nodes.push({
      id: idOf(scope.outputNode.id), title: 'Group outputs', position: scope.outputNode.bounding,
      inputs: scope.outputs.map((value, slot) => ({ ...port(value, slot), slot })), outputs: [],
    });
  }
  return { nodes, links };
}

export function interfaceFor(model, scope, mappings = {}) {
  if (!model.api && (Array.isArray(scope.inputs) || Array.isArray(scope.outputs))) {
    return {
      inputs: ports(scope.inputs).map(port),
      outputs: ports(scope.outputs).map(port),
    };
  }
  if (Array.isArray(mappings.inputs) && Array.isArray(mappings.outputs)) return mappings;
  const graph = describeGraph(model, scope);
  const inputs = [];
  const outputs = [];
  for (const node of graph.nodes) {
    if (loaderInput(node.type)) {
      for (const input of node.inputs) {
        if (/^(?:image|video|audio|file|filename|path|upload)$/.test(input.name)) {
          const { value, ...mapping } = input;
          inputs.push({ ...mapping, node: node.id });
        }
      }
    }
    if (/^(?:VHS_VideoCombine|Save|Preview)/.test(node.type)) {
      for (const link of graph.links.filter(link => link.to === node.id)) {
        const source = graph.nodes.find(item => item.id === link.from);
        const output = source?.outputs.find(item => item.slot === link.output);
        if (output && !outputs.some(item => item.node === source.id && item.slot === output.slot)) {
          outputs.push({ ...output, name: `${node.title} · ${output.name}`, node: source.id });
        }
      }
    }
  }
  return { inputs, outputs };
}

export function compatible(from, to) {
  const types = String(from).split(',').map(type => type.trim());
  const accepted = String(to).split(',').map(type => type.trim());
  return types.includes('*') || accepted.includes('*') || types.some(type => accepted.includes(type));
}

function removeUiLink(scope, link) {
  const index = scope.links.findIndex(raw => linkFrom(raw).id === link.id);
  if (index < 0) return;
  scope.links.splice(index, 1);
  const source = scope.nodes.find(node => idOf(node.id) === link.from);
  const target = scope.nodes.find(node => idOf(node.id) === link.to);
  const out = source?.outputs?.[link.output];
  const incoming = target?.inputs?.[link.input];
  if (out) out.links = ports(out.links).filter(id => id !== link.id);
  if (incoming) incoming.link = null;
  if (scope.inputNode && idOf(scope.inputNode.id) === link.from) {
    const input = scope.inputs[link.output];
    if (input) input.linkIds = ports(input.linkIds).filter(id => id !== link.id);
  }
  if (scope.outputNode && idOf(scope.outputNode.id) === link.to) {
    const output = scope.outputs[link.input];
    if (output) output.linkIds = ports(output.linkIds).filter(id => id !== link.id);
  }
}

function addUiLink(scope, from, output, to, input, type) {
  const oldLinks = scope.links ||= [];
  const lastId = Math.max(scope.last_link_id || 0, scope.state?.lastLinkId || 0);
  const id = oldLinks.reduce((max, link) => Math.max(max, Number(linkFrom(link).id) || 0), lastId) + 1;
  if (scope.state) scope.state.lastLinkId = id;
  if ('last_link_id' in scope) scope.last_link_id = id;
  const source = scope.nodes.find(node => idOf(node.id) === from);
  const target = scope.nodes.find(node => idOf(node.id) === to);
  const originId = source?.id ?? scope.inputNode?.id;
  const targetId = target?.id ?? scope.outputNode?.id;
  const legacy = oldLinks.length ? Array.isArray(oldLinks[0]) : scope.version === 0.4;
  oldLinks.push(legacy ? [id, originId, output, targetId, input, type]
    : { id, origin_id: originId, origin_slot: output, target_id: targetId, target_slot: input, type });
  if (source) {
    const port = source.outputs[output];
    port.links = [...ports(port.links), id];
  } else {
    const port = scope.inputs[output];
    port.linkIds = [...ports(port.linkIds), id];
  }
  if (target) target.inputs[input].link = id;
  else {
    const port = scope.outputs[input];
    port.linkIds = [...ports(port.linkIds), id];
  }
}

export function connectPorts(model, scope, from, output, to, input) {
  const { nodes, links } = describeGraph(model, scope);
  const source = nodes.find(node => node.id === from)?.outputs.find(port => port.slot === output);
  const target = nodes.find(node => node.id === to)?.inputs.find(port => port.slot === input);
  if (target?.widget) throw new Error('This setting has a value field. Choose a node input socket to make a wire.');
  if (!source || !target || !compatible(source.type, target.type)) {
    throw new Error('Select an output and a compatible input.');
  }
  const pending = [to];
  const seen = new Set();
  const outgoing = new Map();
  for (const link of links) {
    if (!outgoing.has(link.from)) outgoing.set(link.from, []);
    outgoing.get(link.from).push(link.to);
  }
  while (pending.length) {
    const node = pending.pop();
    if (node === from) throw new Error('This connection creates a cycle.');
    if (seen.has(node)) continue;
    seen.add(node);
    for (const next of outgoing.get(node) || []) pending.push(next);
  }
  const old = links.find(link => link.to === to && link.input === input);
  if (old?.from === from && old.output === output) return;
  if (model.api) scope[to].inputs[input] = [from, output];
  else {
    if (old) removeUiLink(scope, old);
    addUiLink(scope, from, output, to, input, source.type === '*' ? target.type : source.type);
  }
}

export function disconnectPort(model, scope, to, input) {
  const link = describeGraph(model, scope).links.find(link => link.to === to && link.input === input);
  if (!link) return;
  if (model.api) scope[to].inputs[input] = null;
  else removeUiLink(scope, link);
}

export function exposePort(model, scope, mappings, direction, node, selection, name) {
  const field = direction === 'input' ? 'inputs' : 'outputs';
  if (model.api || !scope.inputNode || !scope.outputNode ||
      !Array.isArray(scope.inputs) || !Array.isArray(scope.outputs)) {
    const list = mappings[field];
    if (!list.some(item => item.node === node && item.slot === selection.slot)) {
      const { slot, type, widget } = selection;
      list.push({ node, slot, name, type, ...(widget && { widget }) });
    }
    return;
  }
  const list = scope[field];
  const index = list.length;
  list.push({ id: crypto.randomUUID(), name, type: selection.type, linkIds: [] });
  try {
    if (direction === 'input') {
      connectPorts(model, scope, idOf(scope.inputNode.id), index, node, selection.slot);
    } else {
      connectPorts(model, scope, node, selection.slot, idOf(scope.outputNode.id), index);
    }
  } catch (error) {
    list.pop();
    throw error;
  }
  for (const graph of [model.document, ...model.definitions.values()]) {
    for (const instance of graph.nodes) {
      if (instance.type !== scope.id) continue;
      const slots = instance[field] ||= [];
      for (const [slot, exposed] of list.entries()) {
        if (slots[slot]) continue;
        const { name, type } = exposed;
        slots[slot] = direction === 'input' ? { name, type, link: null } : { name, type, links: [] };
      }
    }
  }
}

export function setInputValue(model, scope, node, entry, value) {
  if (model.api) {
    scope[node].inputs[entry.slot] = value;
  } else if (entry.widget) {
    const raw = scope.nodes.find(item => idOf(item.id) === node);
    const [key, index] = entry.widget;
    raw[key][index] = value;
  }
}
