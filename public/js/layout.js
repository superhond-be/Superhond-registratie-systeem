/**
 * public/js/layout.js — Topbar & Footer mount (v0.25.0)
 * - Dashboard = GEEL (#f4c400), Subpages = BLAUW (#2563eb)
 * - Versienummer: cfg.version -> APP_VERSION fallback
 * - Kleur geforceerd met !important (style.setProperty)
 * - Consistente .topbar-inner.container
 * - CENTRALE online/offline status:
 *     SuperhondUI.noteSuccess()  -> zet dot groen
 *     SuperhondUI.noteFailure()  -> ping; alleen bij echte offline -> rood
 *     SuperhondUI.setOnline()    -> compat alias (roept bovenstaande aan)
 * - Exporteert: SuperhondUI.{ mount, setOnline, noteSuccess, noteFailure, setAdmin, applyDensity }
 */

// ───────────────────────── Centrale online/offline manager ─────────────────────────
(function () {
  const LS_KEY = 'superhond:lastOnlineTs';
  const PING_URL = '/api/ping';
  const PING_EVERY_MS = 20000;
  const PING_TIMEOUT_MS = 5000;

  let online = null;            // null = onbekend, true/false = status
  const listeners = new Set();  // voor callbacks bij wijziging

  function notify() {
    // Update UI (topbar) als beschikbaar
    try { window.SuperhondUI?.setOnline?.(online === true); } catch {}
    listeners.forEach(fn => { try { fn(online === true); } catch {} });
  }

  function setOnline(next) {
    const val = !!next;
    if (online === val) return;
    online = val;
    if (val) localStorage.setItem(LS_KEY, String(Date.now()));
    notify();
  }

  async function pingOnce() {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), PING_TIMEOUT_MS);
    try {
      const r = await fetch(PING_URL, { cache: 'no-store', signal: ctl.signal });
      setOnline(r.ok);
    } catch {
      setOnline(false);
    } finally {
      clearTimeout(t);
    }
  }

  function start() {
    // Browser events
    window.addEventListener('online',  () => setOnline(true));
    window.addEventListener('offline', () => setOnline(false));

    // Eerste status (val terug op navigator.onLine)
    if (navigator.onLine !== undefined) setOnline(navigator.onLine);

    // Start ping-loop (lichtgewicht)
    pingOnce();
    setInterval(pingOnce, PING_EVERY_MS);
  }

  // Public API
  window.SuperhondNet = {
    get online() { return online === true; },
    setOnline,                // mag door andere modules worden aangeroepen
    onChange(fn){ listeners.add(fn); return () => listeners.delete(fn); },
    lastOnlineTs(){ return Number(localStorage.getItem(LS_KEY) || 0); }
  };

  // Autostart zodra script geladen is
  try { start(); } catch {}
})();

(function () {
  // ───────── Config
  const APP_VERSION = '0.25.0';
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

  const ping = async () => {
    try {
      const r = await fetch(API_PING, { cache: 'no-store' });
      return r.ok;
    } catch {
      return false;
    }
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

  // ───────── Topbar/Footer intern
  const statusClass = (ok) => (ok ? 'is-online' : 'is-offline');

  function forceTopbarColors(container, { home }) {
    // home === true => dashboard geel, anders blauw
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
      home = null,      // null -> autodetect via body.dashboard-page
      back = null,
      version = null
    } = opts || {};

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

    const left = el(
      'div',
      { class: 'tb-left' },
      backEl,
      // Als home expliciet true is => link naar dashboard, anders statische span
      (home === true || (home === null && document.body.classList.contains('dashboard-page')))
        ? el('a', { class: 'brand', href: '../dashboard/' }, `${icon} ${title}`)
        : el('span', { class: 'brand' }, `${icon} ${title}`)
    );

    const right = el(
      'div',
      { class: 'tb-right' },
      el('span', { class: `status-dot ${statusClass(online)}`, title: online ? 'Online' : 'Offline' }),
      el('span', { class: 'status-text' }, online ? 'Online' : 'Offline'),
      el('span', { class: 'muted' }, `v${version || cfg?.version || APP_VERSION}`),
      cfg?.env ? el('span', { class: 'muted' }, `(${cfg.env})`) : null
    );

    // Basis styles (eenmalig)
    onceStyle(
      'sh-topbar-style',
      `
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
    `
    );

    forceTopbarColors(container, { home });

    inner.append(left, right);
    container.appendChild(inner);
  }

  function renderFooter(container, cfg) {
    if (!container) return;
    container.innerHTML = '';
    onceStyle(
      'sh-footer-style',
      `
      .footer{margin-top:2rem;padding:1rem;border-top:1px solid #e5e7eb;color:#6b7280;font-size:.9rem}
      .footer .row{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;justify-content:space-between}
      .footer code{background:rgba(0,0,0,.05);padding:.1rem .35rem;border-radius:.25rem}
    `
    );
    const row = el(
      'div',
      { class: 'row' },
      el('div', {}, `© ${new Date().getFullYear()} Superhond`),
      el(
        'div',
        {},
        cfg?.apiBase
          ? el('code', {}, 'api: ' + String(cfg.apiBase).replace(/^https?:\/\/(www\.)?/, ''))
          : el('span', { class: 'muted' }, 'api: n.v.t.')
      ),
      el('div', {}, `versie ${cfg?.version || APP_VERSION}`)
    );
    container.classList.add('footer');
    container.append(row);
  }

  // ───────── Centrale Online/Offline besturing
  let __netState = null; // laatste bekende status (true/false)

  function __renderDot(ok) {
    __netState = !!ok;
    const dot = document.querySelector('#topbar .status-dot');
    const txt = document.querySelector('#topbar .status-text');
    if (dot) {
      dot.classList.toggle('is-online', !!ok);
      dot.classList.toggle('is-offline', !ok);
    }
    if (txt) txt.textContent = ok ? 'Online' : 'Offline';
  }

  async function recheckOnline() {
    try { __renderDot(await ping()); } catch { __renderDot(false); }
  }

  /** Publiek: noem dit na een geslaagde API-call → dot groen */
  function noteSuccess() { __renderDot(true); }

  /**
   * Publiek: noem dit bij een mislukte data-call.
   * We doen eerst een ping:
   *  - ping OK  -> dot blijft groen (server bereikbaar, fout was iets anders)
   *  - ping NOK -> dot wordt rood (echt offline)
   */
  async function noteFailure() { await recheckOnline(); }

  /** (Compat) Oude API: setOnline(true/false) */
  function setOnlineCompat(ok) {
    if (ok) noteSuccess();
    else noteFailure(); // verifieert eerst met ping
  }

  // ───────── Public API
  async function mount(opts = {}) {
    // Wacht tot DOM gereed
    await new Promise((res) => onReady(res));
    applyDensity();

    // Autodetect dashboard → body class
    try {
      const p = location.pathname.replace(/\/+$/, '');
      const isDash =
        /\/dashboard$/.test(p) ||
        /\/dashboard\/index\.html$/.test(p) ||
        opts.home === true;
      if (isDash) {
        document.body.classList.add('dashboard-page');
        document.body.classList.remove('subpage');
      } else if (opts.home === false) {
        document.body.classList.remove('dashboard-page');
        document.body.classList.add('subpage');
      }
    } catch { /* ignore */ }

    // Admin badge
    document.body.classList.toggle('admin-page', isAdmin());

    // Subpagina’s krijgen standaard back=true (dashboard niet)
    const isSub =
      document.body.classList.contains('subpage') &&
      !document.body.classList.contains('dashboard-page');
    const finalOpts = Object.assign({ back: isSub ? true : null }, opts);

    const [cfg, online] = await Promise.all([
      fetchJSON(API_CONFIG).catch(() => ({})),
      ping()
    ]);

    const topbarEl = document.getElementById('topbar');
    const footerEl = document.getElementById('footer');
    if (topbarEl) renderTopbar(topbarEl, finalOpts, cfg, online);
    if (footerEl) renderFooter(footerEl, cfg);
    __renderDot(online); // initiale status
  }

  // ───────── Centrale netwerkstatus ─────────
const NetState = {
  online: null,
  lastChange: 0,
  timer: null
};

async function pingOnce() {
  try {
    const ok = await ping();            // gebruikt de bestaande ping() bovenaan
    setOnline(ok, { source: 'ping' });
    return ok;
  } catch {
    setOnline(false, { source: 'ping' });
    return false;
  }
}

function startHeartbeat(ms = 30000) {
  if (NetState.timer) clearInterval(NetState.timer);
  NetState.timer = setInterval(pingOnce, ms);
}

// Overschrijf setOnline zodat layout + status-dot altijd in sync zijn
function setOnline(ok, { source } = {}) {
  ok = !!ok;
  if (NetState.online === ok) return;

  NetState.online = ok;
  NetState.lastChange = Date.now();

  const dot = document.querySelector('#topbar .status-dot');
  const txt = document.querySelector('#topbar .status-text');
  if (dot) {
    dot.classList.toggle('is-online', ok);
    dot.classList.toggle('is-offline', !ok);
  }
  if (txt) txt.textContent = ok ? 'Online' : 'Offline';

  // Optioneel: log 1x
  // console.debug('[Net]', ok ? 'online' : 'offline', source || '');
}

// Browser-events (gaat uit bij echte offline, en terug bij reconnect)
window.addEventListener('online',  () => setOnline(true,  { source: 'navigator' }));
window.addEventListener('offline', () => setOnline(false, { source: 'navigator' }));

// Tijdens mount: eerste ping + heartbeat starten
const _origMount = (window.SuperhondUI && window.SuperhondUI.mount) || null;
async function mountWithNet(opts = {}) {
  // call originele mount (bouwt topbar op)
  if (_origMount) await _origMount(opts);
  // init status (ping result overschrijft dit zo meteen)
  setOnline(navigator.onLine, { source: 'boot' });
  await pingOnce();           // directe check
  startHeartbeat(30000);      // elke 30s verifiëren
}

// ───────── Public API (vervang je bestaande expose-blok) ─────────
window.SuperhondUI = Object.assign(window.SuperhondUI || {}, {
  mount: mountWithNet,
  setOnline,      // blijft publiek, maar gaat via centrale state
  setAdmin,
  applyDensity,
  APP_VERSION
});

// Centrale “netwerkmanager” voor andere modules (sheets.js, pagina’s)
window.SuperhondNet = Object.assign(window.SuperhondNet || {}, {
  setOnline,          // SuperhondNet.setOnline(true/false, {source})
  ping: pingOnce,
  startHeartbeat
});
  
  // Expose
  window.SuperhondUI = Object.assign(window.SuperhondUI || {}, {
    mount,
    setOnline: setOnlineCompat, // compat
    noteSuccess,                // nieuw
    noteFailure,                // nieuw
    setAdmin,
    applyDensity,
    APP_VERSION
  });
})();
