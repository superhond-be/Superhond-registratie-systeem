/**
 * layout-debug.js — Debug versie van layout met extra console.logs
 */

<script type="module">
  console.log('[DEBUG] script start');
  import('../js/layout-debug.js')
    .then(mod => console.log('[DEBUG] layout-debug geladen', mod))
    .catch(err => console.error('[DEBUG] FOUT:', err));
</script>

import { getExecBase, pingExec } from './sheets.js';

const APP_VERSION = '0.27.6-debug';

const onReady = (cb) =>
  document.readyState !== 'loading'
    ? cb()
    : document.addEventListener('DOMContentLoaded', cb, { once: true });

const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else n.setAttribute(k, v);
  }
  for (const c of kids) {
    n.append(c?.nodeType ? c : document.createTextNode(String(c)));
  }
  return n;
};

function renderTopbar(container, opts, online) {
  console.log('[debug] renderTopbar called:', { container, opts, online });
  if (!container) {
    console.warn('[debug] renderTopbar: container is null or undefined');
    return;
  }
  const { title = 'Superhond', icon = '🐾', home = null, back = null } = opts;
  const isDash = home === true || document.body.classList.contains('dashboard-page');

  const left = el(
    'div',
    { class: 'tb-left' },
    back
      ? (typeof back === 'string'
          ? el('a', { class: 'btn-back', href: back }, '← Terug')
          : el('button', { class: 'btn-back', type: 'button' }, '← Terug'))
      : null,
    isDash
      ? el('a', { class: 'brand', href: '../dashboard/' }, `${icon} ${title}`)
      : el('span', { class: 'brand' }, `${icon} ${title}`)
  );

  const ver = window.APP_BUILD || ('v' + APP_VERSION);
  const right = el('div', { class: 'tb-right' });

  // In debug, we always append version
  right.append(el('span', { class: 'muted' }, ver));

  container.innerHTML = '';
  const inner = el('div', { class: 'topbar-inner container' }, left, right);
  container.append(inner);

  container.style.background = isDash ? '#f4c400' : '#2563eb';
  container.style.color = isDash ? '#000' : '#fff';

  if (!document.getElementById('sh-topbar-style-debug')) {
    const s = el(
      'style',
      { id: 'sh-topbar-style-debug' },
      `
      /* debug topbar styles */
      #topbar { position: sticky; top: 0; z-index: 500; }
      #topbar .topbar-inner { display: flex; align-items: center; gap: .75rem; min-height: 56px; border-bottom: 1px solid #e5e7eb; }
      .tb-left { display: flex; align-items: center; gap: .5rem; }
      .tb-right { margin-left: auto; display: flex; align-items: center; gap: .6rem; }
      .brand { font-weight: 800; font-size: 20px; text-decoration: none; color: inherit; }
      .btn-back { appearance: none; border: 1px solid rgba(0,0,0,.15); background: #fff; color: #111827; border-radius: 8px; padding: 6px 10px; cursor: pointer; }
      .muted { opacity: .7; }
      `
    );
    document.head.appendChild(s);
  }
}

function renderFooter(container) {
  console.log('[debug] renderFooter called, footer container:', container);
  if (!container) {
    console.warn('[debug] renderFooter: container is null or undefined');
    return;
  }
  const exec = getExecBase();
  const ver = window.APP_BUILD || ('v' + APP_VERSION);
  container.innerHTML = `
    <div class="row" style="display:flex;gap:.75rem;justify-content:space-between;align-items:center;padding:1rem 0;border-top:1px solid #e5e7eb;color:#6b7280">
      <div>© ${new Date().getFullYear()} Superhond</div>
      <div><code>exec: ${exec ? exec.replace(/^https?:\/\/(www\.)?/, '') : 'n.v.t.'}</code></div>
      <div>${ver}</div>
    </div>`;
  if (!exec) console.warn('[debug] renderFooter: no exec URL');
}

async function mount(opts = {}) {
  console.log('[debug] mount() called with opts:', opts);
  await new Promise(r => onReady(r));
  console.log('[debug] DOM ready, body.class:', document.body.className);

  const path = location.pathname.replace(/\/+$/, '');
  let isDash =
    /\/dashboard$/.test(path) ||
    /\/dashboard\/index\.html$/.test(path) ||
    opts.home === true;

  if (!isDash && (path === '/index.html' || path === '/')) {
    isDash = true;
  }
  console.log('[debug] isDash =', isDash);

  document.body.classList.toggle('dashboard-page', isDash);
  document.body.classList.toggle('subpage', !isDash);

  let online = false;
  try {
    online = await pingExec();
  } catch (e) {
    console.warn('[debug] pingExec error:', e);
  }
  console.log('[debug] pingExec returned:', online);

  renderTopbar(document.getElementById('topbar'), { ...opts, home: isDash }, online);
  renderFooter(document.getElementById('footer'));
}

export const SuperhondUI = { mount, setOnline: () => {} };
