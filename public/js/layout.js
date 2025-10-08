/**
 * public/js/layout.js — Topbar & Footer mount voor Superhond
 * - Haalt /api/config op (apiBase, version, env)
 * - Toont titel, homeknop, online-status van backend
 * - Exporteert global window.SuperhondUI.mount(opts)
 */

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);

  async function fetchConfig() {
    try {
      const r = await fetch('../../api/config', { cache: 'no-store' });
      if (!r.ok) throw new Error('config ' + r.status);
      return await r.json(); // { ok, apiBase, version, env }
    } catch (_) {
      return { ok: false };
    }
  }

  async function pingBackend() {
    try {
      const r = await fetch('../../api/ping', { cache: 'no-store' });
      return r.ok;
    } catch {
      return false;
    }
  }

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (v == null) return;
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v);
    });
    for (const c of children) {
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  function renderTopbar(container, opts, cfg, online) {
    if (!container) return;
    container.innerHTML = '';

    const { title = 'Superhond', icon = '🐾', home = false } = opts || {};

    const left = el('div', { class: 'topbar-left' },
      home
        ? el('a', { class: 'brand', href: '../dashboard/' }, `${icon} ${title}`)
        : el('span', { class: 'brand' }, `${icon} ${title}`)
    );

    const mid = el('div', { class: 'topbar-mid' });
    // Plaats voor breadcrumbs/zoek o.i.d. in de toekomst

    const statusDot = el('span', {
      class: 'status-dot',
      title: online ? 'Online' : 'Offline'
    }, '');

    // Kleine inline styles voor status-dot (voor het geval CSS ontbreekt)
    const style = document.createElement('style');
    style.textContent = `
      .topbar{display:flex;align-items:center;gap:.75rem;padding:.6rem 1rem;border-bottom:1px solid #e5e7eb;background:#fff;position:sticky;top:0;z-index:10}
      .brand{font-weight:700;color:inherit;text-decoration:none}
      .topbar-right{margin-left:auto;display:flex;align-items:center;gap:.5rem;font-size:.9rem}
      .status-dot{width:.6rem;height:.6rem;border-radius:999px;display:inline-block;vertical-align:middle;background:${online ? '#16a34a' : '#ef4444'}}
      .muted{opacity:.7}
      @media (prefers-color-scheme: dark){
        .topbar{background: #111827; color:#e5e7eb; border-bottom-color:#374151}
      }
    `;
    document.head.appendChild(style);

    const right = el('div', { class: 'topbar-right' },
      statusDot,
      el('span', { class: 'muted' }, online ? 'Online' : 'Offline'),
      cfg?.version ? el('span', { class: 'muted' }, `v${cfg.version}`) : null,
      cfg?.env ? el('span', { class: 'muted' }, `(${cfg.env})`) : null
    );

    container.classList.add('topbar');
    container.append(left, mid, right);
  }

  function renderFooter(container, cfg) {
    if (!container) return;
    container.innerHTML = '';

    const year = new Date().getFullYear();
    const apiBadge = cfg?.apiBase
      ? el('code', {}, 'api: ' + String(cfg.apiBase).replace(/^https?:\/\//, ''))
      : el('span', { class: 'muted' }, 'api: n.v.t.');

    const style = document.createElement('style');
    style.textContent = `
      .footer{margin-top:2rem;padding:1rem;border-top:1px solid #e5e7eb;color:#6b7280;font-size:.9rem}
      .footer .row{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;justify-content:space-between}
      .footer code{background:rgba(0,0,0,.05);padding:.1rem .35rem;border-radius:.25rem}
      @media (prefers-color-scheme: dark){
        .footer{border-top-color:#374151;color:#9ca3af}
        .footer code{background:rgba(255,255,255,.08)}
      }
    `;
    document.head.appendChild(style);

    const row = el('div', { class: 'row' },
      el('div', {}, `© ${year} Superhond`),
      el('div', {}, apiBadge),
      el('div', {}, cfg?.version ? `versie ${cfg.version}` : '')
    );

    container.classList.add('footer');
    container.append(row);
  }

  async function mount(opts = {}) {
    const [cfg, online] = await Promise.all([fetchConfig(), pingBackend()]);
    renderTopbar(document.getElementById('topbar'), opts, cfg, online);
    renderFooter(document.getElementById('footer'), cfg);
  }

  // Exporteer als global helper
  window.SuperhondUI = Object.assign(window.SuperhondUI || {}, { mount });
})();
