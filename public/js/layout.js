import { getExecBase, pingExec } from './sheets.js';

(function () {
  const APP_VERSION = '0.27.5';

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
    for (const c of kids) n.append(c?.nodeType ? c : document.createTextNode(String(c)));
    return n;
  };

  function renderTopbar(container, opts, online) {
    if (!container) return;
    const { title = 'Superhond', icon = '🐾', home = null, back = null } = opts || {};
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
    if (!isDash && back === true) {
      left.querySelector('.btn-back')?.addEventListener('click', () => history.back());
    }

    const ver = window.APP_BUILD || ('v' + APP_VERSION);
    const right = el(
      'div',
      { class: 'tb-right' },
      el('span', { class: 'status-dot ' + (online ? 'is-online' : 'is-offline') }),
      el('span', { class: 'status-text' }, online ? 'Online' : 'Offline'),
      el('span', { class: 'muted' }, ver)
    );

    container.innerHTML = '';
    const inner = el('div', { class: 'topbar-inner container' }, left, right);
    container.append(inner);

    container.style.background = isDash ? '#f4c400' : '#2563eb';
    container.style.color = isDash ? '#000' : '#fff';

    if (!document.getElementById('sh-topbar-style')) {
      const s = el(
        'style',
        { id: 'sh-topbar-style' },
        `
      #topbar{position:sticky;top:0;z-index:50}
      #topbar .topbar-inner{display:flex;align-items:center;gap:.75rem;min-height:56px;border-bottom:1px solid #e5e7eb}
      .tb-left{display:flex;align-items:center;gap:.5rem}
      .tb-right{margin-left:auto;display:flex;align-items:center;gap:.6rem}
      .brand{font-weight:800;font-size:20px;text-decoration:none;color:inherit}
      .btn-back{appearance:none;border:1px solid rgba(0,0,0,.15);background:#fff;color:#111827;border-radius:8px;padding:6px 10px;cursor:pointer}
      .status-dot{width:.6rem;height:.6rem;border-radius:999px;display:inline-block;background:#9ca3af}
      .status-dot.is-online{background:#16a34a}
      .status-dot.is-offline{background:#ef4444}
      .status-text{font-weight:600}
      `
      );
      document.head.appendChild(s);
    }
  }

  function renderFooter(container) {
    if (!container) return;
    const exec = getExecBase();
    const ver = window.APP_BUILD || ('v' + APP_VERSION);
    container.innerHTML = `
      <div class="row" style="display:flex;gap:.75rem;justify-content:space-between;align-items:center;padding:1rem 0;border-top:1px solid #e5e7eb;color:#6b7280">
        <div>© ${new Date().getFullYear()} Superhond</div>
        <div><code>exec: ${exec ? exec.replace(/^https?:\/\/(www\.)?/, '') : 'n.v.t.'}</code></div>
        <div>${ver}</div>
      </div>`;
    if (!exec) console.warn('[layout] Geen exec-URL beschikbaar via getExecBase()');
  }

  function setOnline(ok) {
    const d = document.querySelector('#topbar .status-dot');
    const t = document.querySelector('#topbar .status-text');
    if (d) {
      d.classList.toggle('is-online', !!ok);
      d.classList.toggle('is-offline', !ok);
    }
    if (t) t.textContent = ok ? 'Online' : 'Offline';
  }

  async function mount(opts = {}) {
    await new Promise((r) => onReady(r));
    const path = location.pathname.replace(/\/+$/, '');
    let isDash =
      /\/dashboard$/.test(path) ||
      /\/dashboard\/index\.html$/.test(path) ||
      opts.home === true;

    // Extra fallback: root pagina
    if (!isDash && (path === '/index.html' || path === '/')) {
      isDash = true;
    }

    document.body.classList.toggle('dashboard-page', isDash);
    document.body.classList.toggle('subpage', !isDash);

    const online = await pingExec();
    renderTopbar(document.getElementById('topbar'), { ...opts, home: isDash }, online);
    renderFooter(document.getElementById('footer'));

    setInterval(async () => {
      const ok = await pingExec();
      setOnline(ok);
    }, 45000);
  }

  window.SuperhondUI = Object.assign(window.SuperhondUI || {}, {
    mount,
    setOnline
  });
})();
