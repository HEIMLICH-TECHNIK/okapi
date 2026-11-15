const get = id => document.getElementById(id);
const byId = {
  file: get('file'), pick: get('pick'), drop: get('drop-target'), stage: get('stage'),
  video: get('video'), message: get('viewer-message'), play: get('play'), time: get('time'),
  timeline: get('timeline'), source: get('show-source'), matte: get('show-matte'),
  status: get('status'), issue: get('issue'), run: get('run'), progress: get('progress'),
  download: get('download'), engine: get('engine'), signal: get('signal'),
};
const limit = 250 * 1024 * 1024;
let selected;
let sourceUrl;
let job;
let prompt;
let segment = 1;
let totalSegments = 1;
let socket;
let reconnect;
let modelReady = false;
let active = false;
let complete = false;
let renderError = false;
let currentView = 'source';
let timer;
let monitoring = false;

async function api(path, options) {
  const response = await fetch('/okapi/api/' + path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function actions() {
  byId.run.disabled = !modelReady || active || (!selected && !job) || complete || renderError;
  byId.pick.disabled = active;
  byId.drop.disabled = active;
  byId.matte.disabled = !complete;
  byId.download.hidden = !complete;
  const review = get('rerun-review');
  review.hidden = !job;
  if (job) {
    const url = new URL(`/okapi/review/${job}`, 'https://hmlh-server.tail6ad677.ts.net:8443');
    url.searchParams.set('workspace', location.origin);
    if (complete) url.searchParams.set('mode', 'compare');
    review.href = url.href;
  }
  document.querySelector('[data-node="run"]').disabled = byId.run.disabled;
  document.querySelector('[data-node="matte"]').disabled = !complete;
}

function status(text, value, issue = '') {
  byId.status.textContent = text;
  if (value == null) byId.progress.removeAttribute('value');
  else byId.progress.value = value;
  byId.issue.textContent = issue;
  byId.issue.hidden = !issue;
}

async function checkEngine() {
  try {
    const state = await api('status');
    modelReady = state.ready;
    byId.engine.textContent = state.ready ? 'ComfyUI · Ready' : 'ComfyUI · Model setup required';
    byId.signal.classList.toggle('ready', state.ready);
    if (state.ready && !active && job && !prompt && !complete && !renderError) {
      status('Clip uploaded · Ready to render', 0);
    }
    if (!active && !job && !selected) {
      status(state.ready ? 'Ready for a source clip' : 'Model setup required', 0,
        state.ready ? '' : 'You can upload and preview a clip while LTX is being set up.');
    }
  } catch {
    modelReady = false;
    byId.signal.classList.remove('ready');
    byId.engine.textContent = 'ComfyUI · Offline';
  }
  actions();
}

function clipPath(kind) {
  return `/okapi/api/jobs/${job}/${kind}`;
}

function viewer(view) {
  if (view === 'matte' && !complete) return;
  currentView = view;
  const videoUrl = view === 'matte' ? clipPath('matte') : sourceUrl || (job && clipPath('source'));
  byId.source.setAttribute('aria-pressed', view === 'source');
  byId.matte.setAttribute('aria-pressed', view === 'matte');
  byId.drop.hidden = Boolean(videoUrl);
  byId.video.hidden = !videoUrl;
  byId.message.hidden = true;
  if (videoUrl) byId.video.src = videoUrl;
  else byId.video.removeAttribute('src');
  byId.video.load();
  byId.video.muted = view === 'matte';
  get('viewer-meta').textContent = '— × —';
}

async function choose(file) {
  if (!file || active) return;
  if (file.size > limit || !/\.(mp4|mov|m4v|webm|mkv)$/i.test(file.name)) {
    status('Choose another clip', 0, 'Use MP4, MOV, M4V, WebM or MKV, up to 250 MB.');
    return;
  }
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  sourceUrl = URL.createObjectURL(file);
  selected = file;
  job = prompt = null;
  complete = renderError = false;
  sessionStorage.removeItem('okapiJob');
  get('file-name').textContent = file.name;
  get('file-name').title = file.name;
  get('format').textContent = '—';
  get('resize-note').hidden = true;
  viewer('source');
  active = true;
  actions();
  try {
    status('Uploading…', 0);
    const uploaded = await upload();
    job = uploaded.id;
    sessionStorage.setItem('okapiJob', job);
    setMetadata(uploaded);
    status(modelReady ? 'Clip uploaded · Ready to render' : 'Clip uploaded · Waiting for models', 0);
  } catch (error) {
    status('Upload failed', 0, error.message);
  } finally {
    active = false;
    actions();
  }
}

function upload() {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const form = new FormData();
    form.append('video', selected);
    request.open('POST', '/okapi/api/upload');
    request.responseType = 'json';
    request.timeout = 180000;
    request.upload.addEventListener('progress', event => {
      if (!event.lengthComputable) return;
      const pct = Math.floor(100 * event.loaded / event.total);
      status(pct === 100 ? 'Preparing clip…' : `Uploading · ${pct}%`, pct === 100 ? null : pct);
    });
    request.onload = () => request.status === 201
      ? resolve(request.response)
      : reject(new Error(request.response?.error || 'Upload failed.'));
    request.onerror = request.ontimeout = () => reject(new Error('Upload connection interrupted.'));
    request.send(form);
  });
}

function disconnectProgress() {
  clearTimeout(reconnect);
  if (!socket) return;
  socket.onclose = null;
  socket.close();
  socket = null;
}

function segmentLabel() {
  return totalSegments > 1 ? ` · Segment ${segment}/${totalSegments}` : '';
}

function renderProgress(fraction = 0) {
  return Math.min(99, 100 * (segment - 1 + fraction) / totalSegments);
}

function connectProgress() {
  disconnectProgress();
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${scheme}//${location.host}/comfyui/ws?clientId=${job}`);
  socket.onclose = () => {
    if (active) reconnect = setTimeout(connectProgress, 3000);
  };
  socket.onmessage = event => {
    if (typeof event.data !== 'string' || !active) return;
    const message = JSON.parse(event.data);
    const data = message.data;
    if (data?.prompt_id !== prompt) return;
    if (message.type === 'progress' && data.node === 'denoise' && data.max) {
      status(`Generating matte${segmentLabel()} · ${data.value}/${data.max}`, renderProgress(data.value / data.max));
    }
    if (message.type === 'executing' && ['decode', 'trim', 'crop_matte', 'matte', 'save'].includes(data.node)) {
      status(`Decoding matte${segmentLabel()}…`, renderProgress(0.99));
    }
    if (['execution_success', 'execution_error', 'execution_interrupted'].includes(message.type)) monitor();
  };
}

function setMetadata(data, original = data.original, total = data.total_segments) {
  totalSegments = total || 1;
  const { width, height, frames, fps } = data;
  get('format').textContent = `${width} × ${height} · ${frames}f · ${Number(fps.toFixed(2))} fps`;
  const note = get('resize-note');
  const notices = [];
  if (original) notices.push(`Auto-resized ${original.width} × ${original.height} → ${width} × ${height}. The matte uses the new size.`);
  if (totalSegments > 1) notices.push(`All ${frames} frames will render in ${totalSegments} segments and download as one matte.`);
  note.textContent = notices.join(' ');
  note.hidden = !notices.length;
}

async function monitor() {
  clearTimeout(timer);
  const requestedJob = job;
  if (!requestedJob || monitoring) return;
  monitoring = true;
  try {
    const response = await api('jobs/' + requestedJob);
    if (job !== requestedJob) return;
    setMetadata(response.media, response.original, response.total_segments);
    const previousPrompt = prompt;
    prompt = response.prompt;
    segment = response.segment || 1;
    if (response.state === 'complete') {
      complete = true;
      active = false;
      status('Matte ready', 100);
      byId.download.href = clipPath('download');
      if (currentView !== 'matte') viewer('matte');
    } else if (response.state === 'failed') {
      active = false;
      renderError = true;
      status('Render failed', 0, response.error);
    } else if (response.state === 'joining') {
      active = true;
      status('Joining matte segments…', 99);
      timer = setTimeout(monitor, 3000);
    } else if (response.state === 'queued' || response.state === 'running') {
      active = true;
      if (response.state === 'queued') status(`Queued in ComfyUI${segmentLabel()}`, renderProgress());
      else if (previousPrompt !== prompt || !/^(Generating|Decoding)/.test(byId.status.textContent)) {
        status(`Rendering${segmentLabel()}…`, renderProgress());
      }
      timer = setTimeout(monitor, 3000);
    }
  } catch (error) {
    if (job !== requestedJob) return;
    status('Checking render status…', null, error.message);
    if (active) timer = setTimeout(monitor, 5000);
  } finally {
    monitoring = false;
  }
  if (!active) disconnectProgress();
  actions();
}

async function render() {
  if (byId.run.disabled) return;
  active = true;
  actions();
  try {
    if (!job) {
      status('Uploading…', 0);
      const uploaded = await upload();
      job = uploaded.id;
      sessionStorage.setItem('okapiJob', job);
      setMetadata(uploaded);
    }
    status('Submitting to ComfyUI…', null);
    connectProgress();
    const submitted = await api('jobs/' + job, { method: 'POST' });
    prompt = submitted.prompt;
    await monitor();
  } catch (error) {
    active = false;
    disconnectProgress();
    status('Unable to start render', 0, error.message);
    actions();
  }
}

byId.pick.onclick = byId.drop.onclick = () => byId.file.click();
byId.file.onchange = () => { choose(byId.file.files[0]); byId.file.value = ''; };
byId.stage.ondragover = event => { event.preventDefault(); if (!active) byId.stage.classList.add('dragging'); };
byId.stage.ondragleave = () => byId.stage.classList.remove('dragging');
byId.stage.ondrop = event => {
  event.preventDefault();
  byId.stage.classList.remove('dragging');
  choose(event.dataTransfer.files[0]);
};
byId.run.onclick = render;
byId.source.onclick = () => viewer('source');
byId.matte.onclick = () => viewer('matte');
document.querySelector('[data-node="source"]').onclick = () => selected || job ? viewer('source') : byId.file.click();
document.querySelector('[data-node="run"]').onclick = render;
document.querySelector('[data-node="matte"]').onclick = () => viewer('matte');
byId.play.onclick = () => byId.video.paused
  ? byId.video.play().catch(() => {}) : byId.video.pause();
byId.timeline.oninput = () => { byId.video.currentTime = Number(byId.timeline.value); };
byId.video.onloadedmetadata = () => {
  byId.play.disabled = byId.timeline.disabled = false;
  byId.timeline.max = byId.video.duration;
  get('viewer-meta').textContent = `${byId.video.videoWidth} × ${byId.video.videoHeight}`;
};
byId.video.onemptied = () => {
  byId.play.disabled = byId.timeline.disabled = true;
  byId.timeline.value = 0;
  byId.time.textContent = '00:00.00';
};
byId.video.onerror = () => {
  byId.message.textContent = 'This clip can be rendered, but its codec cannot be played in this browser.';
  byId.message.hidden = false;
};
byId.video.onplay = () => { byId.play.textContent = 'Ⅱ'; };
byId.video.onpause = () => { byId.play.textContent = '▶'; };
byId.video.ontimeupdate = () => {
  const seconds = byId.video.currentTime;
  byId.timeline.value = seconds;
  byId.time.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;
};

async function restore() {
  const requested = new URLSearchParams(location.search).get('job');
  job = /^[0-9a-f]{32}$/.test(requested || '') ? requested : sessionStorage.getItem('okapiJob');
  if (requested && requested === job) {
    sessionStorage.setItem('okapiJob', job);
    history.replaceState(null, '', location.pathname);
  }
  if (!job) return;
  try {
    const previous = await api('jobs/' + job);
    get('file-name').textContent = previous.name;
    get('file-name').title = previous.name;
    viewer('source');
    if (previous.state === 'uploaded') status('Clip uploaded', 0);
    if (previous.prompt || ['queued', 'running', 'joining'].includes(previous.state)) {
      active = true;
      connectProgress();
    }
    await monitor();
  } catch {
    job = null;
    sessionStorage.removeItem('okapiJob');
    actions();
  }
}
checkEngine();
restore();
setInterval(checkEngine, 30000);
