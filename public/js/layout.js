/**
 * public/js/layout.js — Topbar & Footer mount (v0.24.3-net)
 * - Forceert topbar-kleur per modus: Dashboard = geel, Subpages = blauw, Admin = rood
 * - Robuuste home/back: absolute link naar /dashboard/ (werkt in elke mapdiepte)
 * - Netwerkstatus-buffer (noteSuccess/noteFailure) + periodieke ping
 * - Eénmalige CSS-injectie, geen dubbele styles
 */

(function () {
  const APP_VERSION = '0.24.3-net';
  const LS_ADMIN    = 'superhond:admin:enabled';
  const LS_DENSITY  = 'superhond:density';
  const API_CONFIG  = '/api/config';
  const API_PING    = '/api/ping';

  let LAST_NET_OK = null; // onthoudt laatste netwerkstatus (nog vóór mount)

  /* ───────── Helpers ───────── */
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
    for (const c of kids)
      if (c != null) n.append(typeof c === 'string' ? document.createTextNode(c) : c);
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

  /* ───────── Prefs ───────── */
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

  const statusClass = (ok) => (ok ? 'is-online' : 'is-offline');

  /* ───────── Kleurforcering topbar ─────────
     volgorde van prioriteit:
     1) Admin (rood)
     2) Dashboard (geel)
     3) Subpage (blauw) */
  function forceTopbarColors(container) {
    const admin = document.body.classList.contains('admin-page');
    const dash  = document.body.classList.contains('dashboard-page');

    let bg, fg;
    if (admin) { bg = '#dc2626'; fg = '#fff'; }          // rood/wit
    else if (dash) { bg = '#f4c400'; fg = '#000'; }      // geel/zwart
    else { bg = '#2563eb'; fg = '#fff'; }                // blauw/wit

    container.style.setProperty('background', bg, 'important');
    container.style.setProperty('color', fg, 'important');

    // Zorg dat inner bar erft (geen witte strook)
    const inner = container.querySelector('.topbar-inner');
    if (inner) {
      inner.style.background = 'transparent';
      inner.style.color = 'inherit';
    }
  }

  /* ───────── Renders ───────── */
  function renderTopbar(container, opts, cfg, online) {
    if (!container) return;
    container.innerHTML = '';

    const {
      title   = 'Superhond',
      icon    = '🐾',
      home    = null,     // null = autodetect via body-class, true = dashboard, false = subpage
      back    = null,     // string (url) of true = history.back
      version = null
    } = opts || {};

    // Bepaal of dit dashboard is (absolute link /dashboard/ werkt altijd)
    const isDash = (home === true) || (home === null && document.body.classList.contains('dashboard-page'));

    // Terugknop
    let backEl = null;
    if (back || back === true || (!isDash && back !== false)) {
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
      isDash
        ? el('span', { class: 'brand' }, `${icon} ${title}`)
        : el('a', { class: 'brand', href: '/dashboard/' }, `${icon} ${title}`)
    );

    const right = el(
      'div',
      { class: 'tb-right' },
      el('span', {
        class: `status-dot ${statusClass(online)}`,
        title: online ? 'Online' : 'Offline',
        'aria-hidden': 'true'
      }),
      el('span', { class: 'status-text', 'aria-live': 'polite' }, online ? 'Online' : 'Offline'),
      el('span', { class: 'muted' }, `v${version || cfg?.version || APP_VERSION}`),
      cfg?.env ? el('span', { class: 'muted' }, `(${cfg.env})`) : null
    );

    // éénmalige basis-styles
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
      .status-text{font-weight:600}
      .muted{opacity:.85}
      @media (prefers-color-scheme: dark){ #topbar .topbar-inner{border-bottom-color:#374151} }
    `
    );

    inner.append(left, right);
    container.append(inner);

    // Kleur afleiden van body-classes (admin/dash/sub)
    forceTopbarColors(container);
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

  /* ───────── Netwerkstatus ───────── */
  function applyNetStatus(ok) {
    const dot = document.querySelector('#topbar .status-dot');
    const txt = document.querySelector('#topbar .status-text');
    if (dot) {
      dot.classList.toggle('is-online', !!ok);
      dot.classList.toggle('is-offline', !ok);
    }
    if (txt) txt.textContent = ok ? 'Online' : 'Offline';
    LAST_NET_OK = !!ok;
  }

  /* ───────── Mount ───────── */
  async function mount(opts = {}) {
    await new Promise((res) => onReady(res));
    applyDensity();

    // autodetect pagina-type aan de hand van pad
    const path = location.pathname.replace(/\/+$/, '');
    const isDash =
      /\/dashboard$/.test(path) ||
      /\/dashboard\/index\.html$/.test(path) ||
      opts.home === true;

    document.body.classList.toggle('dashboard-page', isDash);
    document.body.classList.toggle('subpage', !isDash);

    // admin-theme meteen toepassen
    document.body.classList.toggle('admin-page', isAdmin());

    // back-knop standaard aan op subpages (tenzij expliciet false)
    const finalOpts = Object.assign({ back: !isDash }, opts);

    // data voor topbar/footer
    const [cfg, online] = await Promise.all([
      fetchJSON(API_CONFIG).catch(() => ({})),
      ping()
    ]);

    const topbarEl = document.getElementById('topbar');
    const footerEl = document.getElementById('footer');
    if (topbarEl) renderTopbar(topbarEl, finalOpts, cfg, online);
    if (footerEl) renderFooter(footerEl, cfg);

    // reeds bekende netstatus toepassen
    if (LAST_NET_OK !== null) applyNetStatus(LAST_NET_OK);

    // periodieke ping
    setInterval(async () => {
      const ok = await ping();
      applyNetStatus(ok);
    }, 45000);
  }

  /* ───────── Public API ───────── */
  function setOnline(ok) { applyNetStatus(ok); }
  const noteSuccess = () => applyNetStatus(true);
  const noteFailure = () => applyNetStatus(false);

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
