/**
 * public/js/sheets.js — Centrale API-laag voor Superhond
 * - Proxy-first naar /api/sheets (CORS-vrij)
 * - Fallback naar directe GAS /exec via setBaseUrl() of /api/config
 * - Timeouts, retries, nette fouten
 */

const DEFAULT_TIMEOUT = 10_000;  // 10s
const DEFAULT_RETRIES = 2;       // totaal 1+2 = 3 pogingen
let   GAS_BASE_URL    = '';      // direct /exec (optioneel)

/** Optioneel: zet directe GAS /exec URL (fallback als proxy niet werkt) */
export function setBaseUrl(url) {
  if (typeof url === 'string') GAS_BASE_URL = url.trim();
}
export function getBaseUrl() {
  return GAS_BASE_URL;
}

/** Normaliseer statusvelden (bv. "Actief" → "actief") */
export function normStatus(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}

/** Intern: fetch met timeout en abort */
async function fetchWithTimeout(url, init = {}, timeoutMs = DEFAULT_TIMEOUT) {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(new Error('timeout')), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ac.signal, cache: 'no-store' });
    return res;
  } finally {
    clearTimeout(to);
  }
}

/** Intern: retry wrapper met eenvoudige backoff */
async function withRetry(doRequest, { retries = DEFAULT_RETRIES, baseDelay = 350 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await doRequest(attempt);
    } catch (err) {
      lastErr = err;
      const timeout = err?.name === 'AbortError' || err?.message === 'timeout';
      const transient = timeout || String(err).includes('Failed to fetch') || String(err).includes('NetworkError');
      if (attempt < retries && transient) {
        const wait = baseDelay * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

/** Bouw proxy URL (root-based) */
function proxyUrl(paramsObj) {
  const url = new URL('/api/sheets', location.origin);
  if (paramsObj) {
    Object.entries(paramsObj).forEach(([k, v]) => {
      if (v != null && v !== '') url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

/** Bouw directe GAS URL (fallback) */
function directUrl(paramsObj) {
  if (!GAS_BASE_URL) return '';
  const url = new URL(GAS_BASE_URL);
  if (paramsObj) {
    Object.entries(paramsObj).forEach(([k, v]) => {
      if (v != null && v !== '') url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

/** Algemene GET – probeert eerst proxy, dan direct */
async function getJSON(paramsObj, { timeout = DEFAULT_TIMEOUT } = {}) {
  return withRetry(async (attempt) => {
    const viaProxy = attempt === 0 || !GAS_BASE_URL; // 1e poging: altijd via proxy
    const url = viaProxy ? proxyUrl(paramsObj) : directUrl(paramsObj);
    if (!url) throw new Error('Geen geldige base URL');

    const res = await fetchWithTimeout(url, { method: 'GET' }, timeout);
    const text = await res.text();
    // Als upstream al JSON heeft meegegeven: doorgooien, anders zelf parsen
    if ((res.headers.get('content-type') || '').includes('application/json')) {
      try { return JSON.parse(text); } catch { /* val door */ }
    }
    try { return JSON.parse(text); }
    catch { throw new Error(`Geen geldige JSON (status ${res.status})`); }
  });
}

/** Algemene POST – JSON doorgeven (of text als string) */
async function postJSON(body, paramsObj, { timeout = DEFAULT_TIMEOUT } = {}) {
  const isString = typeof body === 'string';
  return withRetry(async (attempt) => {
    const viaProxy = attempt === 0 || !GAS_BASE_URL;
    const url = viaProxy ? proxyUrl(paramsObj) : directUrl(paramsObj);
    if (!url) throw new Error('Geen geldige base URL');

    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': isString ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8' },
      body: isString ? body : JSON.stringify(body)
    }, timeout);

    const text = await res.text();
    if ((res.headers.get('content-type') || '').includes('application/json')) {
      try { return JSON.parse(text); } catch { /* val door */ }
    }
    try { return JSON.parse(text); }
    catch { throw new Error(`Geen geldige JSON (status ${res.status})`); }
  });
}

/** Handig hulpfunctie: lees een "tab" (sheet) via legacy `mode=` (kan falen voor onbekende tabs) */
export async function fetchSheet(tabName) {
  const mode = String(tabName || '').toLowerCase();
  if (!mode) throw new Error('tabName vereist');
  // bv. ?mode=klanten|honden|all|diag (bestaat), andere kunnen 404/502 geven → caller mag fallbacken
  const json = await getJSON({ mode });
  if (json?.ok) return json.data;
  throw new Error(json?.error || 'Onbekende fout');
}

/** Moderne GET actions uit main.gs: getLeden|getHonden|getLessen */
export async function fetchAction(action, params = {}) {
  const a = String(action || '').trim();
  if (!a) throw new Error('action vereist');
  const json = await getJSON({ action: a, ...params });
  if (json?.ok) return json.data;
  throw new Error(json?.error || 'Onbekende fout');
}

/** Moderne POST actions: { action, entity, payload } */
export async function postAction(entity, action, payload = {}) {
  const e = String(entity || '').trim().toLowerCase();
  const a = String(action || '').trim().toLowerCase();
  if (!e || !a) throw new Error('entity en action vereist');
  const body = { entity: e, action: a, payload };
  const json = await postJSON(body);
  if (json?.ok) return json.data;
  throw new Error(json?.error || 'Onbekende fout');
}

/** Optioneel: init vanuit /api/config (wordt vaak in dashboard gedaan) */
export async function initFromConfig() {
  try {
    const r = await fetch('../../api/config', { cache: 'no-store' });
    if (r.ok) {
      const cfg = await r.json();
      if (cfg?.apiBase) setBaseUrl(cfg.apiBase);
    }
  } catch { /* best effort */ }
}
