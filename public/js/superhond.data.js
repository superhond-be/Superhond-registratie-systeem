// /public/js/superhond.data.js
// v0.23.0 — Superhond Data Core (centrale fetch/caching/opslaan)

export const SHData = (() => {
  // ====== Keys & timers ======
  const LS_API     = 'superhond_api_base';
  const LS_ROUTE   = 'superhond_api_route';         // 'direct' | 'proxy' | 'jina' | 'ao-raw' | 'ao-get'
  const LS_CACHE   = 'superhond_cache';             // prefix voor caches
  const TTL_MS     = 5 * 60 * 1000;                 // 5 minuten cache
  const TIMEOUT_MS = 9000;

  // ====== Utilities ======
  const strip = s => String(s || '').replace(/^\uFEFF/, '').trim();
  const isHTML = txt => /^\s*</.test(strip(txt).slice(0, 200).toLowerCase());
  const bust = () => `t=${Date.now()}`;

  async function fetchWithTimeout(url, opts = {}, ms = TIMEOUT_MS) {
    const ac = ('AbortController' in window) ? new AbortController() : null;
    const to = ac ? setTimeout(() => ac.abort('timeout'), ms) : null;
    try {
      return await fetch(url, { cache: 'no-store', signal: ac?.signal, ...opts });
    } finally { if (to) clearTimeout(to); }
  }

  const qp = (mode, params={}) => new URLSearchParams({ mode, ...params, t: Date.now() }).toString();

  // ====== API base & routes ======
  let API_BASE = ''; // wordt lazy geladen via SuperhondConfig.resolveApiBase()
  function getSavedRoute() { try { return localStorage.getItem(LS_ROUTE) || ''; } catch { return ''; } }
  function saveRoute(name) { try { localStorage.setItem(LS_ROUTE, name || ''); } catch {} }

  const urls = {
    direct: (m, p) => `${API_BASE}?${qp(m, p)}`,
    proxy : (m, p) => `/api/sheets?${qp(m, p)}`,
    jina  : (m, p) => `https://r.jina.ai/http://${(`${API_BASE}?${qp(m,p)}`).replace(/^https?:\/\//,'')}`,
    aoRaw : (m, p) => `https://api.allorigins.win/raw?url=${encodeURIComponent(`${API_BASE}?${qp(m,p)}`)}`,
    aoGet : (m, p) => `https://api.allorigins.win/get?url=${encodeURIComponent(`${API_BASE}?${qp(m,p)}`)}`,
  };

  function parseMaybeWrapped(txt, wrapped=false) {
    const t = strip(txt);
    if (isHTML(t)) throw new Error('HTML/login ontvangen (Web App niet publiek?)');
    if (!wrapped) return JSON.parse(t);
    const j = JSON.parse(t);
    const inner = strip(j?.contents || '');
    if (isHTML(inner)) throw new Error('Proxy HTML ontvangen');
    return JSON.parse(inner);
  }

  async function tryRoute(kind, mode, params={}, wrapped=false, opts={}) {
    const u = urls[kind](mode, params);
    const r = await fetchWithTimeout(u, opts);
    const txt = await r.text();
    if (!r.ok) throw new Error(`${kind}: HTTP ${r.status}`);
    const j = parseMaybeWrapped(txt, wrapped);
    const data = (j?.data !== undefined) ? j.data : j;
    saveRoute(kind);
    return data;
  }

  async function resolveApiBase() {
    if (API_BASE) return API_BASE;
    // volgorde: query/localStorage/server → via layout.js SuperhondConfig
    if (window.SuperhondConfig?.resolveApiBase) {
      API_BASE = await window.SuperhondConfig.resolveApiBase();
    } else {
      try { API_BASE = localStorage.getItem(LS_API) || ''; } catch {}
    }
    return API_BASE;
  }

  // ====== Cache helpers ======
  function cacheKey(mode, params={}) {
    const p = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
    return `${LS_CACHE}:${mode}${p ? ':'+p : ''}`;
  }
  function readCache(mode, params={}) {
    try {
      const raw = localStorage.getItem(cacheKey(mode, params));
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj?.ts || !obj?.data) return null;
      if (Date.now() - obj.ts > TTL_MS) return null;
      return obj.data;
    } catch { return null; }
  }
  function writeCache(mode, params, data) {
    try { localStorage.setItem(cacheKey(mode, params), JSON.stringify({ ts: Date.now(), data })); } catch {}
  }
  function clearAllCache() {
    try {
      Object.keys(localStorage).forEach(k => { if (k.startsWith(LS_CACHE)) localStorage.removeItem(k); });
    } catch {}
  }

  // ====== Core GET (met adaptive route) ======
  async function get(mode, params={}, { useCache=true } = {}) {
    await resolveApiBase();
    if (!API_BASE) throw new Error('Geen API URL ingesteld.');

    if (useCache) {
      const c = readCache(mode, params);
      if (c) return c;
    }

    const saved = getSavedRoute();
    const sequence = (() => {
      // als we al een snelle route kennen, probeer die eerst en alleen
      if (saved === 'direct') return [{k:'direct'}];
      if (saved === 'proxy')  return [{k:'proxy'}];
      if (saved === 'jina')   return [{k:'jina'}];
      if (saved === 'ao-raw') return [{k:'aoRaw'}];
      if (saved === 'ao-get') return [{k:'aoGet', w:true}];
      // anders: direct → (optioneel) proxy → jina → aoRaw → aoGet
      return [
        {k:'direct'},
        ...(true ? [] : [{k:'proxy'}]), // zet je proxy hier desgewenst aan
        {k:'jina'},
        {k:'aoRaw'},
        {k:'aoGet', w:true},
      ];
    })();

    const errors=[];
    for (const step of sequence) {
      try {
        const data = await tryRoute(step.k, mode, params, !!step.w);
        writeCache(mode, params, data);
        return data;
      } catch(e) { errors.push(e.message); }
    }
    throw new Error(`GET ${mode} faalde – ${errors.join(' | ')}`);
  }

  // ====== Core POST (altijd direct/proxy; geen allorigins) ======
  async function post(mode, payload={}, { timeout=12000 } = {}) {
    await resolveApiBase();
    if (!API_BASE) throw new Error('Geen API URL ingesteld.');

    const url = urls.direct(mode, {});
    const r = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    }, timeout);
    const txt = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = parseMaybeWrapped(txt, false);
    if (j?.ok !== true) throw new Error(j?.error || 'Onbekende API-fout');
    clearAllCache(); // invalidate cache na mutatie
    return j.data;
  }

  // ====== Convenience helpers ======
  async function getAll(options={}) {
    // Verwacht { klanten, honden } van GAS
    const j = await get('all', {}, options);
    return j?.data || j; // steun zowel RESP.ok als raw
  }
  async function getKlanten(options={}) { const j = await get('klanten', {}, options); return j?.data || j; }
  async function getHonden (options={}) { const j = await get('honden',  {}, options); return j?.data || j; }
  async function saveKlant(payload) { return post('saveKlant', payload); }
  async function saveHond (payload) { return post('saveHond',  payload); }

  return {
    // core
    get, post, getAll, getKlanten, getHonden, saveKlant, saveHond,
    // tools
    resolveApiBase,
    clearCache: clearAllCache,
    get apiBase(){ return API_BASE; }
  };
})();
