/**
 * public/js/sheets.js — Centrale API-laag voor Superhond (v0.21.0)
 * - Proxy-first naar /api/sheets (CORS-vrij) met veilige base-override
 * - Fallback naar directe GAS /exec (optioneel)
 * - Timeouts, retries, nette fouten + localStorage cache voor apiBase
 */

const DEFAULT_TIMEOUT = 10_000;   // 10s
const DEFAULT_RETRIES = 2;        // totaal 3 pogingen
const LS_KEY_BASE     = 'superhond:apiBase';

let   GAS_BASE_URL    = '';       // directe /exec (optioneel; wordt ook via /api/config gezet)

/* ─────────────────── Base helpers ─────────────────── */
function sanitizeExecUrl(url = '') {
  try {
    const u = new URL(String(url).trim());
    if (
      u.hostname === 'script.google.com' &&
      u.pathname.startsWith('/macros/s/') &&
      u.pathname.endsWith('/exec')
    ) {
      return `${u.origin}${u.pathname}`;
    }
  } catch {}
  return '';
}

/** Optioneel: zet directe GAS /exec URL + persist (fallback als proxy niet werkt) */
export function setBaseUrl(url) {
  const safe = sanitizeExecUrl(url);
  GAS_BASE_URL = safe;
  try {
    if (safe) localStorage.setItem(LS_KEY_BASE, safe);
    else localStorage.removeItem(LS_KEY_BASE);
  } catch {}
}

export function getBaseUrl() { return GAS_BASE_URL; }

/** Init: haal base uit /api/config → localStorage → window */
export async function initFromConfig() {
  if (!GAS_BASE_URL) {
    try {
      const r = await fetch('/api/config', { cache: 'no-store' });
      if (r.ok) {
        const cfg = await r.json();
        if (cfg?.apiBase) setBaseUrl(cfg.apiBase);
      }
    } catch {}
  }
  if (!GAS_BASE_URL) {
    try {
      const ls = localStorage.getItem(LS_KEY_BASE);
      if (ls) setBaseUrl(ls);
    } catch {}
  }
  if (!GAS_BASE_URL && window.SUPERHOND_SHEETS_URL) {
    setBaseUrl(window.SUPERHOND_SHEETS_URL);
  }
}

/* ─────────────────── Fetch utils ─────────────────── */
function peekBody(s, n = 180) {
  return String(s || '').trim().replace(/\s+/g, ' ').slice(0, n);
}

async function fetchWithTimeout(url, init = {}, timeoutMs = DEFAULT_TIMEOUT) {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(new Error('timeout')), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ac.signal, cache: 'no-store' });
  } finally {
    clearTimeout(to);
  }
}

async function withRetry(doRequest, { retries = DEFAULT_RETRIES, baseDelay = 300 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await doRequest(attempt);
    } catch (err) {
      lastErr = err;
      const isTimeout = err?.name === 'AbortError' || err?.message === 'timeout';
      const transient = isTimeout ||
        /Failed to fetch|NetworkError|ECONNRESET|ENOTFOUND/i.test(String(err));
      if (attempt < retries && transient) {
        const wait = baseDelay * Math.pow(2, attempt); // 300ms, 600ms, 1200ms
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

/* ─────────────────── URL builders ─────────────────── */
function proxyUrl(paramsObj) {
  const url = new URL('/api/sheets', location.origin);
  if (paramsObj) {
    Object.entries(paramsObj).forEach(([k, v]) => {
      if (v != null && v !== '') url.searchParams.set(k, String(v));
    });
  }
  // ⬇️ Stuur veilige base override mee, jouw server/api/sheets.js valideert dit
  if (GAS_BASE_URL) url.searchParams.set('base', GAS_BASE_URL);
  return url.toString();
}

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

/* ─────────────────── Kern GET/POST ─────────────────── */
async function getJSON(paramsObj, { timeout = DEFAULT_TIMEOUT } = {}) {
  return withRetry(async (attempt) => {
    // 1e poging via proxy; bij mislukken met directe fallback (als base bekend is)
    const viaProxy = attempt === 0 || !GAS_BASE_URL;
    const url = viaProxy ? proxyUrl(paramsObj) : directUrl(paramsObj);
    if (!url) throw new Error('Geen geldige base URL');

    const res  = await fetchWithTimeout(url, { method: 'GET' }, timeout);
    const text = await res.text();

    // Probeer JSON te parsen
    let json;
    try { json = JSON.parse(text); }
    catch { throw new Error(`Geen geldige JSON (status ${res.status}): ${peekBody(text)}`); }

    if (!res.ok || json?.ok === false) {
      const err = json?.error || `Upstream ${res.status}`;
      throw new Error(`${err}: ${peekBody(text)}`);
    }
    return json;
  });
}

async function postJSON(body, paramsObj, { timeout = DEFAULT_TIMEOUT } = {}) {
  // Altijd als string doorsturen met text/plain (GAS leest e.postData.contents; geen preflight)
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body || {});
  return withRetry(async (attempt) => {
    const viaProxy = attempt === 0 || !GAS_BASE_URL;
    const url = viaProxy ? proxyUrl(paramsObj) : directUrl(paramsObj);
    if (!url) throw new Error('Geen geldige base URL');

    const res  = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: bodyText
    }, timeout);
    const text = await res.text();

    let json;
    try { json = JSON.parse(text); }
    catch { throw new Error(`Geen geldige JSON (status ${res.status}): ${peekBody(text)}`); }

    if (!res.ok || json?.ok === false) {
      const err = json?.error || `Upstream ${res.status}`;
      throw new Error(`${err}: ${peekBody(text)}`);
    }
    return json;
  });
}

/* ─────────────────── Publieke helpers ─────────────────── */
export function normStatus(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}

/** Lees een sheet-tab via legacy `mode=`: klanten|honden|klassen|lessen|reeksen|all|diag */
export async function fetchSheet(tabName) {
  const mode = String(tabName || '').toLowerCase();
  if (!mode) throw new Error('tabName vereist');
  const json = await getJSON({ mode });
  return json?.data || [];
}

/** Moderne GET actions uit GAS (indien aanwezig): bv. action=getLeden */
export async function fetchAction(action, params = {}) {
  const a = String(action || '').trim();
  if (!a) throw new Error('action vereist');
  const json = await getJSON({ action: a, ...params });
  return json?.data || [];
}

/** Moderne POST actions (algemene router): { entity, action, payload } */
export async function postAction(entity, action, payload = {}) {
  const e = String(entity || '').trim().toLowerCase();
  const a = String(action || '').trim().toLowerCase();
  if (!e || !a) throw new Error('entity en action vereist');
  const json = await postJSON({ entity: e, action: a, payload });
  return json?.data || {};
}

/* Convenience: directe save-calls die mappen op doPost(mode=...) in main.gs */
export const saveKlant = (data) => postJSON(data, { mode: 'saveKlant' }).then(j => j.data || {});
export const saveHond  = (data) => postJSON(data, { mode: 'saveHond'  }).then(j => j.data || {});
export const saveKlas  = (data) => postJSON(data, { mode: 'saveKlas'  }).then(j => j.data || {});
export const saveLes   = (data) => postJSON(data, { mode: 'saveLes'   }).then(j => j.data || {});

/* ─────────────────── Bootstrapping ─────────────────── */
/** Best-effort init (kun je ook handmatig aanroepen vóór fetchSheet/save...) */
(async function autoInit(){
  try { await initFromConfig(); } catch {}
})();
