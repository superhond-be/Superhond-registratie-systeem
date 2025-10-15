/**
 * public/js/sheets.js — Centrale API-laag voor Superhond (v0.27.4)
 *
 * Belangrijk:
 * - Eén bron van waarheid voor de EXEC-URL (Google Apps Script):
 *   localStorage keys:  'superhond:apiBase' (voorkeur) en 'superhond:exec' (legacy)
 * - Alle pagina’s (dashboard/klanten/honden/klassen/…) gebruiken deze module.
 * - Diagnose/Instellingen kunnen via setExecUrl() de URL instellen; iedereen volgt mee.
 *
 * Features:
 * - Timeouts + retries met exponential backoff
 * - GET (mode / action) + POST (entity/action/payload)
 * - Ping helper
 * - Eenvoudige save-helpers (compat met legacy doPost(mode=...))
 */

const LS_KEY_BASE   = 'superhond:apiBase'; // voorkeurskey
const LS_KEY_BASE_2 = 'superhond:exec';    // legacy key (backwards-compatible)
const LS_KEY_BRANCH = 'superhond:branch';

const DEFAULT_TIMEOUT = 12_000; // 12s
const DEFAULT_RETRIES = 2;      // totaal 3 pogingen

let EXEC_BASE_URL = '';         // in-memory cache

/* ───────────────────────────── Helpers: URL sanitize & storage ───────────────────────────── */

function sanitizeExecUrl(url = '') {
  try {
    const u = new URL(String(url).trim());
    // Alleen echte GAS /exec toelaten
    if (
      u.hostname === 'script.google.com' &&
      u.pathname.startsWith('/macros/s/') &&
      u.pathname.endsWith('/exec')
    ) return `${u.origin}${u.pathname}`;
  } catch {}
  return '';
}

function storeBase(url) {
  EXEC_BASE_URL = url || '';
  try {
    if (EXEC_BASE_URL) {
      localStorage.setItem(LS_KEY_BASE, EXEC_BASE_URL);
      localStorage.setItem(LS_KEY_BASE_2, EXEC_BASE_URL); // legacy mirror
    } else {
      localStorage.removeItem(LS_KEY_BASE);
      localStorage.removeItem(LS_KEY_BASE_2);
    }
  } catch {}
}

function readBaseFromStorage() {
  try {
    // voorkeur
    const a = localStorage.getItem(LS_KEY_BASE);
    if (a) return a;
    // legacy fallback
    const b = localStorage.getItem(LS_KEY_BASE_2);
    if (b) return b;
  } catch {}
  return '';
}

function readBaseFromWindowOrMeta() {
  // 1) window.SUPERHOND_SHEETS_URL (indien in HTML gezet)
  if (typeof window.SUPERHOND_SHEETS_URL === 'string' && window.SUPERHOND_SHEETS_URL) {
    return window.SUPERHOND_SHEETS_URL;
  }
  // 2) <meta name="superhond-exec" content="...">
  const meta = document.querySelector('meta[name="superhond-exec"]');
  if (meta?.content) return meta.content.trim();
  return '';
}

/* ───────────────────────────── Publieke configuratie-API ───────────────────────────── */

export function setExecUrl(url) {
  const safe = sanitizeExecUrl(url);
  storeBase(safe);
  // optioneel: UI meteen updaten
  if (safe) window.SuperhondUI?.setOnline?.(true);
  else window.SuperhondUI?.setOnline?.(false);
  return safe;
}

export function getExecUrl() {
  if (EXEC_BASE_URL) return EXEC_BASE_URL;
  const fromLS = readBaseFromStorage();
  if (fromLS) { EXEC_BASE_URL = sanitizeExecUrl(fromLS); return EXEC_BASE_URL; }
  const fromDoc = readBaseFromWindowOrMeta();
  if (fromDoc) { EXEC_BASE_URL = sanitizeExecUrl(fromDoc); return EXEC_BASE_URL; }
  return '';
}

export function setBranchLabel(label = '') {
  try { localStorage.setItem(LS_KEY_BRANCH, String(label || '')); } catch {}
}
export function getBranchLabel() {
  try { return localStorage.getItem(LS_KEY_BRANCH) || ''; } catch { return ''; }
}

/**
 * Best-effort init: laad EXEC-URL uit localStorage of window/meta.
 * (Je kunt dit aanroepen in elke pagina vóór data-calls.)
 */
export async function initFromConfig() {
  if (!EXEC_BASE_URL) {
    // volgorde: LS → window/meta
    const fromLS = readBaseFromStorage();
    if (fromLS) storeBase(sanitizeExecUrl(fromLS));
    if (!EXEC_BASE_URL) {
      const fromDoc = readBaseFromWindowOrMeta();
      if (fromDoc) storeBase(sanitizeExecUrl(fromDoc));
    }
  }
}

/* ───────────────────────────── Fetch utilities ───────────────────────────── */

function peekBody(s, n = 200) {
  return String(s || '').replace(/\s+/g, ' ').slice(0, n);
}

function fetchWithTimeout(url, init = {}, timeoutMs = DEFAULT_TIMEOUT) {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(new Error('timeout')), timeoutMs);
  return fetch(url, { ...init, signal: ac.signal, cache: 'no-store' })
    .finally(() => clearTimeout(id));
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
        /Failed to fetch|NetworkError|ECONNRESET|ENOTFOUND|aborted/i.test(String(err));
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

/* ───────────────────────────── URL bouwers ───────────────────────────── */

function ensureBaseOrThrow() {
  const base = getExecUrl();
  if (!base) throw new Error('Geen geldige Google Apps Script /exec URL ingesteld.');
  return base;
}

function buildGetUrl(params = {}) {
  const base = ensureBaseOrThrow();
  const url = new URL(base);
  Object.entries(params).forEach(([k, v]) => {
    if (v == null || v === '') return;
    url.searchParams.set(k, String(v));
  });
  // cache buster
  url.searchParams.set('t', Date.now());
  return url.toString();
}

/* ───────────────────────────── Kern GET/POST ───────────────────────────── */

async function getJSON(params = {}, { timeout = DEFAULT_TIMEOUT, signal } = {}) {
  return withRetry(async () => {
    const url = buildGetUrl(params);
    const res = await fetchWithTimeout(url, { method: 'GET', signal }, timeout);
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); }
    catch { throw new Error(`Geen geldige JSON (HTTP ${res.status}): ${peekBody(text)}`); }
    if (!res.ok || json?.ok === false) {
      const msg = json?.error || `Upstream ${res.status}`;
      throw new Error(`${msg}: ${peekBody(text)}`);
    }
    return json;
  });
}

async function postJSON(body, params = {}, { timeout = DEFAULT_TIMEOUT, signal } = {}) {
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body || {});
  return withRetry(async () => {
    const url = buildGetUrl(params); // zelfde base + query
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }, // voorkomt CORS preflight bij GAS
      body: bodyText,
      signal
    }, timeout);
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); }
    catch { throw new Error(`Geen geldige JSON (HTTP ${res.status}): ${peekBody(text)}`); }
    if (!res.ok || json?.ok === false) {
      const msg = json?.error || `Upstream ${res.status}`;
      throw new Error(`${msg}: ${peekBody(text)}`);
    }
    return json;
  });
}

/* ───────────────────────────── Publieke data-helpers ───────────────────────────── */

/** Healthcheck naar jouw GAS /exec. Geeft true/false terug. */
export async function pingExec() {
  try {
    const j = await getJSON({ mode: 'ping' }, { timeout: 6_000 });
    return j?.ok === true || j?.data?.ok === true || j?.data?.ping === 'OK';
  } catch {
    return false;
  }
}

/** Legacy GET: lees een tab via mode= */
export async function fetchSheet(tabName, opts = {}) {
  const mode = String(tabName || '').trim();
  if (!mode) throw new Error('tabName vereist');
  const json = await getJSON({ mode }, opts);
  return json?.data || [];
}

/** Moderne GET: action=... */
export async function fetchAction(action, params = {}, opts = {}) {
  const a = String(action || '').trim();
  if (!a) throw new Error('action vereist');
  const json = await getJSON({ action: a, ...params }, opts);
  return json?.data || [];
}

/** Moderne POST: { entity, action, payload } */
export async function postAction(entity, action, payload = {}, opts = {}) {
  const e = String(entity || '').trim().toLowerCase();
  const a = String(action || '').trim().toLowerCase();
  if (!e || !a) throw new Error('entity en action vereist');
  const json = await postJSON({ entity: e, action: a, payload }, {}, opts);
  return json?.data || {};
}

/** Convenience legacy-saves (doPost mode=...) */
export const saveKlant = (data, opts) => postJSON(data, { mode: 'saveKlant' }, opts).then(j => j.data || {});
export const saveHond  = (data, opts) => postJSON(data, { mode: 'saveHond'  }, opts).then(j => j.data || {});
export const saveKlas  = (data, opts) => postJSON(data, { mode: 'saveKlas'  }, opts).then(j => j.data || {});
export const saveLes   = (data, opts) => postJSON(data, { mode: 'saveLes'   }, opts).then(j => j.data || {});

/* ───────────────────────────── Auto-init ───────────────────────────── */

(async function autoInit() {
  try { await initFromConfig(); } catch {}
})();
