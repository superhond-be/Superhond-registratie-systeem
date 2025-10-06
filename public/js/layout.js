// /public/js/layout.js
// v0.22.1 — Superhond UI + Centrale Config (GAS Web-App URL)
// - resolveApiBase(): QS → LS → /api/config, met validatie + opslag
// - setApiBase(url): opslaan + event "superhond:apiBaseChanged"
// - readVersion(): /api/config.version → /version.json → __APP_VERSION__
// - Topbar/Footer + optionele API-statusbadge
(() => {
  const HOME = '/dashboard/';
  const LS_KEY = 'superhond_api_base';
  const TIMEOUT_MS = 9000;

  // ===== Utils =====
  const strip = s => String(s || '').replace(/^\uFEFF/, '').trim();
  const isHTML = txt => /^\s*</.test(strip(txt));
  const el = (tag, attrs = {}, children = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else n.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).filter(Boolean).forEach(c => n.appendChild(c));
    return n;
  };
  async function fetchWithTimeout(url, ms = TIMEOUT_MS) {
    const ac = ('AbortController' in window) ? new AbortController() : null;
    const t = ac ? setTimeout(() => ac.abort(), ms) : null;
    try { return await fetch(url, { cache: 'no-store', signal: ac?.signal }); }
    finally { if (t) clearTimeout(t); }
  }

  // ===== Validatie van /exec URL =====
  function looksLikeExecUrl(u) {
    try {
      const url = new URL(String(u || ''));
      const hostOK = url.hostname === 'script.google.com';
      const pathOK = url.pathname.startsWith('/macros/s/');
      const endsExec = url.pathname.endsWith('/exec');
      return hostOK && pathOK && endsExec;
    } catch { return false; }
  }

  // ===== Config-bronnen =====
  async function getFromServer() {
    try {
      const r = await fetchWithTimeout('/api/config', 4000);
      if (!r.ok) return {};
      const j = await r.json().catch(() => ({}));
      const apiBase = (j?.apiBase || '').trim();
      const version = (j?.version || '').trim();
      return { apiBase, version };
    } catch { return {}; }
  }
  function getFromQuery() {
    try {
      const qs = new URLSearchParams(location.search);
      return (qs.get('apiBase') || '').trim();
    } catch { return ''; }
  }
  function getFromLocalStorage() {
    try { return (localStorage.getItem(LS_KEY) || '').trim(); } catch { return ''; }
  }

  // ===== Opslaan + event =====
  function setApiBase(url) {
    const val = String(url || '').trim();
    try { localStorage.setItem(LS_KEY, val); } catch {}
    window.SuperhondConfig._resolved = val;
    // notify app (andere scripts) dat base is veranderd
    window.dispatchEvent(new CustomEvent('superhond:apiBaseChanged', { detail: { apiBase: val }}));
    return val;
  }

  // ===== Resolver (QS → LS → Server) =====
  async function resolveApiBase() {
    const fromQS = getFromQuery();
    if (fromQS) return setApiBase(fromQS);

    const fromLS = getFromLocalStorage();
    if (fromLS) return setApiBase(fromLS);

    const { apiBase } = await getFromServer();
    if (apiBase) return setApiBase(apiBase);

    return setApiBase('');
  }

  // ===== Versie lezen =====
  async function readVersion() {
    // Probeer eerst /api/config.version
    const { version: vFromCfg } = await getFromServer();
    if (vFromCfg) return vFromCfg;

    // Dan /version.json
    try {
      const r = await fetchWithTimeout('/version.json', 2500);
      if (r.ok) {
        const j = await r.json();
        if (j?.version) return j.version;
      }
    } catch {}
    // Fallback
    return window.__APP_VERSION__ || 'v0.22.x';
  }

  // ===== Ping helper (optie voor statusbadge) =====
  async function pingApi(base) {
    if (!base) return { ok: false, note: 'Geen API URL' };
    const url = `${base}?mode=ping&t=${Date.now()}`;
    try {
      const r = await fetchWithTimeout(url, 5000);
      const txt = await r.text();
      if (!r.ok) return { ok: false, note: `HTTP ${r.status}` };
      if (isHTML(txt)) return { ok: false, note: 'HTML/login' };
      const j = JSON.parse(strip(txt));
      const ok = j?.ok === true || j?.data?.ok === true || String(j?.ping || '').toLowerCase() === 'ok';
      return { ok, note: ok ? 'OK' : 'Geen ok' };
    } catch (e) {
      const msg = e?.name === 'AbortError' ? 'Timeout' : (e?.message || 'Fout');
      return { ok: false, note: msg };
    }
  }

  // ===== UI mount =====
  async function mount(opts = {}) {
    const title = opts.title || 'Superhond';
    const icon  = opts.icon  || '🐾';
    const back  = (opts.back === null) ? '' : (opts.back || HOME);
    const showApiStatus = !!opts.showApiStatus;

    // Body context class
    const path = location.pathname;
    if (path.includes('/dashboard')) document.body.classList.add('dashboard-page');
    else if (path.includes('/beheer') || path.includes('/admin')) document.body.classList.add('admin-page');
    else document.body.classList.add('subpage');

    // 1) bepaal API-base
    let apiBase = await resolveApiBase();
    // valideer (alleen bij QS/LS): als server-waarde later beter is, wordt die door setApiBase gezet
    if (apiBase && !looksLikeExecUrl(apiBase)) {
      console.warn('[Superhond] apiBase lijkt geen geldige /exec URL:', apiBase);
    }

    // 2) lees versie
    const version = await readVersion();

    // Topbar
    const top = document.getElementById('topbar');
    if (top) {
      top.innerHTML = '';
      const wrap = el('div', { class: 'container topbar-flex' });

      if (back) {
        wrap.appendChild(
          el('a', { href: back, class: 'btn btn-back', title: 'Terug' }, el('span', { text: '← Terug' }))
        );
      }

      wrap.appendChild(
        el('a', { href: HOME, class: 'brand', title: title }, el('span', { text: `${icon} Superhond` }))
      );

      wrap.appendChild(el('span', { class: 'version-badge', text: version || 'v0.22.x' }));

      if (showApiStatus) {
        const badge = el('span', { class: 'api-badge muted', text: 'API: …' });
        badge.style.marginLeft = '8px';
        wrap.appendChild(badge);

        // ping async; update bij wijziging van apiBase ook
        const updateBadge = async () => {
          apiBase = window.SuperhondConfig._resolved || getFromLocalStorage() || apiBase;
          const { ok, note } = await pingApi(apiBase);
          badge.textContent = ok ? 'API: OK' : `API: ${note}`;
          badge.className = 'api-badge ' + (ok ? 'ok' : note === 'Timeout' ? 'warn' : 'err');
          badge.title = apiBase || 'Geen API URL ingesteld';
        };
        updateBadge();
        window.addEventListener('superhond:apiBaseChanged', updateBadge);
      }

      top.appendChild(wrap);
    }

    // Footer
    const foot = document.getElementById('footer');
    if (foot) {
      const now = new Date();
      const ts  = now.toISOString().replace('T',' ').slice(0,19);
      foot.innerHTML = '';
      foot.appendChild(
        el('div', { class:'container' },
          el('small', { text:`© Superhond 2025 — ${version || 'v0.22.x'} — ${ts}` })
        )
      );
    }
  }

  // ===== Globale exports =====
  window.SuperhondConfig = window.SuperhondConfig || {};
  Object.assign(window.SuperhondConfig, {
    resolveApiBase,
    setApiBase,
    getApiBaseSync: () => window.SuperhondConfig._resolved || getFromLocalStorage() || '',
    _resolved: getFromLocalStorage()
  });

  window.SuperhondUI = { mount };
})();
