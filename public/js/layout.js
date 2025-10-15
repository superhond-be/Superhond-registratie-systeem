/**
 * public/js/layout.js — Topbar & Footer (v0.27.3)
 * - Leest EXEC uit <meta name="superhond-exec"> of localStorage
 * - Ping rechtstreeks naar GAS /exec (mode=ping)
 * - Toont versie uit <meta name="superhond-version"> of APP_VERSION
 * - Dashboard = gele topbar, subpagina = blauwe topbar
 * - Admin toggle: Shift+Ctrl+A (zet body.admin-page)
 */

(function () {
  const APP_VERSION = '0.27.3';
  const LS_EXEC_KEYS = ['superhond:exec', 'superhond:apiBase']; // compat beide sleutels

  // ───────── helpers
  const onReady = (cb) =>
    document.readyState !== 'loading'
      ? cb()
      : document.addEventListener('DOMContentLoaded', cb, { once: true });

  const onceStyle = (id, css) => {
    let t = document.getElementById(id);
    if (!t) {
      t = document.createElement('style'); t.id = id; t.textContent = css;
      document.head.appendChild(t);
    }
    return t;
  };
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null) return;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else n.setAttribute(k, v);
    });
    for (const c of kids) if (c != null) n.append(typeof c === 'string' ? document.createTextNode(c) : c);
    return n;
  };

  function getExecBase() {
    // 1) meta
    const meta = document.querySelector('meta[name="superhond-exec"]')?.content?.trim();
    if (meta) return meta.replace(/\/+$/, '') + '/exec';
    // 2) localStorage (beide sleutels)
    for (const k of LS_EXEC_KEYS) {
      const v = localStorage.getItem(k);
      if (v) return v.replace(/\/+$/, '') + (v.endsWith('/exec') ? '' : '/exec');
    }
    // 3) window override (optioneel)
    if (window.SUPERHOND_SHEETS_URL) return String(window.SUPERHOND_SHEETS_URL);
    return '';
  }

  async function pingExec() {
    const base = getExecBase();
    if (!base) return false;
    const sep = base.includes('?') ? '&' : '?';
    const url = `${base}${sep}mode=ping&t=${Date.now()}`;
    try {
      const r = await fetch(url, { cache: 'no-store' });
      return r.ok;
    } catch {
      return false;
    }
  }

  function statusClass(ok) { return ok ? 'is-online' : 'is-offline'; }
  function applyNetStatus(ok) {
    const dot = document.querySelector('#topbar .status-dot');
    const txt = document.querySelector('#topbar .status-text');
    if (dot) {
      dot.classList.toggle('is-online', !!ok);
      dot.classList.toggle('is-offline', !ok);
    }
    if (txt) txt.textContent = ok ? 'Online' : 'Offline';
  }

  function forceTopbarColors(container, isDashboard) {
    container.style.setProperty('background', isDashboard ? '#f4c400' : '#2563eb', 'important');
    container.style.setProperty('color', isDashboard ? '#000' : '#fff', 'important');
  }

  function renderTopbar(container, opts, online) {
    if (!container) return;
    container.innerHTML = '';

    const metaVersion = document.querySelector('meta[name="superhond-version"]')?.content?.trim();
    const {
      title = 'Superhond',
      icon = '🐾',
      home = null,
      back = null,
      isDashboard = null,
      version = metaVersion || APP_VERSION
    } = opts || {};

    const path = location.pathname.replace(/\/+$/, '');
    const autoDash = /\/dashboard$/.test(path) || /\/dashboard\/index\.html$/.test(path);
    const dash = (isDashboard != null) ? !!isDashboard : (home === true ? true : autoDash);

    let backEl = null;
    if (back) {
      if (typeof back === 'string') backEl = el('a', { class: 'btn-back', href: back }, '← Terug');
      else { backEl = el('button', { class: 'btn-back', type: 'button' }, '← Terug'); backEl.addEventListener('click', () => history.back()); }
    }

    const inner = el('div', { class: 'topbar-inner container' });
    const left = el(
      'div',
      { class: 'tb-left' },
      backEl,
      dash ? el('a', { class: 'brand', href: '../dashboard/' }, `${icon} ${title}`)
           : el('span', { class: 'brand' }, `${icon} ${title}`)
    );
    const right = el(
      'div',
      { class: 'tb-right' },
      el('span', { class: `status-dot ${statusClass(online)}`, title: online ? 'Online' : 'Offline' }),
      el('span', { class: 'status-text' }, online ? 'Online' : 'Offline'),
      el('span', { class: 'muted' }, `v${version}`)
    );

    onceStyle('sh-topbar-style', `
      #topbar{position:sticky;top:0;z-index:50}
      #topbar .topbar-inner{display:flex;align-items:center;gap:.75rem;min-height:56px;border-bottom:1px solid #e5e7eb;background:inherit;color:inherit}
      .tb-left{display:flex;align-items:center;gap:.5rem}
      .tb-right{margin-left:auto;display:flex;align-items:center;gap:.6rem;font-size:.95rem}
      .brand{font-weight:800;font-size:20px;text-decoration:none;color:inherit}
      .btn-back{appearance:none;border:1px solid rgba(0,0,0,.15);background:#fff;color:#111827;border-radius:8px;padding:6px 10px;cursor:pointer}
      .status-dot{width:.6rem;height:.6rem;border-radius:999px;display:inline-block;background:#9ca3af}
      .status-dot.is-online{background:#16a34a}
      .status-dot.is-offline{background:#ef4444}
      .status-text{font-weight:600}
      .muted{opacity:.85}
    `);

    forceTopbarColors(container, dash);
    inner.append(left, right);
    container.append(inner);
  }

  function renderFooter(container) {
    if (!container) return;
    container.innerHTML = '';

    onceStyle('sh-footer-style', `
      .footer{margin-top:2rem;padding:1rem;border-top:1px solid #e5e7eb;color:#6b7280;font-size:.9rem}
      .footer .row{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;justify-content:space-between}
      .footer code{background:rgba(0,0,0,.05);padding:.1rem .35rem;border-radius:.25rem}
    `);

    const exec = getExecBase();
    const version = document.querySelector('meta[name="superhond-version"]')?.content?.trim() || APP_VERSION;

    const row = el(
      'div',
      { class: 'row' },
      el('div', {}, `© ${new Date().getFullYear()} Superhond`),
      el('div', {}, exec ? el('code', {}, 'exec: ' + exec.replace(/^https?:\/\/(www\.)?/, '')) : el('span', { class: 'muted' }, 'exec: n.v.t.')),
      el('div', {}, `versie ${version}`)
    );
    container.classList.add('footer');
    container.append(row);
  }

  async function mount(opts = {}) {
    await new Promise((res) => onReady(res));

    const path = location.pathname.replace(/\/+$/, '');
    const isDash = /\/dashboard$/.test(path) || /\/dashboard\/index\.html$/.test(path) || opts.home === true;
    document.body.classList.toggle('dashboard-page', isDash);
    document.body.classList.toggle('subpage', !isDash);

    const topbarEl = document.getElementById('topbar');
    const footerEl = document.getElementById('footer');

    // eerste ping
    const online = await pingExec();
    if (topbarEl) renderTopbar(topbarEl, opts, online);
    if (footerEl) renderFooter(footerEl);

    // periodieke ping
    setInterval(async () => applyNetStatus(await pingExec()), 45_000);
  }

  const setOnline = (ok) => applyNetStatus(!!ok);

  // Admin hotkey (optioneel thema)
  window.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 'a') {
      document.body.classList.toggle('admin-page');
    }
  });

  window.SuperhondUI = Object.assign(window.SuperhondUI || {}, {
    mount, setOnline, APP_VERSION
  });
})();
