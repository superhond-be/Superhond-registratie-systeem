/**
 * public/js/layout.js — Topbar & Footer + centrale netstatus (v0.26.0)
 * - Dashboard = GEEL (#f4c400), Subpages = BLAUW (#2563eb)
 * - Eén bron van waarheid voor online/offline (SuperhondNet)
 * - SuperhondUI.setOnline() blijft werken (compat), maar gebruikt centrale status
 * - Exporteert:
 *   - SuperhondUI.{ mount, setOnline, setAdmin, applyDensity, APP_VERSION }
 *   - SuperhondNet.{ setOnline, onChange, ping, startHeartbeat, online }
 */

(function () {
  // ───────── Config
  const APP_VERSION = '0.26.0';
  const LS_ADMIN    = 'superhond:admin:enabled';
  const LS_DENSITY  = 'superhond:density';
  const API_CONFIG  = '/api/config';
  const API_PING    = '/api/ping';

  // ───────── Utils
  const onReady = (cb) =>
    (document.readyState !== 'loading'
      ? cb()
      : document.addEventListener('DOMContentLoaded', cb, { once: true }));

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
    for (const c of kids) {
      if (c == null) continue;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return n;
  };

  const fetchJSON = async (u) => {
    const r = await fetch(u, { cache: 'no-store' });
    if (!r.ok) throw new Error(u + ' ' + r.status);
    return r.json();
  };

  const pingHTTP = async () => {
    try { const r = await fetch(API_PING, { cache: 'no-store' }); return r.ok; }
    catch { return false; }
  };

  // ───────── Prefs
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

  // ───────── Centrale Netstatus
  const Net = {
    online: null,          // null onbekend, true/false bekend
    listeners: new Set(),
    timer: null
  };

  function renderDot(ok) {
    const dot = document.querySelector('#topbar .status-dot');
    const txt = document.querySelector('#topbar .status-text');
    if (dot) {
      dot.classList.toggle('is-online', !!ok);
      dot.classList.toggle('is-offline', !ok);
    }
    if (txt) txt.textContent = ok ? 'Online' : 'Offline';
  }

  function setOnline(ok, { source } = {}) {
    ok = !!ok;
    if (Net.online === ok) return;
    Net.online = ok;
    renderDot(ok);
    Net.listeners.forEach(fn => { try { fn(ok); } catch {} });
    // console.debug('[Net]', ok ? 'online' : 'offline', source || '');
  }

  async function pingOnce() {
    const ok = await pingHTTP();
    setOnline(ok, { source: 'ping' });
    return ok;
  }

  function startHeartbeat(ms = 30000) {
    if (Net.timer) clearInterval(Net.timer);
    Net.timer = setInterval(pingOnce, ms);
  }

  // Maak het globaal beschikbaar
  window.SuperhondNet = Object.assign(window.SuperhondNet || {}, {
    get online() { return Net.online === true; },
    setOnline,                    // door andere modules te gebruiken
    onChange(fn){ Net.listeners.add(fn); return () => Net.listeners.delete(fn); },
    ping: pingOnce,
    startHeartbeat
  });

  // ───────── Topbar/Footer
  const statusClass = (ok) => (ok ? 'is-online' : 'is-offline');

  function forceTopbarColors(container, { home }) {
    const isDashboard =
      home === true
        ? true
        : home === false
          ? false
          : document.body.classList.contains('dashboard-page');

    const bg = isDashboard ? '#f4c400' : '#2563eb';
    const fg = isDashboard ? '#000' : '#fff';
    container.style.setProperty('background', bg, 'important');
    container.style.setProperty('color', fg, 'important');
  }

  function renderTopbar(container, opts, cfg, online) {
    if (!container) return;
    container.innerHTML = '';

    const {
      title = 'Superhond',
      icon = '🐾',
      home = null,
      back = null,
      version = null
    } = opts || {};

    let backEl = null;
    if (back) {
      if (typeof back === 'string') backEl = el('a', { class: 'btn-back', href: back }, '← Terug');
      else { backEl = el('button', { class: 'btn-back', type: 'button' }, '← Terug'); backEl.addEventListener('click', () => history.back()); }
    }

    const inner = el('div', { class: 'topbar-inner container' });

    const left = el('div', { class: 'tb-left' },
      backEl,
      (home === true || (home === null && document.body.classList.contains('dashboard-page')))
        ? el('a', { class: 'brand', href: '../dashboard/' }, `${icon} ${title}`)
        : el('span', { class: 'brand' }, `${icon} ${title}`)
    );

    const right = el('div', { class: 'tb-right' },
      el('span', { class: `status-dot ${statusClass(online)}`, title: online ? 'Online' : 'Offline' }),
      el('span', { class: 'status-text' }, online ? 'Online' : 'Offline'),
      el('span', { class: 'muted' }, `v${version || cfg?.version || APP_VERSION}`),
      cfg?.env ? el('span', { class: 'muted' }, `(${cfg.env})`) : null
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
      .status-text{font-weight:600;color:inherit}
      .muted{opacity:.85}
      @media (prefers-color-scheme: dark){ #topbar .topbar-inner{border-bottom-color:#374151} }
    `);

    forceTopbarColors(container, { home });
    inner.append(left, right);
    container.appendChild(inner);
  }

  function renderFooter(container, cfg) {
    if (!container) return;
    container.innerHTML = '';
    onceStyle('sh-footer-style', `
      .footer{margin-top:2rem;padding:1rem;border-top:1px solid #e5e7eb;color:#6b7280;font-size:.9rem}
      .footer .row{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;justify-content:space-between}
      .footer code{background:rgba(0,0,0,.05);padding:.1rem .35rem;border-radius:.25rem}
    `);
    const row = el('div', { class: 'row' },
      el('div', {}, `© ${new Date().getFullYear()} Superhond`),
      el('div', {}, cfg?.apiBase ? el('code', {}, 'api: ' + String(cfg.apiBase).replace(/^https?:\/\/(www\.)?/, '')) : el('span', { class: 'muted' }, 'api: n.v.t.')),
      el('div', {}, `versie ${cfg?.version || APP_VERSION}`)
    );
    container.classList.add('footer');
    container.append(row);
  }

  // ───────── Public UI API
  async function mount(opts = {}) {
    await new Promise((res) => onReady(res));
    applyDensity();

    // Detecteer dashboard/subpage → class voor kleur
    try {
      const p = location.pathname.replace(/\/+$/, '');
      const isDash = /\/dashboard$/.test(p) || /\/dashboard\/index\.html$/.test(p) || opts.home === true;
      if (isDash) { document.body.classList.add('dashboard-page'); document.body.classList.remove('subpage'); }
      else if (opts.home === false) { document.body.classList.remove('dashboard-page'); document.body.classList.add('subpage'); }
    } catch {}

    // Admin badge
    document.body.classList.toggle('admin-page', isAdmin());

    // Subpagina’s standaard back=true (dashboard niet)
    const isSub = document.body.classList.contains('subpage') && !document.body.classList.contains('dashboard-page');
    const finalOpts = Object.assign({ back: isSub ? true : null }, opts);

    const [cfg, ok] = await Promise.all([
      fetchJSON(API_CONFIG).catch(() => ({})),
      pingHTTP()
    ]);

    const topbarEl = document.getElementById('topbar');
    const footerEl = document.getElementById('footer');
    if (topbarEl) renderTopbar(topbarEl, finalOpts, cfg, ok);
    if (footerEl) renderFooter(footerEl, cfg);

    // Init + heartbeat
    setOnline(ok, { source: 'mount' });
    window.addEventListener('online',  () => setOnline(true,  { source: 'navigator' }));
    window.addEventListener('offline', () => setOnline(false, { source: 'navigator' }));
    startHeartbeat(30000);
  }

  // Compat: oude setOnline blijft werken en routeert naar centrale status
  function setOnlineCompat(ok){ setOnline(!!ok, { source:'compat' }); }

  window.SuperhondUI = Object.assign(window.SuperhondUI || {}, {
    mount,
    setOnline: setOnlineCompat,
    setAdmin,
    applyDensity,
    APP_VERSION
  });
})();
