/**
 * public/js/layout.js — Topbalk & Footer (v0.24.5-nl)
 * - Zonder /api, rechtstreeks ping naar GAS /exec
 * - Dashboard = gele balk, subpagina = blauwe balk
 * - Toont versie + branch rechtsboven
 * - Verwijdert “witte lege knop” (Safari autofill bug)
 */

(function () {
  const APP_VERSIE = '0.24.5-nl';
  const LS_ADMIN = 'superhond:admin:enabled';
  const LS_DENSITY = 'superhond:density';

  // ───────── Helpers ─────────
  const bijKlaar = (cb) =>
    document.readyState !== 'loading'
      ? cb()
      : document.addEventListener('DOMContentLoaded', cb, { once: true });

  const stijlEenmalig = (id, css) => {
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
    for (const c of kids)
      if (c != null) n.append(typeof c === 'string' ? document.createTextNode(c) : c);
    return n;
  };

  // ───────── Config en ping ─────────
  const meta = (n) => document.querySelector(`meta[name="${n}"]`)?.content?.trim() || '';
  const execBase = () => meta('superhond-exec') || window.SUPERHOND_SHEETS_URL || '';
  const versie = () => meta('superhond-version') || APP_VERSIE;
  const branch = () => meta('superhond-branch') || '';

  async function ping() {
    const base = execBase();
    if (!base) return false;
    const sep = base.includes('?') ? '&' : '?';
    try {
      const r = await fetch(`${base}${sep}mode=ping&t=${Date.now()}`, { cache: 'no-store' });
      return r.ok;
    } catch {
      return false;
    }
  }

  // ───────── UI helpers ─────────
  const statusClass = (ok) => (ok ? 'is-online' : 'is-offline');

  function forceerTopbarKleuren(container, isDashboard) {
    const bg = isDashboard ? '#f4c400' : '#2563eb';
    const fg = isDashboard ? '#000' : '#fff';
    container.style.setProperty('background', bg, 'important');
    container.style.setProperty('color', fg, 'important');
  }

  // ───────── Render topbar ─────────
  function toonTopbar(container, opties, online) {
    if (!container) return;
    container.innerHTML = '';

    const {
      titel = 'Superhond',
      icoon = '🐾',
      home = null,
      terug = null,
      isDashboard = null
    } = opties || {};

    const pad = location.pathname.replace(/\/+$/, '');
    const autoDash = /\/dashboard(\/index\.html)?$/.test(pad);
    const dash = isDashboard != null ? isDashboard : home === true ? true : autoDash;

    let terugKnop = null;
    if (terug) {
      if (typeof terug === 'string')
        terugKnop = el('a', { class: 'btn-back', href: terug }, '← Terug');
      else {
        terugKnop = el('button', { class: 'btn-back', type: 'button' }, '← Terug');
        terugKnop.addEventListener('click', () => history.back());
      }
    }

    const inner = el('div', { class: 'topbar-inner container' });

    const links = el(
      'div',
      { class: 'tb-left' },
      terugKnop,
      dash
        ? el('a', { class: 'brand', href: '../dashboard/' }, `${icoon} ${titel}`)
        : el('span', { class: 'brand' }, `${icoon} ${titel}`)
    );

    const rechts = el(
      'div',
      { class: 'tb-right' },
      el('span', { class: `status-dot ${statusClass(online)}`, title: online ? 'Online' : 'Offline' }),
      el('span', { class: 'status-text' }, online ? 'Online' : 'Offline'),
      el('span', { class: 'muted' }, `v${versie()}`),
      branch() ? el('span', { class: 'branch-badge' }, branch()) : null
    );

    stijlEenmalig(
      'sh-topbar-stijl',
      `
      #topbar{position:sticky;top:0;z-index:50}
      #topbar .topbar-inner{display:flex;align-items:center;gap:.75rem;min-height:56px;border-bottom:1px solid #e5e7eb;background:inherit;color:inherit}
      .tb-left{display:flex;align-items:center;gap:.5rem}
      .tb-right{margin-left:auto;display:flex;align-items:center;gap:.6rem;font-size:.95rem}
      .tb-right *{appearance:none;background:none;border:none;outline:none} /* fix wit balkje */
      .brand{font-weight:800;font-size:20px;text-decoration:none;color:inherit}
      .btn-back{border:1px solid rgba(0,0,0,.15);background:#fff;color:#111827;border-radius:8px;padding:6px 10px;cursor:pointer}
      .status-dot{width:.6rem;height:.6rem;border-radius:999px;display:inline-block;background:#9ca3af}
      .status-dot.is-online{background:#16a34a}
      .status-dot.is-offline{background:#ef4444}
      .status-text{font-weight:600}
      .muted{opacity:.85}
      .branch-badge{padding:.15rem .5rem;border-radius:.5rem;background:#fff;border:1px solid rgba(0,0,0,.15)}
    `
    );

    forceerTopbarKleuren(container, dash);
    inner.append(links, rechts);
    container.append(inner);
  }

  function toonFooter(container) {
    if (!container) return;
    container.innerHTML = '';
    stijlEenmalig(
      'sh-footer-stijl',
      `.footer{margin-top:2rem;padding:1rem;border-top:1px solid #e5e7eb;color:#6b7280;font-size:.9rem}`
    );
    const rij = el(
      'div',
      {},
      `© ${new Date().getFullYear()} Superhond · versie ${versie()}${branch() ? ' (' + branch() + ')' : ''}`
    );
    container.classList.add('footer');
    container.append(rij);
  }

  // ───────── Status bijwerken ─────────
  function updateStatus(ok) {
    const dot = document.querySelector('#topbar .status-dot');
    const txt = document.querySelector('#topbar .status-text');
    if (dot) {
      dot.classList.toggle('is-online', ok);
      dot.classList.toggle('is-offline', !ok);
    }
    if (txt) txt.textContent = ok ? 'Online' : 'Offline';
  }

  // ───────── Mount ─────────
  async function mount(opties = {}) {
    await new Promise(bijKlaar);
    const pad = location.pathname.replace(/\/+$/, '');
    const isDash = /\/dashboard(\/index\.html)?$/.test(pad) || opties.home === true;

    document.body.classList.toggle('dashboard-page', isDash);
    document.body.classList.toggle('subpage', !isDash);

    const topbar = document.getElementById('topbar');
    const footer = document.getElementById('footer');
    const online = await ping();

    if (topbar) toonTopbar(topbar, opties, online);
    if (footer) toonFooter(footer);

    setInterval(async () => {
      const ok = await ping();
      updateStatus(ok);
    }, 45000);
  }

  window.SuperhondUI = Object.assign(window.SuperhondUI || {}, { mount });
})();
