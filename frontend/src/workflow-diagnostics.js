import { describeGraph, loadWorkflow } from './workflow-graph.js';

const frontendTypes = new Set(['Note', 'MarkdownNote', 'Reroute', 'PrimitiveNode', 'Group']);
const loaderFields = {
  CheckpointLoaderSimple: ['ckpt_name'],
  UNETLoader: ['unet_name'],
  CLIPLoader: ['clip_name'],
  DualCLIPLoader: ['clip_name1', 'clip_name2'],
  TripleCLIPLoader: ['clip_name1', 'clip_name2', 'clip_name3'],
  VAELoader: ['vae_name'],
  CLIPVisionLoader: ['clip_name'],
  ControlNetLoader: ['control_net_name'],
  UpscaleModelLoader: ['model_name'],
  LoraLoader: ['lora_name'],
  LoraLoaderModelOnly: ['lora_name'],
};

export async function readCatalog(model) {
  const types = model.api
    ? Object.values(model.root).map(node => node.class_type)
    : [model.document, ...model.definitions.values()].flatMap(scope => scope.nodes.map(node => node.type));
  const classes = [...new Set(types)].filter(type => !frontendTypes.has(type) && !model.definitions.has(type));
  if (!classes.length) return {};
  const response = await fetch('/okapi/api/workflow-diagnostics', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(classes),
  });
  if (!response.ok) throw new Error('Could not read ComfyUI’s installed nodes and models.');
  return response.json();
}

function assignment(node, names, positional = -1) {
  const list = Array.isArray(node.widgets_values) ? node.widgets_values : null;
  const named = node.widgets_values_named || (!list && node.widgets_values);
  const name = names.find(key => key && typeof named?.[key] === 'string');
  const value = name ? named[name] : list?.[positional];
  if (typeof value !== 'string' || !value) return null;
  let index = positional;
  if (list && name && list[index] !== value && list.filter(item => item === value).length === 1) {
    index = list.indexOf(value);
  }
  return {value, apply(replacement) {
    if (name) named[name] = replacement;
    if (list && list[index] === value) list[index] = replacement;
  }};
}

function modelAssignment(model, scope, graph, node, field, instance) {
  if (model.api) {
    const value = node.inputs[field];
    return typeof value === 'string' && value
      ? {value, apply: replacement => { node.inputs[field] = replacement; }}
      : null;
  }
  const slot = (node.inputs || []).findIndex(input => input?.name === field || input?.widget?.name === field);
  const input = graph.links.find(link => link.to === String(node.id) && link.input === slot);
  if (input) {
    if (!scope.inputNode || input.from !== String(scope.inputNode.id)) return null;
    if (instance) {
      const exposed = scope.inputs?.[input.output];
      const external = instance.inputs?.[input.output];
      if (external?.link != null) return null;
      const bound = assignment(instance, [external?.widget?.name, external?.name, exposed?.name, field]);
      if (bound) return bound;
    }
  }
  return assignment(node, [field], (loaderFields[node.type] || []).indexOf(field));
}

export function diagnose(model, catalog) {
  const results = [];
  let checked = 0;
  function walk(scope, path, instance, ancestors) {
    if (ancestors.has(scope)) return;
    const next = new Set([...ancestors, scope]);
    const graph = describeGraph(model, scope);
    const rawNodes = model.api ? Object.entries(scope) : scope.nodes.map(node => [String(node.id), node]);
    for (const [id, node] of rawNodes) {
      if (++checked > 5000) return;
      const type = model.api ? node.class_type : node.type;
      const title = graph.nodes.find(display => display.id === id)?.title || type;
      const definition = model.definitions.get(type);
      if (definition) {
        walk(definition, [...path, id], node, next);
        continue;
      }
      if (!Object.hasOwn(catalog, type) || node.mode === 2 || node.mode === 4) continue;
      const options = catalog[type];
      if (options === null) {
        results.push({path, id, title, message: `Node type not installed: ${type}`, dependency: node.properties?.cnr_id || type});
        continue;
      }
      for (const [field, choices] of Object.entries(options)) {
        const current = modelAssignment(model, scope, graph, node, field, instance);
        if (current && !choices.includes(current.value)) {
          results.push({path, id, title, message: `Model not found for ${field}: ${current.value}`, choices, apply: current.apply});
        }
      }
    }
  }
  const instance = !model.api && model.root !== model.document ? model.document.nodes[0] : null;
  walk(model.root, [], instance, new Set());
  return results;
}

export async function workflowDiagnostics(document) {
  const model = loadWorkflow(document);
  return diagnose(model, await readCatalog(model));
}
