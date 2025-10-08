/**
 * public/js/layout.js — Topbar & Footer mount voor Superhond
 * VERSIE: 0.20.4 (kleurfix dashboard + contrastfix)
 */

(function () {
  const LS_ADMIN   = 'superhond:admin:enabled';
  const LS_DENSITY = 'superhond:density';
  const API_CONFIG = '/api/config';
  const API_PING   = '/api/ping';

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

  async function fetchConfig() {
    try {
      const r = await fetch(API_CONFIG, { cache: 'no-store' });
      if (!r.ok) throw new Error('config ' + r.status);
      return await r.json();
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

  const statusClass = (ok) => (ok ? 'is-online' : 'is-offline');

  function renderTopbar(container, opts, cfg, online) {
    if (!container) return;
    container.innerHTML = '';

    const { title = 'Superhond', icon = '🐾', home = false, back = null } = opts || {};

    let backEl = null;
    if (back) {
      if (typeof back === 'string') {
        backEl = el('a', { class: 'btn-back', href: back }, '← Terug');
      } else {
        backEl = el('button', { class: 'btn-back', type: 'button' }, '← Terug');
        backEl.addEventListener('click', () => history.back());
      }
    }

    const inner = el('div', { class: 'topbar-inner container' });

    const left = el('div', { class: 'tb-left' },
      backEl,
      home
        ? el('a', { class: 'brand', href: '../dashboard/' }, `${icon} ${title}`)
        : el('span', { class: 'brand' }, `${icon} ${title}`)
    );

    const statusDot = el('span', {
      class: `status-dot ${statusClass(online)}`,
      title: online ? 'Online' : 'Offline'
    });

    const right = el('div', { class: 'tb-right' },
      statusDot,
      el('span', { class: 'muted status-text' }, online ? 'Online' : 'Offline'),
      cfg?.version ? el('span', { class: 'muted' }, `v${cfg.version}`) : null,
      cfg?.env ? el('span', { class: 'muted' }, `(${cfg.env})`) : null
    );

    // Dynamische kleur op topbar
    const isDashboard = document.body.classList.contains('dashboard-page');
    const bgColor = isDashboard ? '#f4c400' : '#2563eb';
    const fgColor = isDashboard ? '#000' : '#fff';

    container.style.background = bgColor;
    container.style.color = fgColor;

    onceStyle('sh-topbar-style', `
      #topbar{position:sticky;top:0;z-index:50}
      #topbar .topbar-inner{
        display:flex;align-items:center;gap:.75rem;
        min-height:56px;border-bottom:1px solid #e5e7eb;
        background:inherit;color:inherit;
      }
      .tb-left{display:flex;align-items:center;gap:.5rem}
      .tb-right{margin-left:auto;display:flex;align-items:center;gap:.5rem;font-size:.9rem}
      .brand{font-weight:800;font-size:20px;text-decoration:none;color:inherit}
      .btn-back{appearance:none;border:1px solid rgba(0,0,0,.15);background:#fff;color:#111827;
        border-radius:8px;padding:6px 10px;cursor:pointer}
      .status-dot{width:.6rem;height:.6rem;border-radius:999px;display:inline-block;vertical-align:middle;background:#9ca3af}
      .status-dot.is-online{background:#16a34a}
      .status-dot.is-offline{background:#ef4444}
      .status-text{font-weight:600;opacity:.9;color:inherit;}
      @media (prefers-color-scheme: dark){ #topbar .topbar-inner{border-bottom-color:#374151} }
    `);

    inner.append(left, right);
    container.appendChild(inner);
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
    `);

    const row = el('div', { class: 'row' },
      el('div', {}, `© ${year} Superhond`),
      el('div', {}, apiBadge),
      el('div', {}, cfg?.version ? `versie ${cfg.version}` : '')
    );

    container.classList.add('footer');
    container.append(row);
  }

  async function mount(opts = {}) {
    await new Promise(res => (document.readyState !== 'loading'
      ? res() : document.addEventListener('DOMContentLoaded', res, { once: true })));

    const [cfg, online] = await Promise.all([fetchConfig(), pingBackend()]);
    const topbarEl = document.getElementById('topbar');
    const footerEl = document.getElementById('footer');
    if (topbarEl) renderTopbar(topbarEl, opts, cfg, online);
    if (footerEl) renderFooter(footerEl, cfg);
  }

  window.SuperhondUI = Object.assign(window.SuperhondUI || {}, { mount });
})();
