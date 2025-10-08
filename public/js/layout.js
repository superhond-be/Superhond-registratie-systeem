/**
 * public/js/layout.js — Topbar & Footer mount voor Superhond
 * - /api/config (apiBase, version, env) + /api/ping
 * - Topbar met (optionele) Terug-knop, status en versie
 * - Adminmodus: badge + rode topbar + Shift+Ctrl+A toggle
 * - Dichtheid: html[data-density] uit localStorage
 * - Toast integratie (via window.SuperhondToast als aanwezig)
 * - Exporteert: window.SuperhondUI.mount(opts)
 */

(function () {
  const $  = (sel, root = document) => root.querySelector(sel);
  const LS_ADMIN   = 'superhond:admin:enabled';
  const LS_DENSITY = 'superhond:density';

  // Altijd absolute paden gebruiken (werkt vanaf elke submap)
  const API_CONFIG = '/api/config';
  const API_PING   = '/api/ping';

  /* ───────── Utils ───────── */
  function onceStyle(id, cssText) {
    let tag = document.getElementById(id);
    if (!tag) {
      tag = document.createElement('style');
      tag.id = id;
      tag.textContent = cssText;
      document.head.appendChild(tag);
    }
    return tag;
  }
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
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
  function showToast(msg, type = 'info') {
    if (typeof window.SuperhondToast === 'function') {
      window.SuperhondToast(msg, type);
    } else {
      console[(type === 'warn' ? 'warn' : 'log')](msg);
    }
  }

  /* ───────── API ───────── */
  async function fetchConfig() {
    try {
      const r = await fetch(API_CONFIG, { cache: 'no-store' });
      if (!r.ok) throw new Error('config ' + r.status);
      return await r.json(); // { ok, apiBase, version, env }
    } catch (_) {
      return { ok: false };
    }
  }
  async function pingBackend() {
    try {
      const r = await fetch(API_PING, { cache: 'no-store' });
      return r.ok;
    } catch {
      return false;
    }
  }

  /* ───────── Admin helpers ───────── */
  function isAdminEnabled() {
    return localStorage.getItem(LS_ADMIN) === '1';
  }
  function setAdminEnabled(on) {
    localStorage.setItem(LS_ADMIN, on ? '1' : '0');
    document.body.classList.toggle('admin-page', !!on); // rode topbar via CSS
  }
  function ensureAdminBadge() {
    if (!isAdminEnabled()) return;
    const topbarWrap = $('#topbar .container');
    if (!topbarWrap) return;

    let badge = document.querySelector('.admin-badge');
    if (badge) return;

    badge = document.createElement('div');
    badge.className = 'admin-badge';
    badge.innerHTML = `
      🔒 <span>Admin actief</span>
      <button type="button" class="btn-exit" title="Admin-modus uitschakelen">✖️</button>
    `;
    badge.querySelector('.btn-exit').addEventListener('click', () => {
      if (confirm('Admin-modus uitschakelen?')) {
        setAdminEnabled(false);
        showToast('🔓 Adminmodus uitgeschakeld', 'warn');
        location.reload();
      }
    });
    topbarWrap.appendChild(badge);
  }

  // Toggle via sneltoets Shift + Ctrl + A
  window.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 'a') {
      const next = !isAdminEnabled();
      setAdminEnabled(next);
      showToast(next ? '🔒 Adminmodus ingeschakeld' : '🔓 Adminmodus uitgeschakeld', next ? 'ok' : 'warn');
      setTimeout(() => location.reload(), 800);
    }
  });

  /* ───────── Density helper ───────── */
  function applyDensityFromStorage() {
    const density = localStorage.getItem(LS_DENSITY) || 'normal';
    document.documentElement.setAttribute('data-density', density);
  }

  /* ───────── Renderers ───────── */

  // 🔧 Jouw bijgewerkte renderTopbar met back-knop
  function renderTopbar(container, opts, cfg, online) {
    if (!container) return;
    container.innerHTML = '';

    const {
      title = 'Superhond',
      icon  = '🐾',
      home  = false,
      back  = null // string (url) of true (history.back)
    } = opts || {};

    // optionele terugknop
    let backEl = null;
    if (back) {
      if (typeof back === 'string') {
        backEl = el('a', { class: 'btn-back', href: back }, '← Terug');
      } else {
        backEl = el('button', { class: 'btn-back', type: 'button' }, '← Terug');
        backEl.addEventListener('click', () => history.back());
      }
    }

    const left = el('div', { class: 'topbar-left' },
      backEl,
      home
        ? el('a', { class: 'brand', href: '../dashboard/' }, `${icon} ${title}`)
        : el('span', { class: 'brand' }, `${icon} ${title}`)
    );

    const mid = el('div', { class: 'topbar-mid' });

    const statusDot = el('span', {
      class: 'status-dot',
      title: online ? 'Online' : 'Offline'
    }, '');

    // Eenmalige basis-styles (rest zit in CSS)
    onceStyle('sh-topbar-style', `
      .topbar{display:flex;align-items:center;gap:.75rem;padding:.6rem 1rem;border-bottom:1px solid #e5e7eb;position:sticky;top:0;z-index:10}
      .brand{font-weight:700;color:inherit;text-decoration:none}
      .topbar-right{margin-left:auto;display:flex;align-items:center;gap:.5rem;font-size:.9rem}
      .muted{opacity:.7}
      @media (prefers-color-scheme: dark){ .topbar{border-bottom-color:#374151} }
    `);

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
      ? el('code', {}, 'api: ' + String(cfg.apiBase).replace(/^https?:\/\/(www\.)?/, ''))
      : el('span', { class: 'muted' }, 'api: n.v.t.');

    onceStyle('sh-footer-style', `
      .footer{margin-top:2rem;padding:1rem;border-top:1px solid #e5e7eb;color:#6b7280;font-size:.9rem}
      .footer .row{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;justify-content:space-between}
      .footer code{background:rgba(0,0,0,.05);padding:.1rem .35rem;border-radius:.25rem}
      @media (prefers-color-scheme: dark){
        .footer{border-top-color:#374151}
        .footer code{background:rgba(255,255,255,.08)}
      }
    `);

    const row = el('div', { class: 'row' },
      el('div', {}, `© ${year} Superhond`),
      el('div', {}, apiBadge),
      el('div', {}, cfg?.version ? `versie ${cfg.version}` : '')
    );

    container.classList.add('footer');
    container.append(row);
  }

  /* ───────── Mount ───────── */
  async function mount(opts = {}) {
    // Dichtheid toepassen vóór render
    applyDensityFromStorage();

    // Admin thema (rode topbar) direct toepassen
    document.body.classList.toggle('admin-page', isAdminEnabled());

    const [cfg, online] = await Promise.all([fetchConfig(), pingBackend()]);
    renderTopbar(document.getElementById('topbar'), opts, cfg, online);
    renderFooter(document.getElementById('footer'), cfg);

    // Admin badge tonen indien nodig
    ensureAdminBadge();
  }

  // Exporteer als global helper
  window.SuperhondUI = Object.assign(window.SuperhondUI || {}, { mount });
})();
