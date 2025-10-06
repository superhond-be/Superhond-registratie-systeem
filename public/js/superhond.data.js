// v0.23.0 — Centrale Superhond Data Core
// Bevat API-detectie, caching en fetch helpers

export const SHData = (() => {
  const LS_KEY_API   = 'superhond_api_base';
  const LS_KEY_ROUTE = 'superhond_api_route';
  const LS_KEY_CACHE = 'superhond_cache_all';
  const BASE         = localStorage.getItem(LS_KEY_API) || '';
  const ROUTE        = localStorage.getItem(LS_KEY_ROUTE) || '';
  const TTL_MS       = 5 * 60 * 1000;

  const strip = s => String(s||'').replace(/^\uFEFF/, '').trim();
  const isHTML = t => /^\s*</.test(strip(t));
  const fetchWithTimeout = async (url, opts={}, ms=8000) => {
    const ac = new AbortController();
    const to = setTimeout(()=>ac.abort('timeout'), ms);
    try { return await fetch(url, { cache:'no-store', signal:ac.signal, ...opts }); }
    finally { clearTimeout(to); }
  };

  const query = (mode, p={}) => new URLSearchParams({ mode, t:Date.now(), ...p }).toString();
  const direct = (m,p) => `${BASE}?${query(m,p)}`;
  const proxy  = (m,p) => `/api/sheets?${query(m,p)}`;

  async function fetchJson(mode, params={}, { useCache=true } = {}) {
    const key = `${LS_KEY_CACHE}_${mode}`;
    if (useCache) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const obj = JSON.parse(raw);
        if (Date.now() - obj.ts < TTL_MS) return obj.data;
      }
    }
    const url = ROUTE === 'proxy' ? proxy(mode, params) : direct(mode, params);
    const r = await fetchWithTimeout(url);
    const txt = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    if (isHTML(txt)) throw new Error('HTML ontvangen (waarschijnlijk loginpagina)');
    const j = JSON.parse(strip(txt));
    localStorage.setItem(key, JSON.stringify({ ts:Date.now(), data:j }));
    return j;
  }

  return {
    async getAll() {
      const j = await fetchJson('all');
      return j?.data || j;
    },
    async saveKlant(payload) {
      const r = await fetchWithTimeout(`${BASE}?mode=saveKlant&t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      }, 10000);
      const txt = await r.text();
      const j = JSON.parse(strip(txt));
      if (!j.ok) throw new Error(j.error || 'Opslaan mislukt');
      return j.data;
    },
    clearCache() {
      Object.keys(localStorage)
        .filter(k => k.startsWith(LS_KEY_CACHE))
        .forEach(k => localStorage.removeItem(k));
    }
  };
})();
