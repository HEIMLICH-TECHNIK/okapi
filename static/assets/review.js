import { WebViewer } from './rerun-0.38.1/index.js';

const message = document.getElementById('review-status');
const container = document.getElementById('review-canvas');
const viewer = new WebViewer();

async function startReview() {
  if (!window.isSecureContext || typeof VideoDecoder !== 'function') {
    throw new Error('Open this review over Tailscale HTTPS in a browser that supports WebCodecs.');
  }
  const job = location.pathname.split('/').at(-1);
  const params = new URLSearchParams(location.search);
  const workspace = params.get('workspace');
  const workspaceOrigin = ['http://hmlh-server', 'http://hmlh-server.tail6ad677.ts.net'].includes(workspace)
    ? workspace : 'http://hmlh-server';
  document.getElementById('review-back').href = `${workspaceOrigin}/okapi?job=${job}`;
  const api = `/okapi/api/jobs/${job}`;
  const metadata = await fetch(api);
  if (!metadata.ok) throw new Error('This clip is no longer available.');
  const { name, state } = await metadata.json();
  const comparison = params.get('mode') === 'compare' || state === 'complete';
  document.getElementById('review-title').textContent = name;
  document.getElementById('review-mode').textContent = comparison ? 'Source + Alpha Matte' : 'Source';
  const recording = `${api}/review.rrd?mode=${comparison ? 'compare' : 'source'}`;

  // Wait for the server to finish preparing the recording before the viewer reads it.
  const ready = await fetch(recording, { method: 'HEAD' });
  if (!ready.ok) throw new Error('The review recording could not be prepared. Try reopening it from okapi.');
  message.textContent = 'Opening Rerun…';
  await viewer.start(new URL(recording, location.origin).href, container, {
    theme: 'dark', hide_welcome_screen: true, render_backend: 'webgl',
    width: '100%', height: '100%'
  });
  viewer.override_panel_state('top', 'hidden');
  message.hidden = true;
}

startReview().catch(error => { message.textContent = error.message; });
window.addEventListener('pagehide', () => viewer.stop());
