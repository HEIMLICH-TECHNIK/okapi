let notify;
let uploading = false;
let socket;
let viewer;
let compactViewer = false;
let seekBar;
let frameDisplay = false;
let mediaFps = 24;
let mediaFrameCount = 0;
let lastClock = '';
let soundEnabled = false;
let sourceSound;
let switchingTimeline;
let restoringPlayback = false;
let mediaKey = '';
let revision = 0;
let placement = '';
let choosingFile = false;
let lastInteraction = 0;
let checkingBuild = false;
let availableBuild;
let reloading = false;
let fitting = false;
let mediaClip = '';
let clipPlayback;
let workspaceTyping = false;
let viewerBounds;
let graphBounds;
let workflowFrame;
let requestedWorkflow;
let pointerPosition;
let controlPressed = false;
let elbowModifier = false;
const forwardedWheels = new WeakSet();
const resume = readUpdateSnapshot();

const input = () => document.getElementById('okapi-file');
const surface = () => document.getElementById('okapi-media');
const aboutDialog = () => document.getElementById('okapi-about');
const profileMenu = () => document.getElementById('okapi-profile');
const profileMenuOpen = () => profileMenu().matches(':popover-open');
const send = (kind, payload) => notify(kind, JSON.stringify(payload));

function updateElbowModifier(enabled) {
  if (elbowModifier === enabled) return;
  elbowModifier = enabled;
  send('elbow_modifier', enabled);
}

export function bindBrowser(callback) {
  notify = callback;
  bindProfile();
  input().addEventListener('change', event => {
    choosingFile = false;
    const file = event.target.files[0];
    input().value = '';
    if (file) upload(file);
  });
  input().addEventListener('cancel', () => { choosingFile = false; });
  const workflowFile = document.getElementById('okapi-workflow-file');
  workflowFile.addEventListener('change', async () => {
    const file = workflowFile.files[0];
    workflowFile.value = '';
    if (!file) return;
    try {
      const { importWorkflow, checkWorkflow } = await workflowEditor();
      const imported = await importWorkflow(file);
      send('workflow_import', imported);
      const checked = await checkWorkflow(imported.id);
      if (checked) send('workflow_updated', checked);
    } catch (error) {
      send('workflow_error', error.message);
    }
  });
  for (const type of ['pointerdown', 'pointerup', 'keydown', 'wheel']) {
    document.addEventListener(type, () => { lastInteraction = performance.now(); }, { passive: true, capture: true });
  }
  for (const type of ['pointermove', 'pointerdown']) {
    document.addEventListener(type, event => {
      pointerPosition = [event.clientX, event.clientY];
    }, { passive: true, capture: true });
  }
  document.addEventListener('pointerdown', () => {
    if (sourceSound?.blocked) {
      sourceSound.blocked = false;
      syncSeekBar();
    }
  }, true);
  surface().addEventListener('wheel', remapViewerWheel, { capture: true, passive: false });
  window.addEventListener('keyup', event => {
    controlPressed = event.ctrlKey;
    updateElbowModifier((event.ctrlKey || event.metaKey) && !aboutDialog().open && !profileMenuOpen());
  }, true);
  window.addEventListener('blur', () => {
    controlPressed = false;
    updateElbowModifier(false);
  });
  window.addEventListener('keydown', event => {
    controlPressed = event.ctrlKey;
    updateElbowModifier((event.ctrlKey || event.metaKey) && !aboutDialog().open && !profileMenuOpen());
    if (event.repeat || aboutDialog().open || profileMenuOpen() ||
        event.target.closest?.('#okapi-workflow-editor') ||
        event.target.closest?.('#okapi-profile-button')) return;
    const key = event.key;
    const element = surface();
    const editor = event.target.closest?.('input, textarea, [contenteditable]:not([contenteditable="false"])');
    const canvasInput = editor?.tagName === 'INPUT' && editor.style.width === '1px';
    const workspaceInput = canvasInput && editor.previousElementSibling?.id === 'okapi-workspace';
    const typing = editor && !(workspaceInput && !workspaceTyping);
    const inside = bounds => pointerPosition && bounds &&
      pointerPosition[0] >= bounds.left && pointerPosition[0] < bounds.right &&
      pointerPosition[1] >= bounds.top && pointerPosition[1] < bounds.bottom;
    const overViewer = inside(viewerBounds);
    const overGraph = inside(graphBounds);
    const modifier = event.metaKey || event.ctrlKey;
    const bare = !modifier && !event.altKey && !event.shiftKey;
    const stop = () => {
      lastInteraction = performance.now();
      event.preventDefault();
      event.stopPropagation();
    };

    const fit = bare && (event.code === 'KeyH' || ['h', 'ㅗ'].includes(key.toLowerCase()) ||
      (overViewer && event.code === 'KeyF'));
    if (fit && viewer?.ready && !element.classList.contains('workspace-hidden') &&
        (!typing || (canvasInput && overViewer))) {
      stop();
      fitViewer();
      return;
    }
    if (typing || event.isComposing) return;

    if (bare && /^[1-5]$/.test(key)) {
      stop();
      send('viewer_slot', { index: Number(key) - 1, bind_selected: !!overGraph });
      return;
    }
    if (bare && overViewer && ['ArrowUp', 'ArrowDown'].includes(key)) {
      stop();
      send('viewer_cycle', key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (!overGraph) return;
    let shortcut;
    if (modifier && !event.altKey && !event.shiftKey) {
      if (event.code === 'KeyD') shortcut = 'disconnect';
      if (event.code === 'KeyI') shortcut = 'viewer';
    } else if (!modifier && !event.altKey) {
      if (event.code === 'Backslash') shortcut = event.shiftKey ? 'snap-selected' : 'snap';
      if (key === '+') shortcut = 'zoom-in';
      if (bare) shortcut ||= ({
        Tab: 'search', Slash: 'search', KeyB: 'blur', KeyD: 'disable', KeyF: 'fit', KeyL: 'autoplace',
        Delete: 'delete', Backspace: 'delete', Period: 'dot', NumpadDecimal: 'dot',
        Escape: 'clear', Minus: 'zoom-out', NumpadSubtract: 'zoom-out',
        ArrowUp: 'upstream', ArrowDown: 'downstream'
      })[event.code];
    }
    if (shortcut) {
      stop();
      send('graph_shortcut', shortcut);
    }
  }, true);
  document.addEventListener('dragover', event => {
    if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
  });
  document.addEventListener('drop', event => {
    if (!event.dataTransfer?.files.length) return;
    event.preventDefault();
    if (input().disabled || aboutDialog().open || profileMenuOpen()) return;
    upload(event.dataTransfer.files[0]);
  }, true);
}

export function positionProfile(x, y, width, height) {
  const button = document.getElementById('okapi-profile-button');
  const canvas = document.getElementById('okapi-workspace').getBoundingClientRect();
  const left = canvas.left + x;
  const top = canvas.top + y;
  button.style.left = `${left}px`;
  button.style.top = `${top}px`;
  button.style.width = `${width}px`;
  button.style.height = `${height}px`;
  button.hidden = false;
  const menu = profileMenu();
  menu.style.top = `${top + height + 6}px`;
  menu.style.right = `${Math.max(10, window.innerWidth - left - width)}px`;
}

function bindProfile() {
  const button = document.getElementById('okapi-profile-button');
  const menu = profileMenu();
  const settings = document.getElementById('okapi-profile-settings');
  const form = settings.querySelector('form');
  const nameField = form.elements.namedItem('name');
  const emailField = form.elements.namedItem('email');
  const error = form.querySelector('.profile-error');
  const storageKey = 'okapiProfile';
  let profile = { name: 'Mina Park', email: 'mina@example.com' };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (typeof saved?.name === 'string' && saved.name && typeof saved.email === 'string' && saved.email) {
      profile = saved;
    }
  } catch {
    // Use the default profile if storage is unavailable.
  }

  function render() {
    const initials = profile.name.split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join('').toUpperCase();
    for (const element of [button, menu]) {
      element.querySelector('.profile-avatar').textContent = initials;
      element.querySelector('.profile-name').textContent = profile.name;
    }
    button.setAttribute('aria-label', `User profile: ${profile.name}`);
    menu.querySelector('.profile-email').textContent = profile.email;
    nameField.value = profile.name;
    emailField.value = profile.email;
  }

  menu.addEventListener('toggle', () => {
    const open = profileMenuOpen();
    button.setAttribute('aria-expanded', String(open));
    if (open) {
      updateElbowModifier(false);
    } else {
      settings.open = false;
      error.hidden = true;
      render();
    }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const name = nameField.value.trim();
    if (!name) {
      nameField.setCustomValidity('Enter a display name.');
      nameField.reportValidity();
      return;
    }
    const updated = { name, email: emailField.value.trim() };
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      error.textContent = 'This browser could not save your profile.';
      error.hidden = false;
      return;
    }
    profile = updated;
    render();
    error.hidden = true;
    settings.open = false;
    settings.querySelector('summary').focus();
  });
  nameField.addEventListener('input', () => nameField.setCustomValidity(''));
  render();
}

export function showAbout() {
  const dialog = aboutDialog();
  if (dialog.open) return;
  const version = dialog.querySelector('.version');
  if (!version.textContent) {
    const build = document.querySelector('meta[name="okapi-build"]').content;
    const release = document.querySelector('meta[name="okapi-version"]').content;
    version.textContent = `Version ${release}`;
    const font = new FontFace('Okapi Wordmark', `url(/okapi/assets/${build}/InstrumentSerif-Regular.ttf)`);
    document.fonts.add(font);
  }
  dialog.showModal();
  updateElbowModifier(false);
}

function remapViewerWheel(event) {
  const canvas = viewer?.canvas;
  if (!viewer?.ready || !canvas || event.target !== canvas || forwardedWheels.has(event)) return;
  // Browsers encode a trackpad pinch as Ctrl+wheel without a Control key press.
  if (event.ctrlKey && !controlPressed) return;
  if (event.deltaX === 0 && event.deltaY === 0) return;

  const pan = controlPressed;
  const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
  // Eframe treats a forwarded Ctrl+wheel as a pinch, which has twice the mouse-wheel sensitivity.
  const zoomDelta = event.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? delta / 2 : delta;
  const mapped = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    ctrlKey: !pan,
    shiftKey: pan && event.shiftKey,
    clientX: event.clientX,
    clientY: event.clientY,
    deltaMode: event.deltaMode,
    deltaX: pan ? event.deltaX : 0,
    deltaY: pan ? event.deltaY : zoomDelta,
  });
  forwardedWheels.add(mapped);
  event.preventDefault();
  event.stopImmediatePropagation();
  canvas.dispatchEvent(mapped);
}

function upload(file) {
  if (uploading || input().disabled) return;
  if (file.size > 250 * 1024 * 1024 || !/\.(mp4|mov|m4v|webm|mkv)$/i.test(file.name)) {
    send('upload_error', 'Choose an MP4, MOV, M4V, WebM or MKV file up to 250 MB.');
    return;
  }
  uploading = true;
  send('upload_start', file.name);
  const request = new XMLHttpRequest();
  const form = new FormData();
  form.append('video', file);
  request.open('POST', '/okapi/api/upload');
  request.responseType = 'json';
  request.timeout = 300000;
  request.upload.onprogress = event => {
    if (event.lengthComputable) send('upload_progress', event.loaded / event.total);
  };
  request.onload = () => send(request.status === 201 ? 'upload_done' : 'upload_error',
    request.status === 201 ? request.response : (request.response?.error || 'Upload failed.'));
  request.onerror = request.ontimeout = () => send('upload_error', 'Upload connection interrupted.');
  request.onloadend = () => { uploading = false; };
  request.send(form);
}

export function setFileEnabled(enabled) {
  input().disabled = !enabled;
}

export function setWorkspaceTyping(typing) {
  workspaceTyping = typing;
}

export function chooseFile() {
  choosingFile = true;
  input().click();
}

function workflowEditor() {
  const build = document.querySelector('meta[name="okapi-build"]').content;
  return import(`/okapi/assets/${build}/workflow-editor.js`);
}

export function chooseWorkflow() {
  document.getElementById('okapi-workflow-file').click();
}

export async function showWorkflow(id) {
  requestedWorkflow = id;
  document.getElementById('okapi-workflow-editor')?.dispatchEvent(new Event('workflow-close'));
  try {
    const { openWorkflow } = await workflowEditor();
    await openWorkflow(id, {
      layer: document.getElementById('okapi-workflow-layer'),
      isCurrent: () => requestedWorkflow === id && !!graphBounds && !!workflowFrame,
      change: summary => send('workflow_updated', summary),
      close: () => send('workflow_closed', id),
      pan: delta => send('workflow_pan', delta),
      zoom: event => {
        const canvas = document.getElementById('okapi-workspace').getBoundingClientRect();
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.height : 1;
        send('workflow_zoom', [event.clientX - canvas.left, event.clientY - canvas.top, event.deltaY * unit]);
      },
      position: updateWorkflowPosition,
    });
  } catch (error) {
    if (requestedWorkflow === id) {
      send('workflow_error', error.message);
      send('workflow_closed', id);
    }
  }
}

function updateWorkflowPosition() {
  const layer = document.getElementById('okapi-workflow-layer');
  const editor = document.getElementById('okapi-workflow-editor');
  if (!editor) return;
  if (!graphBounds || !workflowFrame) {
    editor.dispatchEvent(new Event('workflow-close'));
    return;
  }
  const { left, top, right, bottom } = graphBounds;
  const clipTop = top + 37;
  const [x, y, width, height, zoom] = workflowFrame;
  layer.style.cssText = `left:${left}px;top:${clipTop}px;width:${right - left}px;height:${Math.max(0, bottom - clipTop)}px`;
  editor.style.cssText = `width:${width}px;height:${height}px;transform:translate(${x - left}px,${y - clipTop}px) scale(${zoom})`;
  layer.hidden = false;
}

export function positionWorkflow(x, y, width, height, zoom) {
  if (!width || !height) {
    if (workflowFrame) {
      workflowFrame = undefined;
      requestedWorkflow = undefined;
      updateWorkflowPosition();
    }
    return;
  }
  const canvas = document.getElementById('okapi-workspace').getBoundingClientRect();
  const next = [x + canvas.left, y + canvas.top, width, height, zoom];
  if (workflowFrame && next.every((value, index) => value === workflowFrame[index])) return;
  workflowFrame = next;
  updateWorkflowPosition();
}

export async function removeWorkflow(id) {
  try {
    const { deleteWorkflow } = await workflowEditor();
    await deleteWorkflow(id);
  } catch (error) {
    send('workflow_error', error.message);
  }
}

export function connectJob(job) {
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
  if (!job) return;
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const connection = new WebSocket(`${scheme}//${location.host}/okapi/api/jobs/${job}/events`);
  socket = connection;
  connection.onmessage = event => {
    if (typeof event.data === 'string') notify('engine', event.data);
  };
  connection.onclose = () => {
    setTimeout(() => { if (socket === connection) connectJob(job); }, 2500);
  };
}

export function setMediaVisible(visible) {
  const element = surface();
  if (element.classList.contains('workspace-hidden') === !visible) return;
  element.classList.toggle('workspace-hidden', !visible);
  if (!visible) {
    pauseSound();
    element.querySelector('video')?.pause();
    if (viewer?.ready) {
      const active = viewer.get_active_recording_id();
      if (active) viewer.set_playing(active, false);
    }
  } else {
    syncSeekBar();
  }
}

export function setCompactViewer(compact) {
  if (compactViewer === compact) return;
  compactViewer = compact;
  if (viewer?.ready) viewer.overridePanelState('time', compact ? 'hidden' : null);
  if (seekBar) seekBar.root.hidden = !compact && !seekBar.video;
  syncSeekBar();
}

export function setTimeDisplay(frames, fps, frameCount) {
  if (frameDisplay === frames && mediaFps === fps && mediaFrameCount === frameCount) return;
  frameDisplay = frames;
  mediaFps = fps;
  mediaFrameCount = frameCount;
  syncSeekBar();
}

export function setSoundEnabled(enabled) {
  if (soundEnabled === enabled) return;
  soundEnabled = enabled;
  if (enabled) syncSeekBar();
  else pauseSound();
}

function pauseSound() {
  if (!sourceSound) return;
  sourceSound.audio.pause();
  sourceSound.sample = null;
  sourceSound.rate = 1;
}

function syncSound(playback) {
  if (!soundEnabled || !mediaClip) {
    pauseSound();
    return;
  }
  if (!sourceSound) {
    const audio = new Audio();
    audio.preload = 'auto';
    sourceSound = { audio, rate: 1 };
    audio.addEventListener('loadedmetadata', syncSeekBar);
    audio.src = `/okapi/api/jobs/${mediaClip}/audio.m4a`;
  }
  if (!playback.playing) {
    pauseSound();
    return;
  }
  const track = sourceSound;
  const { audio } = track;
  const seconds = playback.seconds;
  if (!Number.isFinite(audio.duration) || track.blocked) return;
  if (seconds >= audio.duration) {
    pauseSound();
    return;
  }
  const now = performance.now();
  if (playback.video) {
    track.rate = playback.video.playbackRate;
  } else {
    const sample = track.sample;
    if (!sample || seconds < sample.seconds) {
      track.sample = { now, seconds };
    } else if (now - sample.now >= 400) {
      const rate = (seconds - sample.seconds) * 1000 / (now - sample.now);
      if (rate >= 0.2 && rate <= 4.2 && Math.abs(rate - track.rate) > 0.12) {
        track.rate = Math.round(rate * 20) / 20;
      }
      track.sample = { now, seconds };
    }
  }
  if (audio.playbackRate !== track.rate) audio.playbackRate = track.rate;
  const drift = Math.abs(audio.currentTime - seconds);
  if (!audio.seeking && (audio.paused ? drift > 0.04 : audio.readyState >= 3 && drift > 0.095)) {
    audio.currentTime = Math.max(0, seconds);
  }
  if (audio.paused) {
    audio.play().catch(error => {
      if (error.name === 'NotAllowedError') track.blocked = true;
    });
  }
}

function buildSeekBar(video) {
  const root = document.createElement('div');
  root.className = 'media-seek';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Clip playback');
  root.hidden = !compactViewer && !video;
  const play = document.createElement('button');
  play.type = 'button';
  play.textContent = '▶';
  play.setAttribute('aria-label', 'Play');
  play.disabled = true;
  const time = document.createElement('output');
  const ruler = document.createElement('div');
  ruler.className = 'seek-ruler';
  const ticks = document.createElement('div');
  ticks.setAttribute('aria-hidden', 'true');
  const cursor = document.createElement('div');
  cursor.className = 'seek-playhead';
  cursor.setAttribute('aria-hidden', 'true');
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.setAttribute('aria-label', 'Seek clip');
  slider.min = slider.max = slider.value = '0';
  slider.disabled = true;
  ruler.append(ticks, cursor, slider);
  root.append(play, time, ruler);

  const bar = { root, play, slider, time, ruler, ticks, cursor, video };
  bar.resize = new ResizeObserver(([entry]) => {
    bar.rulerWidth = entry.contentRect.width;
    if (bar.playback && !root.hidden) drawSeekTicks(bar, bar.playback.lastFrame);
  });
  bar.resize.observe(ruler);

  play.addEventListener('click', () => {
    const current = readPlayback();
    if (!current) return;
    if (video) {
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    } else {
      viewer.set_playing(current.recording, !current.playing);
    }
    syncSeekBar();
  });
  slider.addEventListener('input', () => {
    const frame = slider.valueAsNumber;
    if (!bar.playback) return;
    updateSeekCursor(bar, frame, bar.playback.lastFrame);
    bar.pendingSeek = frame;
    scheduleSeek(bar);
  });
  return bar;
}

function scheduleSeek(bar) {
  if (bar.seekRequest || bar.seeking || bar.pendingSeek === undefined) return;
  bar.seekRequest = requestAnimationFrame(async () => {
    bar.seekRequest = undefined;
    if (bar !== seekBar) return;
    const current = readPlayback();
    if (!current) return;
    const frame = bar.pendingSeek;
    bar.pendingSeek = undefined;
    if (bar.video) {
      bar.video.currentTime = frame / mediaFps;
      return;
    }
    bar.seeking = true;
    try {
      const time = timeForFrame(frame, current.timeline, current.range);
      await viewer.setTime({
        timeline: current.timeline,
        ...(current.timeline === 'Frame' ? { sequence: time } : { durationNanos: time }),
      });
    } catch (error) {
      if (bar === seekBar) console.warn('Could not seek the clip.', error);
    } finally {
      bar.seeking = false;
      if (bar === seekBar) {
        scheduleSeek(bar);
        syncSeekBar();
      }
    }
  });
}

function disposeSeekBar() {
  seekBar?.resize.disconnect();
  seekBar = undefined;
}

function frameAtTime(time, timeline) {
  const frame = timeline === 'Frame' ? time : time * mediaFps / 1e9;
  return Math.floor(frame + 1e-6);
}

function timeForFrame(frame, timeline, range) {
  const time = timeline === 'Frame' ? frame : Math.round(frame * 1e9 / mediaFps) + 1;
  return Math.max(range.min, Math.min(time, range.max));
}

function readPlayback() {
  const video = seekBar?.video;
  if (video) {
    if (!Number.isFinite(video.duration)) return null;
    return { video, seconds: video.currentTime, frame: Math.floor(video.currentTime * mediaFps + 1e-6),
      lastFrame: Math.max(0, mediaFrameCount - 1), playing: !video.paused };
  }
  if (!viewer?.ready) return null;
  const recording = viewer.get_active_recording_id();
  const timeline = recording && viewer.get_active_timeline(recording);
  const range = timeline && viewer.get_time_range(recording, timeline);
  if (!range || !['Clip', 'Frame'].includes(timeline)) return null;
  const time = viewer.get_current_time(recording, timeline);
  return {
    recording, timeline, range,
    seconds: timeline === 'Frame' ? time / mediaFps : time / 1e9,
    frame: frameAtTime(time, timeline),
    lastFrame: frameAtTime(range.max, timeline),
    playing: viewer.get_playing(recording),
  };
}

function formatFrame(frame) {
  if (frameDisplay) return String(frame);
  const nominalFps = Math.max(1, Math.round(mediaFps));
  const seconds = Math.floor(frame / nominalFps);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60, frame % nominalFps]
    .map(value => String(value).padStart(2, '0')).join(':');
}

function updateSeekCursor(bar, frame, lastFrame) {
  frame = Math.max(0, Math.min(lastFrame, frame));
  if (bar.cursorFrame === frame && bar.cursorLastFrame === lastFrame &&
      bar.cursorFrameDisplay === frameDisplay && bar.cursorFps === mediaFps) return bar.clock;
  if (bar.cursorFrameDisplay !== frameDisplay || bar.cursorLastFrame !== lastFrame || bar.cursorFps !== mediaFps) {
    bar.root.style.setProperty('--clock-width', `${formatFrame(lastFrame).length}ch`);
  }
  bar.cursorFrame = frame;
  bar.cursorLastFrame = lastFrame;
  bar.cursorFrameDisplay = frameDisplay;
  bar.cursorFps = mediaFps;
  bar.cursor.style.left = lastFrame > 0 ? `${frame / lastFrame * 100}%` : '0%';
  const clock = formatFrame(frame);
  bar.clock = clock;
  if (bar.time.textContent !== clock) bar.time.textContent = clock;
  if (bar.slider.getAttribute('aria-valuetext') !== clock) bar.slider.setAttribute('aria-valuetext', clock);
  return clock;
}

function drawSeekTicks(bar, lastFrame) {
  const groups = Math.max(1, Math.min(4, Math.floor((bar.rulerWidth ?? 0) / (frameDisplay ? 44 : 94)), lastFrame));
  const key = `${lastFrame}:${groups}:${frameDisplay}:${mediaFps}`;
  if (bar.tickKey === key) return;
  bar.tickKey = key;
  const marks = document.createDocumentFragment();
  const steps = Math.min(lastFrame, groups * 4);
  for (let step = 0; step <= steps; step++) {
    const frame = steps ? Math.round(lastFrame * step / steps) : 0;
    const mark = document.createElement('div');
    const major = step === steps || step % 4 === 0;
    mark.className = major ? 'seek-tick major' : 'seek-tick';
    mark.style.left = lastFrame ? `${frame / lastFrame * 100}%` : '0%';
    if (major) {
      const label = document.createElement('span');
      label.textContent = formatFrame(frame);
      mark.append(label);
    }
    marks.append(mark);
  }
  bar.ticks.replaceChildren(marks);
}

function schedulePlaybackFrame(bar, frame) {
  bar.playbackFrame = frame;
  if (bar.playbackRequest) return;
  bar.playbackRequest = requestAnimationFrame(() => {
    bar.playbackRequest = undefined;
    if (bar === seekBar && bar.playback && !bar.root.hidden && !restoringPlayback) {
      renderPlaybackFrame(bar, bar.playbackFrame, bar.playback.lastFrame);
    }
  });
}

function renderPlaybackFrame(bar, frame, lastFrame) {
  const { slider } = bar;
  if (slider.matches(':active') || bar.pendingSeek !== undefined || bar.seeking) return;
  frame = Math.max(0, Math.min(lastFrame, frame));
  if (slider.valueAsNumber !== frame) slider.valueAsNumber = frame;
  updateSeekCursor(bar, frame, lastFrame);
}

function syncSeekBar() {
  if (!seekBar || document.hidden || surface().classList.contains('workspace-hidden')) return;
  const playback = readPlayback();
  if (!playback || restoringPlayback) {
    pauseSound();
    return;
  }
  syncSound(playback);
  const desired = frameDisplay ? 'Frame' : 'Clip';
  if (!playback.video && playback.timeline !== desired && !switchingTimeline) {
    const range = viewer.get_time_range(playback.recording, desired);
    if (range) {
      const time = timeForFrame(playback.frame, desired, range);
      const change = viewer.setTime({
        timeline: desired,
        ...(frameDisplay ? { sequence: time } : { durationNanos: time }),
      });
      switchingTimeline = change;
      change.catch(() => {}).finally(() => {
        if (switchingTimeline === change) switchingTimeline = undefined;
      });
    }
  }
  const { play, slider, root } = seekBar;
  const { lastFrame } = playback;
  seekBar.playback = playback;
  seekBar.playbackFrame = playback.frame;
  scheduleSeek(seekBar);
  play.disabled = slider.disabled = lastFrame <= 0;
  const label = playback.playing ? 'Pause' : 'Play';
  if (play.getAttribute('aria-label') !== label) {
    play.setAttribute('aria-label', label);
    play.textContent = playback.playing ? '❚❚' : '▶';
  }
  if (slider.max !== String(lastFrame)) slider.max = String(lastFrame);
  if (!root.hidden) {
    renderPlaybackFrame(seekBar, playback.frame, lastFrame);
    drawSeekTicks(seekBar, lastFrame);
  } else {
    const clock = formatFrame(Math.max(0, Math.min(lastFrame, playback.frame)));
    if (clock !== lastClock) {
      lastClock = clock;
      send('viewer_clock', clock);
    }
  }
}

export function positionGraph(x, y, width, height) {
  const before = graphBounds;
  if (!width || !height) {
    graphBounds = null;
  } else {
    const canvas = document.getElementById('okapi-workspace').getBoundingClientRect();
    graphBounds = { left: canvas.left + x, top: canvas.top + y,
      right: canvas.left + x + width, bottom: canvas.top + y + height };
  }
  if (before !== graphBounds && (!before || !graphBounds ||
      Object.keys(graphBounds).some(edge => graphBounds[edge] !== before[edge]))) {
    if (!graphBounds) {
      requestedWorkflow = undefined;
      workflowFrame = undefined;
    }
    updateWorkflowPosition();
  }
}

export function positionMedia(x, y, width, height) {
  const bounds = document.getElementById('okapi-workspace').getBoundingClientRect();
  const left = bounds.left + x;
  const top = bounds.top + y;
  const next = `left:${left}px;top:${top}px;width:${width}px;height:${height}px`;
  if (next !== placement) {
    viewerBounds = { left: left - 6, top: top - 58, right: left + width + 6, bottom: top + height + 6 };
    surface().style.cssText = next;
    placement = next;
  }
}

function fallback(node, path, continued) {
  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = true;
  video.preload = 'metadata';
  const playback = resume?.playback?.key === mediaKey ? resume.playback : continued;
  if (playback) {
    if (playback === resume?.playback) resume.playback = null;
    video.addEventListener('loadedmetadata', () => {
      const seconds = playback.type === 'video' ? playback.time
        : playback.timeline === 'Frame' ? playback.time / mediaFps : playback.time / 1e9;
      video.currentTime = Math.min(seconds, video.duration);
      if (playback.playing && !node.classList.contains('workspace-hidden')) video.play().catch(() => {});
    }, { once: true });
  }
  video.src = path;
  const bar = buildSeekBar(video);
  seekBar = bar;
  node.replaceChildren(video, bar.root);
  for (const event of ['loadedmetadata', 'seeked', 'play', 'pause', 'ended']) {
    video.addEventListener(event, () => {
      if (bar === seekBar) syncSeekBar();
    });
  }
  if (video.requestVideoFrameCallback) {
    const onFrame = (_, { mediaTime }) => {
      if (bar !== seekBar) return;
      schedulePlaybackFrame(bar, Math.floor(mediaTime * mediaFps + 1e-6));
      video.requestVideoFrameCallback(onFrame);
    };
    video.requestVideoFrameCallback(onFrame);
  }
}

export async function showMedia(job, mode, clip) {
  const key = job + ':' + mode;
  if (key === mediaKey && clip === mediaClip) return;
  pauseSound();
  if (clip !== mediaClip) {
    clipPlayback = null;
    if (sourceSound) {
      sourceSound.audio.removeAttribute('src');
      sourceSound.audio.load();
      sourceSound = undefined;
    }
  } else {
    clipPlayback = capturePlayback() ?? clipPlayback;
  }
  mediaClip = clip;
  const continued = clipPlayback;
  mediaKey = key;
  const attempt = ++revision;
  if (viewer) { viewer.stop(); viewer = undefined; }
  disposeSeekBar();
  switchingTimeline = undefined;
  restoringPlayback = false;
  if (lastClock) {
    lastClock = '';
    send('viewer_clock', '');
  }
  const element = surface();
  element.replaceChildren();
  element.hidden = !job;
  if (!job) return;
  const api = `/okapi/api/jobs/${job}`;
  const videoPath = api + (['matte-video', 'compare', 'output'].includes(mode) ? '/matte' : '/source');
  if (mode === 'source-video' || mode === 'matte-video' || !window.isSecureContext || typeof VideoDecoder !== 'function') {
    fallback(element, videoPath, continued);
    return;
  }

  const mount = document.createElement('div');
  mount.className = 'media-mount';
  const bar = buildSeekBar();
  seekBar = bar;
  const notice = document.createElement('div');
  notice.className = 'media-notice';
  notice.textContent = 'Preparing Rerun recording…';
  element.append(mount, bar.root, notice);
  const url = new URL(`${api}/review.rrd?mode=${mode}&schema=2`, location.origin);
  try {
    const [prepared, { WebViewer }] = await Promise.all([
      fetch(url, { method: 'HEAD' }),
      import('/okapi/assets/rerun-0.43.2/index.js')
    ]);
    if (attempt !== revision) return;
    if (!prepared.ok) throw new Error('Recording unavailable');
    notice.textContent = 'Loading Rerun…';
    const next = new WebViewer();
    viewer = next;
    next.on('time_update', ({ recordingId, time }) => {
      const playback = bar.playback;
      if (bar !== seekBar || bar.root.hidden || playback?.recording !== recordingId) return;
      schedulePlaybackFrame(bar, frameAtTime(time, playback.timeline));
    });
    for (const event of ['timeline_change', 'recording_open', 'play', 'pause']) {
      next.on(event, () => {
        // Read viewer state after Rerun finishes the render that emitted this event.
        if (bar.stateRequest) return;
        bar.stateRequest = requestAnimationFrame(() => {
          bar.stateRequest = undefined;
          if (bar === seekBar) syncSeekBar();
        });
      });
    }
    await next.start(url.href, mount, {
      theme: 'dark', hideWelcomeScreen: true, renderBackend: 'webgl',
      checkForUpdatesOnStartup: true, width: '100%', height: '100%'
    });
    if (attempt !== revision) { next.stop(); return; }
    next.overridePanelState('top', 'hidden');
    next.overridePanelState('time', compactViewer ? 'hidden' : null);
    notice.remove();
    restoreRecording(next, key, attempt, continued);
    syncSeekBar();
  } catch {
    if (attempt !== revision) return;
    if (viewer) { viewer.stop(); viewer = undefined; }
    disposeSeekBar();
    fallback(element, videoPath, continued);
    send('preview_error', 'Rerun could not open this recording. Using video playback.');
  }
}

export async function fitViewer() {
  const element = surface();
  const canvas = element.querySelector('.media-mount canvas');
  if (fitting || !viewer?.ready || !canvas || element.classList.contains('workspace-hidden')) return;
  const bounds = canvas.getBoundingClientRect();
  if (bounds.width < 60 || bounds.height < 50) return;
  const fittingRevision = revision;
  fitting = true;
  try {
    const active = viewer;
    const { blueprint, recording } = await active.getBlueprint({ kind: 'recording' });
    let changed = false;
    for (const properties of Object.values(blueprint)) {
      for (const name of Object.keys(properties)) {
        if (name.split('.').at(-1) === 'VisualBounds2D') {
          delete properties[name];
          changed = true;
        }
      }
    }
    if (changed && fittingRevision === revision) {
      await active.setBlueprint(blueprint, { kind: 'recording', recording });
    }
  } catch (error) {
    if (fittingRevision === revision) console.warn('Could not fit the Rerun view.', error);
  } finally {
    fitting = false;
  }
}

export function openDownload(job) {
  const link = document.createElement('a');
  link.href = `/okapi/api/jobs/${job}/download`;
  link.download = '';
  link.click();
}

export function workspaceReady() {
  document.getElementById('boot-status').hidden = true;
  document.body.dataset.workspace = 'egui';
  setInterval(checkForUpdate, 8000);
  setInterval(syncSeekBar, 125);
  document.addEventListener('visibilitychange', () => {
    checkForUpdate();
    if (document.hidden) pauseSound();
    else syncSeekBar();
  });
}

function readUpdateSnapshot() {
  try {
    const text = sessionStorage.getItem('okapiUpdateState');
    sessionStorage.removeItem('okapiUpdateState');
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export function restoredWorkspace() {
  return resume?.workspace ?? '';
}

async function checkForUpdate() {
  if (checkingBuild || reloading || document.hidden) return;
  checkingBuild = true;
  try {
    const response = await fetch('/okapi', { cache: 'no-store' });
    if (!response.ok) return;
    const html = await response.text();
    const build = html.match(/<meta name="okapi-build" content="(workspace-rust-v\d+)">/)?.[1];
    const current = document.querySelector('meta[name="okapi-build"]').content;
    if (build && build !== current) {
      if (build !== availableBuild) {
        availableBuild = build;
        send('workspace_update', true);
      }
    } else if (availableBuild) {
      availableBuild = undefined;
      send('workspace_update', false);
    }
  } catch {
    // A brief disconnect will be retried by the next check.
  } finally {
    checkingBuild = false;
  }
}

export function applyWorkspaceUpdate(workspace) {
  if (!availableBuild || reloading || choosingFile || uploading || document.hidden ||
      aboutDialog().open || profileMenuOpen() || performance.now() - lastInteraction < 1800) return;
  try {
    sessionStorage.setItem('okapiUpdateState', JSON.stringify({ workspace, playback: capturePlayback() }));
  } catch {
    return;
  }
  reloading = true;
  location.reload();
}

function capturePlayback() {
  const video = surface().querySelector('video');
  if (video) {
    return { key: mediaKey, type: 'video', time: video.currentTime, playing: !video.paused };
  }
  if (viewer?.ready) {
    const recording = viewer.get_active_recording_id();
    const timeline = recording && viewer.get_active_timeline(recording);
    if (timeline) {
      return {
        key: mediaKey,
        type: 'rerun',
        timeline,
        time: viewer.get_current_time(recording, timeline),
        playing: viewer.get_playing(recording)
      };
    }
  }
  return null;
}

function restoreRecording(next, key, attempt, continued) {
  const playback = resume?.playback?.key === key ? resume.playback : continued;
  if (!playback) return;
  restoringPlayback = true;
  const timeline = playback.type === 'rerun' ? playback.timeline : 'Clip';
  const time = playback.type === 'rerun' ? playback.time : playback.time * 1e9;
  let retries = 100;
  function seek() {
    if (attempt !== revision) return;
    const recording = next.get_active_recording_id();
    const range = recording && next.get_time_range(recording, timeline);
    if (range) {
      next.set_active_timeline(recording, timeline);
      next.set_current_time(recording, timeline, Math.max(range.min, Math.min(time, range.max)));
      next.set_playing(recording, playback.playing && !surface().classList.contains('workspace-hidden'));
      if (playback === resume?.playback) resume.playback = null;
      restoringPlayback = false;
    } else if (--retries > 0) {
      setTimeout(seek, 100);
    } else {
      restoringPlayback = false;
    }
  }
  seek();
}
