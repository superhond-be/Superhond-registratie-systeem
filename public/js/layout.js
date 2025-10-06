// /public/js/layout.js
// v0.22.0 — Superhond UI + Centrale Config (GAS Web-App URL)
// - Topbar + Footer rendering
// - SuperhondConfig: resolveApiBase() / setApiBase()
// - Optionele API statusbadge (ping)
// -----------------------------------------------------------
(() => {
  const HOME = '/dashboard/';
  const LS_KEY = 'superhond_api_base';
  const TIMEOUT_MS = 9000;

  // ============= Utils =============
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

  // ============= Centrale Config =============
  // Bepaalt de Google Apps Script Web-App base URL (…/exec)
  async function getFromServer() {
    // Optionele serverconfig: /api/config moet { apiBase: "…" } teruggeven
    try {
      const r = await fetchWithTimeout('/api/config', 4000);
      if (!r.ok) return '';
      const j = await r.json().catch(() => ({}));
      return (j?.apiBase || '').trim();
    } catch { return ''; }
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
  function setApiBase(url) {
    try { localStorage.setItem(LS_KEY, String(url || '').trim()); } catch {}
    window.SuperhondConfig._resolved = String(url || '').trim();
    return window.SuperhondConfig._resolved;
  }

  async function resolveApiBase() {
    // volgorde: query → localStorage → server → (leeg)
    const fromQS = getFromQuery();
    if (fromQS) return setApiBase(fromQS);

    const fromLS = getFromLocalStorage();
    if (fromLS) return setApiBase(fromLS);

    const fromSrv = await getFromServer();
    if (fromSrv) return setApiBase(fromSrv);

    return setApiBase(''); // geen default hardcoderen
  }

  // Expose config globaal (voor /klanten/, /honden/, …)
  window.SuperhondConfig = window.SuperhondConfig || {};
  Object.assign(window.SuperhondConfig, {
    resolveApiBase,
    setApiBase,
    _resolved: getFromLocalStorage() // snelle sync
  });

  // ============= UI: Topbar/Footer =============
  async function readVersion() {
    // Probeer /version.json → { version, build, date }
    try {
      const r = await fetchWithTimeout('/version.json', 3000);
      if (!r.ok) throw 0;
      const j = await r.json();
      return j?.version || '';
    } catch {
      return window.__APP_VERSION__ || 'v0.22.x';
    }
  }

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

  async function mount(opts = {}) {
    const title = opts.title || 'Superhond';
    const icon  = opts.icon  || '🐾';
    const back  = (opts.back === null) ? '' : (opts.back || HOME);
    const showApiStatus = !!opts.showApiStatus; // toon ping-badge

    // Body context class
    const path = location.pathname;
    if (path.includes('/dashboard')) document.body.classList.add('dashboard-page');
    else if (path.includes('/beheer') || path.includes('/admin')) document.body.classList.add('admin-page');
    else document.body.classList.add('subpage');

    // Bepaal versie & API base (in parallel)
    const [version, apiBase] = await Promise.all([ readVersion(), resolveApiBase() ]);

    // Topbar
    const top = document.getElementById('topbar');
    if (top) {
      top.innerHTML = '';
      const wrap = el('div', { class: 'container topbar-flex' });

      // Back
      if (back) {
        wrap.appendChild(
          el('a', { href: back, class: 'btn btn-back', title: 'Terug' }, el('span', { text: '← Terug' }))
        );
      }

      // Brand
      wrap.appendChild(
        el('a', { href: HOME, class: 'brand', title: title }, [
          el('span', { text: `${icon} Superhond` })
        ])
      );

      // Versie
      wrap.appendChild(el('span', { class: 'version-badge', text: version || 'v0.22.x' }));

      // API status (optioneel)
      if (showApiStatus) {
        const badge = el('span', { class: 'api-badge muted', text: 'API: …' });
        badge.style.marginLeft = '8px';
        wrap.appendChild(badge);

        // async ping
        const { ok, note } = await pingApi(apiBase);
        badge.textContent = ok ? 'API: OK' : `API: ${note}`;
        badge.className = 'api-badge ' + (ok ? 'ok' : note === 'Timeout' ? 'warn' : 'err');
        badge.title = apiBase ? apiBase : 'Geen API URL ingesteld';
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

  // Expose UI
  window.SuperhondUI = { mount };
})();
