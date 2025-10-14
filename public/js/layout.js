/**
 * public/js/layout.js — Topbar & Footer (v0.24.6)
 * - Body-class first: 'dashboard-page' => dashboard, 'subpage' => subpage
 * - Hard color forcing (geel/blauw)
 * - Back-knop: standaard AAN op subpages, uit op dashboard (overschrijf met opts.back)
 * - Versie/branch via <meta> tags
 * - Ping via <meta name="superhond-exec">
 */

(function () {
  const APP_VERSION_FALLBACK = '0.24.6';

  // DOM helpers
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

  // Meta helpers
  const getMeta = (name) => document.querySelector(`meta[name="${name}"]`)?.content?.trim() || '';
  const EXEC_BASE = () => getMeta('superhond-exec');
  const DISPLAY_VERSION = () => getMeta('superhond-version') || APP_VERSION_FALLBACK;
  const DISPLAY_BRANCH  = () => getMeta('superhond-branch')  || '';

  async function pingDirect() {
    const base = EXEC_BASE();
    if (!base) return false;
    const sep = base.includes('?') ? '&' : '?';
    const url = `${base}${sep}mode=ping&t=${Date.now()}`;
    try { const r = await fetch(url, { cache: 'no-store' }); return r.ok; }
    catch { return false; }
  }

  // UI helpers
  const statusClass = (ok) => (ok ? 'is-online' : 'is-offline');

  function forceTopbarColors(container, isDashboard) {
    const bg = isDashboard ? '#f4c400' : '#2563eb';
    const fg = isDashboard ? '#000'    : '#fff';
    container.style.setProperty('background', bg, 'important');
    container.style.setProperty('color', fg, 'important');
  }

  function resolveIsDashboard(opts = {}) {
    // 1) Body classes hebben voorrang
    if (document.body.classList.contains('dashboard-page')) return true;
    if (document.body.classList.contains('subpage'))       return false;

    // 2) Handmatige override
    if (typeof opts.isDashboard === 'boolean') return opts.isDashboard;
    if (opts.home === true) return true;

    // 3) Path-detectie
    const path = location.pathname.replace(/\/+$/, '');
    return /\/dashboard$/.test(path) || /\/dashboard\/index\.html$/.test(path);
  }

  function renderTopbar(container, opts, online) {
    if (!container) return;
    container.innerHTML = '';

    const isDash = resolveIsDashboard(opts);
    const {
      title = 'Superhond',
      icon  = '🐾',
      // back: standaard true op subpage, false op dashboard
      back  = (typeof opts.back !== 'undefined') ? opts.back : (!isDash),
    } = opts || {};

    // Back button
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
      isDash
        ? el('a', { class: 'brand', href: '../dashboard/' }, `${icon} ${title}`)
        : el('span', { class: 'brand' }, `${icon} ${title}`)
    );

    const version = DISPLAY_VERSION();
    const branch  = DISPLAY_BRANCH();
    const right = el(
      'div',
      { class: 'tb-right' },
      el('span', { class: `status-dot ${statusClass(online)}`, title: online ? 'Online' : 'Offline' }),
      el('span', { class: 'status-text' }, online ? 'Online' : 'Offline'),
      el('span', { class: 'muted' }, `v${version}`),
      branch ? el('span', { class: 'muted' }, `(${branch})`) : null
    );

    onceStyle('sh-topbar-style', `
      #topbar{position:sticky;top:0;z-index:50}
      #topbar .topbar-inner{display:flex;align-items:center;gap:.75rem;min-height:56px;border-bottom:1px solid #e5e7eb;background:inherit;color:inherit}
      .tb-left{display:flex;align-items:center;gap:.5rem}
      .tb-right{margin-left:auto;display:flex;align-items:center;gap:.6rem;font-size:.95rem}
      .tb-right *{appearance:none;background:none;border:none;outline:none}
      .brand{font-weight:800;font-size:20px;text-decoration:none;color:inherit}
      .btn-back{appearance:none;border:1px solid rgba(0,0,0,.15);background:#fff;color:#111827;border-radius:8px;padding:6px 10px;cursor:pointer}
      .status-dot{width:.6rem;height:.6rem;border-radius:999px;display:inline-block;background:#9ca3af}
      .status-dot.is-online{background:#16a34a}
      .status-dot.is-offline{background:#ef4444}
      .status-text{font-weight:600}
      .muted{opacity:.85}
    `);

    // kleur forceren
    forceTopbarColors(container, isDash);

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
      el('div', {}, el('code', {}, 'exec: ' + (EXEC_BASE().replace(/^https?:\/\/(www\.)?/, '') || 'n.v.t.'))),
      el('div', {}, `versie ${DISPLAY_VERSION()}${DISPLAY_BRANCH() ? ' ('+DISPLAY_BRANCH()+')' : ''}`)
    );
    container.classList.add('footer');
    container.append(row);
  }

  function applyNetStatus(ok) {
    const dot = document.querySelector('#topbar .status-dot');
    const txt = document.querySelector('#topbar .status-text');
    if (dot) {
      dot.classList.toggle('is-online', !!ok);
      dot.classList.toggle('is-offline', !ok);
    }
    if (txt) txt.textContent = ok ? 'Online' : 'Offline';
  }

  async function mount(opts = {}) {
    await new Promise((res) => onReady(res));

    const topbarEl = document.getElementById('topbar');
    const footerEl = document.getElementById('footer');

    // Eerste ping
    const online = await pingDirect();

    if (topbarEl) renderTopbar(topbarEl, opts, online);
    if (footerEl) renderFooter(footerEl);

    // Periodiek ping
    setInterval(async () => {
      const ok = await pingDirect();
      applyNetStatus(ok);
    }, 45_000);
  }

  window.SuperhondUI = Object.assign(window.SuperhondUI || {}, {
    mount
  });
})();
