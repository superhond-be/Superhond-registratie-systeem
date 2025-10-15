/**
 * public/js/sheets.js — Centrale API-laag zonder /api-proxy (v0.27.0)
 * - Werkt rechtstreeks met Google Apps Script /exec
 * - Leest/schrijft base-URL in localStorage: superhond:apiBase
 * - Leest ook window.SUPERHOND_SHEETS_URL of <meta name="superhond-exec"> als fallback
 * - Timeouts, retries, nette fouten (zonder preflight)
 * - Export: setBaseUrl/getBaseUrl/initFromConfig/ping/fetchSheet/fetchAction/postAction
 *           + saveKlant/saveHond/saveKlas/saveLes + helpers
 */

const DEFAULT_TIMEOUT = 10_000;      // 10s
const DEFAULT_RETRIES = 2;           // totaal 3 pogingen
const LS_KEY_BASE     = 'superhond:apiBase';

let GAS_BASE_URL = '';               // wordt gevuld door initFromConfig() of setBaseUrl()

/* ───────────────────────── Base helpers ───────────────────────── */
function sanitizeExecUrl(url = '') {
  try {
    const u = new URL(String(url).trim());
    // Alleen officiële GAS /exec toelaten
    if (
      u.hostname === 'script.google.com' &&
      u.pathname.startsWith('/macros/s/') &&
      u.pathname.endsWith('/exec')
    ) return `${u.origin}${u.pathname}`;
  } catch {}
  return '';
}

export function setBaseUrl(url) {
  const safe = sanitizeExecUrl(url);
  GAS_BASE_URL = safe;
  try {
    if (safe) localStorage.setItem(LS_KEY_BASE, safe);
    else localStorage.removeItem(LS_KEY_BASE);
  } catch {}
}
export function getBaseUrl() { return GAS_BASE_URL; }

function resolveMetaExec() {
  // 1) globaal venster
  if (typeof window.SUPERHOND_SHEETS_URL === 'string' && window.SUPERHOND_SHEETS_URL) {
    return window.SUPERHOND_SHEETS_URL;
  }
  // 2) <meta name="superhond-exec" content="...">
  const m = document.querySelector('meta[name="superhond-exec"]');
  if (m?.content) return m.content.trim();
  return '';
}

export async function initFromConfig() {
  // Voorkeur: localStorage (is gezet via /instellingen/)
  if (!GAS_BASE_URL) {
    try {
      const ls = localStorage.getItem(LS_KEY_BASE);
      if (ls) setBaseUrl(ls);
    } catch {}
  }
  // Fallback: window/meta
  if (!GAS_BASE_URL) {
    const meta = resolveMetaExec();
    if (meta) setBaseUrl(meta);
  }
}

/* ───────────────────────── Fetch utils ───────────────────────── */
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
      const timeout = err?.name === 'AbortError' || err?.message === 'timeout';
      const transient = timeout || /Failed to fetch|NetworkError|ECONNRESET|ENOTFOUND/i.test(String(err));
      if (attempt < retries && transient) {
        const wait = baseDelay * Math.pow(2, attempt); // 300, 600, 1200ms
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

/* ───────────────────────── URL helpers ───────────────────────── */
function ensureBaseOrThrow() {
  if (!GAS_BASE_URL) throw new Error('Geen GAS base URL ingesteld. Ga naar Instellingen en bewaar de /exec-URL.');
}
function buildUrl(paramsObj = {}) {
  ensureBaseOrThrow();
  const url = new URL(GAS_BASE_URL);
  Object.entries(paramsObj).forEach(([k, v]) => {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  });
  return url.toString();
}

/* ───────────────────────── Kern GET/POST ───────────────────────── */
async function getJSON(paramsObj, { timeout = DEFAULT_TIMEOUT } = {}) {
  const url = buildUrl(paramsObj);
  return withRetry(async () => {
    const res  = await fetchWithTimeout(url, { method: 'GET' }, timeout);
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

async function postJSON(body, paramsObj, { timeout = DEFAULT_TIMEOUT } = {}) {
  const url = buildUrl(paramsObj);
  // Altijd als text/plain → GAS leest e.postData.contents (geen CORS preflight)
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body || {});
  return withRetry(async () => {
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

/* ───────────────────────── Publieke API ───────────────────────── */
export function normStatus(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
export function isConfigured() { return !!GAS_BASE_URL; }

export async function ping() {
  try {
    const sep = GAS_BASE_URL.includes('?') ? '&' : '?';
    const url = `${GAS_BASE_URL}${sep}mode=ping&t=${Date.now()}`;
    const r = await fetchWithTimeout(url, { method: 'GET' }, 6000);
    return r.ok;
  } catch { return false; }
}

/** Legacy tabs: klanten|honden|klassen|lessen|reeksen|all|diag */
export async function fetchSheet(tabName) {
  const mode = String(tabName || '').toLowerCase();
  if (!mode) throw new Error('tabName vereist');
  const json = await getJSON({ mode });
  return json?.data || [];
}

/** Moderne GET actions uit GAS (indien aanwezig), bv. action=getLeden */
export async function fetchAction(action, params = {}) {
  const a = String(action || '').trim();
  if (!a) throw new Error('action vereist');
  const json = await getJSON({ action: a, ...params });
  return json?.data || [];
}

/** Moderne POST actions: { entity, action, payload } */
export async function postAction(entity, action, payload = {}) {
  const e = String(entity || '').trim().toLowerCase();
  const a = String(action || '').trim().toLowerCase();
  if (!e || !a) throw new Error('entity en action vereist');
  const json = await postJSON({ entity: e, action: a, payload });
  return json?.data || {};
}

/* Directe save-varianten voor legacy doPost(mode=...) handlers */
export const saveKlant = (data) => postJSON(data, { mode: 'saveKlant' }).then(j => j.data || {});
export const saveHond  = (data) => postJSON(data, { mode: 'saveHond'  }).then(j => j.data || {});
export const saveKlas  = (data) => postJSON(data, { mode: 'saveKlas'  }).then(j => j.data || {});
export const saveLes   = (data) => postJSON(data, { mode: 'saveLes'   }).then(j => j.data || {});

/* ───────────────────────── Auto-init ───────────────────────── */
(async function autoInit(){ try { await initFromConfig(); } catch {} })();
