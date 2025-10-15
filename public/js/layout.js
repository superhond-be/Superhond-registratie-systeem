/**
 * public/js/layout.js — Topbar & Footer mount (v0.27.3)
 * - GEEN /api/config nodig; ping rechtstreeks naar GAS /exec
 * - Exec-URL & branch via <meta> of localStorage (met setters)
 * - Dashboard: GELE balk, Subpagina’s: BLAUWE balk (inline geforceerd)
 * - Versie + branch rechtsboven, status-dot, periodieke ping (45s)
 * - Admin (Shift+Ctrl+A) en density (html[data-density])
 */

(function () {
  /* ───────── Const & keys ───────── */
  const APP_VERSION = '0.27.3';
  const LS_ADMIN    = 'superhond:admin:enabled';
  const LS_DENSITY  = 'superhond:density';
  const LS_EXEC     = 'superhond:exec';
  const LS_BRANCH   = 'superhond:branch';

  /* ───────── DOM helpers ───────── */
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

  /* ───────── Config resolvers ───────── */
  function sanitizeExecUrl(url = '') {
    try {
      const u = new URL(String(url).trim());
      if (
        u.hostname === 'script.google.com' &&
        u.pathname.startsWith('/macros/s/') &&
        u.pathname.endsWith('/exec')
      ) return `${u.origin}${u.pathname}`;
    } catch {}
    return '';
  }

  function resolveExecBase() {
    // 1) meta
    const meta = document.querySelector('meta[name="superhond-exec"]');
    if (meta?.content) {
      const safe = sanitizeExecUrl(meta.content);
      if (safe) {
        try { localStorage.setItem(LS_EXEC, safe); } catch {}
        return safe;
      }
    }
    // 2) window var
    if (typeof window.SUPERHOND_SHEETS_URL === 'string' && window.SUPERHOND_SHEETS_URL) {
      const safe = sanitizeExecUrl(window.SUPERHOND_SHEETS_URL);
      if (safe) {
        try { localStorage.setItem(LS_EXEC, safe); } catch {}
        return safe;
      }
    }
    // 3) localStorage
    try {
      const ls = localStorage.getItem(LS_EXEC);
      if (ls) return sanitizeExecUrl(ls);
    } catch {}
    return '';
  }

  function resolveBranch() {
    // 1) meta
    const meta = document.querySelector('meta[name="superhond-branch"]');
    if (meta?.content) {
      const name = String(meta.content).trim();
      try { localStorage.setItem(LS_BRANCH, name); } catch {}
      return name;
    }
    // 2) window var
    if (typeof window.SUPERHOND_BRANCH === 'string' && window.SUPERHOND_BRANCH) {
      try { localStorage.setItem(LS_BRANCH, window.SUPERHOND_BRANCH.trim()); } catch {}
      return window.SUPERHOND_BRANCH.trim();
    }
    // 3) localStorage
    try {
      const ls = localStorage.getItem(LS_BRANCH);
      if (ls) return String(ls).trim();
    } catch {}
    return ''; // geen badge tonen
  }

  function resolveVersion(optsVersion) {
    // volgorde: opts.version → <meta name="superhond-version"> → window.__APP_VERSION → APP_VERSION
    if (optsVersion) return String(optsVersion);
    const meta = document.querySelector('meta[name="superhond-version"]');
    if (meta?.content) return String(meta.content).trim();
    if (window.__APP_VERSION) return String(window.__APP_VERSION);
    return APP_VERSION;
  }

  /* ───────── Ping zonder API ───────── */
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

  /* ───────── Admin & density ───────── */
  const isAdmin = () => localStorage.getItem(LS_ADMIN) === '1';
  const setAdmin = (on) => {
    localStorage.setItem(LS_ADMIN, on ? '1' : '0');
    document.body.classList.toggle('admin-page', !!on);
  };
  const applyDensity = (mode) => {
    const m = mode || localStorage.getItem(LS_DENSITY) || 'normal';
    try { localStorage.setItem(LS_DENSITY, m); } catch {}
    document.documentElement.setAttribute('data-density', m);
  };

  /* ───────── UI helpers ───────── */
  const statusClass = (ok) => (ok ? 'is-online' : 'is-offline');

  function forceTopbarColors(container, { isDashboard }) {
    // Hard force: onafhankelijk van externe CSS
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
      home  = null,        // true = dashboard link, false = label, null = auto
      back  = null,        // string (url) of true (history.back)
      version = null,      // override versie
      isDashboard = null,  // optioneel forceren
      showBranch = true,   // branch badge aan/uit
    } = opts || {};

    // dashboard/subpage detectie
    const path = location.pathname.replace(/\/+$/, '');
    const autoDash = /\/dashboard$/.test(path) || /\/dashboard\/index\.html$/.test(path);
    const dash = (isDashboard != null) ? !!isDashboard : (home === true ? true : autoDash);

    // back-knop
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

    const branch = resolveBranch();
    const rightChildren = [
      el('span', {
        class: `status-dot ${statusClass(online)}`,
        title: online ? 'Online' : 'Offline'
      }),
      el('span', { class: 'status-text', 'aria-live': 'polite' }, online ? 'Online' : 'Offline'),
      el('span', { class: 'muted' }, `v${resolveVersion(version)}`),
    ];
    if (showBranch && branch) {
      rightChildren.push(
        el('span', { class: 'badge-branch', title: 'Branch' }, branch)
      );
    }

    const right = el('div', { class: 'tb-right' }, ...rightChildren);

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
      .badge-branch{display:inline-block;padding:.15rem .5rem;border-radius:999px;border:1px solid rgba(0,0,0,.15);background:rgba(255,255,255,.7);color:#111827}
      @media (prefers-color-scheme: dark){ .badge-branch{background:rgba(0,0,0,.2);color:#fff} }
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

    const base = resolveExecBase();
    const row = el(
      'div',
      { class: 'row' },
      el('div', {}, `© ${new Date().getFullYear()} Superhond`),
      el('div', {}, el('code', {}, 'exec: ' + (base ? base.replace(/^https?:\/\/(www\.)?/, '') : 'n.v.t.'))),
      el('div', {}, `versie ${resolveVersion()}`)
    );
    container.classList.add('footer');
    container.append(row);
  }

  /* ───────── Status updaten ───────── */
  function applyNetStatus(ok) {
    const dot = document.querySelector('#topbar .status-dot');
    const txt = document.querySelector('#topbar .status-text');
    if (dot) {
      dot.classList.toggle('is-online', !!ok);
      dot.classList.toggle('is-offline', !ok);
    }
    if (txt) txt.textContent = ok ? 'Online' : 'Offline';
  }

  /* ───────── Public API ───────── */
  async function mount(opts = {}) {
    await new Promise((res) => onReady(res));
    applyDensity();

    // Body class voor dashboard/subpage (voor globale CSS)
    const path = location.pathname.replace(/\/+$/, '');
    const isDash = /\/dashboard$/.test(path) || /\/dashboard\/index\.html$/.test(path) || opts.home === true;
    document.body.classList.toggle('dashboard-page', isDash);
    document.body.classList.toggle('subpage', !isDash);

    // Admin thema (rode topbar) direct toepassen
    document.body.classList.toggle('admin-page', isAdmin());

    // Standaard back-knop op subpagina’s
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

  // Achterwaarts compatibele helpers (voor andere modules)
  const setOnline    = (ok) => applyNetStatus(!!ok);
  const noteSuccess  = ()   => applyNetStatus(true);
  const noteFailure  = ()   => applyNetStatus(false);

  // Admin sneltoets: Shift + Ctrl + A
  window.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 'a') {
      const next = !isAdmin();
      setAdmin(next);
      // kleine visuele feedback
      applyNetStatus(true);
      setTimeout(() => location.reload(), 300);
    }
  });

  /* ───────── Exec/Branch setters (met opslag) ───────── */
  function setExec(url) {
    const safe = sanitizeExecUrl(url);
    try {
      if (safe) localStorage.setItem(LS_EXEC, safe);
      else localStorage.removeItem(LS_EXEC);
    } catch {}
    return safe;
  }
  function setBranch(name) {
    const n = String(name || '').trim();
    try {
      if (n) localStorage.setItem(LS_BRANCH, n);
      else localStorage.removeItem(LS_BRANCH);
    } catch {}
    return n;
  }

  // Exporteer globale helper
  window.SuperhondUI = Object.assign(window.SuperhondUI || {}, {
    mount,
    setOnline,
    noteSuccess,
    noteFailure,
    setAdmin,
    applyDensity,
    setExec,
    setBranch,
    APP_VERSION
  });
})();
