/**
 * public/js/layout.js — Topbar & Footer mount (v0.24.3-noapi)
 * - GEEN /api/config of /api/ping meer nodig
 * - Versie uit APP_VERSION of inline opts
 * - Ping rechtstreeks naar GAS /exec (SUPERHOND_SHEETS_URL of <meta name="superhond-exec">)
 * - Dashboard gele balk, subpagina’s blauwe balk (forceren via inline styles)
 * - Optionele Terug-knop, status-dot, periodieke ping (45s)
 * - Adminmodus (Shift+Ctrl+A toggle) en density (html[data-density])
 */

(function () {
  const APP_VERSION = '0.24.3';
  const LS_ADMIN   = 'superhond:admin:enabled';
  const LS_DENSITY = 'superhond:density';

  // ───────────────────────── DOM helpers
  const onReady = (cb) =>
    document.readyState !== 'loading'
      ? cb()
      : document.addEventListener('DOMContentLoaded', cb, { once: true });

  const onceStyle = (id, css) => {
    let t = document.getElementById(id);
    if (!t) {
      t = document.createElement('style');
      t.id = id;
      t.textContent = css;
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

  // ───────────────────────── Config & ping zonder /api
  function resolveExecBase() {
    // 1) window.SUPERHOND_SHEETS_URL (bv. gezet in HTML)
    if (typeof window.SUPERHOND_SHEETS_URL === 'string' && window.SUPERHOND_SHEETS_URL) {
      return window.SUPERHOND_SHEETS_URL;
    }
    // 2) <meta name="superhond-exec" content="...">
    const meta = document.querySelector('meta[name="superhond-exec"]');
    if (meta?.content) return meta.content.trim();
    return '';
  }

  async function pingDirect() {
    const base = resolveExecBase();
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

  // ───────────────────────── Admin & density
  const isAdmin = () => localStorage.getItem(LS_ADMIN) === '1';
  const setAdmin = (on) => {
    localStorage.setItem(LS_ADMIN, on ? '1' : '0');
    document.body.classList.toggle('admin-page', !!on);
  };
  const applyDensity = (mode) => {
    const m = mode || localStorage.getItem(LS_DENSITY) || 'normal';
    localStorage.setItem(LS_DENSITY, m);
    document.documentElement.setAttribute('data-density', m);
  };

  // ───────────────────────── UI helpers
  const statusClass = (ok) => (ok ? 'is-online' : 'is-offline');

  function forceTopbarColors(container, { isDashboard }) {
    // Hard force: altijd kleur juist, onafhankelijk van CSS volgorde
    const bg = isDashboard ? '#f4c400' : '#2563eb';
    const fg = isDashboard ? '#000'    : '#fff';
    container.style.setProperty('background', bg, 'important');
    container.style.setProperty('color', fg, 'important');
  }

  function renderTopbar(container, opts, online) {
    if (!container) return;
    container.innerHTML = '';

    const {
      title = 'Superhond',
      icon  = '🐾',
      home  = null,        // true = dashboard link, false = span, null = auto
      back  = null,        // string (url) of true (history.back)
      version = null,      // override versie
      isDashboard = null,  // optionele forced flag
    } = opts || {};

    // Bepaal dashboard/subpage mode
    const path = location.pathname.replace(/\/+$/, '');
    const autoDash = /\/dashboard$/.test(path) || /\/dashboard\/index\.html$/.test(path);
    const dash = (isDashboard != null) ? !!isDashboard : (home === true ? true : autoDash);

    // Terugknop
    let backEl = null;
    if (back) {
      if (typeof back === 'string') backEl = el('a', { class: 'btn-back', href: back }, '← Terug');
      else {
        backEl = el('button', { class: 'btn-back', type: 'button' }, '← Terug');
        backEl.addEventListener('click', () => history.back());
      }
    }

    const inner = el('div', { class: 'topbar-inner container' });

    const left = el(
      'div',
      { class: 'tb-left' },
      backEl,
      dash
        ? el('a', { class: 'brand', href: '../dashboard/' }, `${icon} ${title}`)
        : el('span', { class: 'brand' }, `${icon} ${title}`)
    );

    const right = el(
      'div',
      { class: 'tb-right' },
      el('span', {
        class: `status-dot ${statusClass(online)}`,
        title: online ? 'Online' : 'Offline'
      }),
      el('span', { class: 'status-text' }, online ? 'Online' : 'Offline'),
      el('span', { class: 'muted' }, `v${version || APP_VERSION}`)
    );

    // Basis styles (eenmalig)
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

    // Kleur forceren (geel/blauw)
    forceTopbarColors(container, { isDashboard: dash });

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

    const row = el(
      'div',
      { class: 'row' },
      el('div', {}, `© ${new Date().getFullYear()} Superhond`),
      el('div', {}, el('code', {}, 'exec: ' + (resolveExecBase().replace(/^https?:\/\/(www\.)?/, '') || 'n.v.t.'))),
      el('div', {}, `versie ${APP_VERSION}`)
    );
    container.classList.add('footer');
    container.append(row);
  }

  // ───────────────────────── Net status updaten
  function applyNetStatus(ok) {
    const dot = document.querySelector('#topbar .status-dot');
    const txt = document.querySelector('#topbar .status-text');
    if (dot) {
      dot.classList.toggle('is-online', !!ok);
      dot.classList.toggle('is-offline', !ok);
    }
    if (txt) txt.textContent = ok ? 'Online' : 'Offline';
  }

  // ───────────────────────── Public API
  async function mount(opts = {}) {
    await new Promise((res) => onReady(res));
    applyDensity();

    // Body class voor dashboard/subpage (voor je globale CSS)
    const path = location.pathname.replace(/\/+$/, '');
    const isDash = /\/dashboard$/.test(path) || /\/dashboard\/index\.html$/.test(path) || opts.home === true;
    document.body.classList.toggle('dashboard-page', isDash);
    document.body.classList.toggle('subpage', !isDash);

    // Admin thema (rode topbar) direct toepassen
    document.body.classList.toggle('admin-page', isAdmin());

    // Standaard: terugknop op subpagina’s
    const finalOpts = Object.assign({ back: !isDash }, opts);

    const topbarEl = document.getElementById('topbar');
    const footerEl = document.getElementById('footer');

    // Eerste ping (rechtstreeks naar GAS)
    const online = await pingDirect();

    if (topbarEl) renderTopbar(topbarEl, finalOpts, online);
    if (footerEl) renderFooter(footerEl);

    // Periodiek ping (45s)
    setInterval(async () => {
      const ok = await pingDirect();
      applyNetStatus(ok);
    }, 45_000);
  }

  // Achterwaarts compatibele helpers (als je vanuit andere modules wil updaten)
  const setOnline    = (ok) => applyNetStatus(!!ok);
  const noteSuccess  = ()   => applyNetStatus(true);
  const noteFailure  = ()   => applyNetStatus(false);

  // Admin sneltoets: Shift + Ctrl + A
  window.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 'a') {
      const next = !isAdmin();
      setAdmin(next);
      applyNetStatus(true);
      setTimeout(() => location.reload(), 350);
    }
  });

  // Exporteer
  window.SuperhondUI = Object.assign(window.SuperhondUI || {}, {
    mount,
    setOnline,
    noteSuccess,
    noteFailure,
    setAdmin,
    applyDensity,
    APP_VERSION
  });
})();
