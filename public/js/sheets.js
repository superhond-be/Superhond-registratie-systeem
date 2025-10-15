/**
 * public/js/sheets.js — Centrale API-laag (v0.27.4 direct-exec)
 * - GEEN /api-proxy: rechtstreeks naar Google Apps Script /exec
 * - Bron van waarheid: <meta name="superhond-exec" content=".../exec">
 * - Synchroniseert naar localStorage('superhond:execBase') zodat alle pagina’s dezelfde URL hebben
 * - Timeouts, retries, nette fouten
 * - Back-compat: export initFromConfig() als alias
 */

const DEFAULT_TIMEOUT = 12_000;   // 12s
const DEFAULT_RETRIES = 2;        // totaal 3 pogingen
const LS_KEY_BASE     = 'superhond:execBase';

let EXEC_BASE = '';               // actuele /exec base (zonder querystring)

/* ─────────────────── Helpers: bron van waarheid ─────────────────── */

function getMetaExec() {
  const m = document.querySelector('meta[name="superhond-exec"]');
  const v = (m?.content || '').trim();
  return v;
}

function sanitizeExecUrl(url = '') {
  try {
    const u = new URL(String(url).trim());
    if (
      u.hostname === 'script.google.com' &&
      u.pathname.startsWith('/macros/s/') &&
      u.pathname.endsWith('/exec')
    ) {
      // alleen origin + path, geen query/fragment
      return `${u.origin}${u.pathname}`;
    }
  } catch {}
  return '';
}

function loadStoredExec() {
  try { return localStorage.getItem(LS_KEY_BASE) || ''; }
  catch { return ''; }
}

function storeExec(url) {
  try {
    if (url) localStorage.setItem(LS_KEY_BASE, url);
    else localStorage.removeItem(LS_KEY_BASE);
  } catch {}
}

/**
 * Initialiseer EXEC_BASE:
 * 1) lees <meta name="superhond-exec">
 * 2) fallback op localStorage
 * 3) synchroniseer localStorage indien nodig
 */
export async function initFromMetaOrStorage() {
  let base = sanitizeExecUrl(getMetaExec());
  if (!base) base = sanitizeExecUrl(loadStoredExec());
  if (!base) {
    EXEC_BASE = '';
    return;
  }
  EXEC_BASE = base;
  // sync naar storage (één bron voor alle pagina’s)
  storeExec(EXEC_BASE);
}

/** Back-compat: laat bestaande code die initFromConfig() aanroept gewoon werken */
export const initFromConfig = initFromMetaOrStorage;

/** Handig als je de base in runtime wil overschrijven (bv. instellingenscherm) */
export function setExecBase(url) {
  const safe = sanitizeExecUrl(url);
  EXEC_BASE = safe;
  storeExec(safe);
}
export function getExecBase() {
  if (EXEC_BASE) return EXEC_BASE;
  // lazy init: probeer alsnog meta/storage
  const m = sanitizeExecUrl(getMetaExec());
  if (m) { EXEC_BASE = m; storeExec(m); return EXEC_BASE; }
  const s = sanitizeExecUrl(loadStoredExec());
  if (s) { EXEC_BASE = s; return EXEC_BASE; }
  return '';
}

/** Snelle ping naar /exec?mode=ping */
export async function pingExec() {
  const base = getExecBase();
  if (!base) return false;
  const sep = base.includes('?') ? '&' : '?';
  const url = `${base}${sep}mode=ping&t=${Date.now()}`;
  try {
    const r = await fetch(url, { cache: 'no-store' });
    return r.ok;
  } catch {
    return false;
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
        /Failed to fetch|NetworkError|ECONNRESET|ENOTFOUND|TLS|temporar/i.test(String(err));
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

/* ─────────────────── URL builder ─────────────────── */

function buildExecUrl(paramsObj) {
  const base = getExecBase();
  if (!base) throw new Error('Geen geldige exec-base URL (superhond-exec/meta of localStorage ontbreekt).');
  const url = new URL(base);
  if (paramsObj) {
    Object.entries(paramsObj).forEach(([k, v]) => {
      if (v != null && v !== '') url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

/* ─────────────────── Kern GET/POST ─────────────────── */

async function getJSON(paramsObj, { timeout = DEFAULT_TIMEOUT } = {}) {
  return withRetry(async () => {
    const url = buildExecUrl(paramsObj);
    const res  = await fetchWithTimeout(url, { method: 'GET' }, timeout);
    const text = await res.text();

    let json;
    try { json = JSON.parse(text); }
    catch { throw new Error(`Geen geldige JSON (status ${res.status}): ${peekBody(text)}`); }

    // GAS kan zowel { ok:true, data } als ruwe data[] teruggeven
    if (!res.ok || json?.ok === false) {
      const err = json?.error || `Upstream ${res.status}`;
      throw new Error(`${err}: ${peekBody(text)}`);
    }
    return json;
  });
}

async function postJSON(body, paramsObj, { timeout = DEFAULT_TIMEOUT } = {}) {
  // Altijd als text/plain (GAS leest e.postData.contents; vermijdt CORS/preflight)
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body || {});
  return withRetry(async () => {
    const url = buildExecUrl(paramsObj);
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

/** Vangt verschillende responsevormen op en geeft altijd een array terug. */
export function toArrayRows(x){
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  if (x && Array.isArray(x.rows)) return x.rows;
  if (x && Array.isArray(x.result)) return x.result;
  if (x && x.ok === true && Array.isArray(x.data)) return x.data;
  if (x && x.data && Array.isArray(x.data.rows)) return x.data.rows;
  return [];
}

/** Lees een sheet-tab via legacy `mode=`: klanten|honden|klassen|lessen|reeksen|all|diag */
export async function fetchSheet(tabName, opts = {}) {
  const mode = String(tabName || '').toLowerCase();
  if (!mode) throw new Error('tabName vereist');
  const json = await getJSON({ mode }, { timeout: opts.timeout ?? DEFAULT_TIMEOUT });
  // zowel {ok:true,data} als rauwe array
  return json?.data ?? json ?? [];
}

/** Moderne GET actions uit GAS (indien aanwezig): bv. action=getLeden */
export async function fetchAction(action, params = {}, opts = {}) {
  const a = String(action || '').trim();
  if (!a) throw new Error('action vereist');
  const json = await getJSON({ action: a, ...params }, { timeout: opts.timeout ?? DEFAULT_TIMEOUT });
  return json?.data ?? json ?? [];
}

/** Moderne POST actions (algemene router): { entity, action, payload } */
export async function postAction(entity, action, payload = {}, opts = {}) {
  const e = String(entity || '').trim().toLowerCase();
  const a = String(action || '').trim().toLowerCase();
  if (!e || !a) throw new Error('entity en action vereist');
  const json = await postJSON({ entity: e, action: a, payload }, null, { timeout: opts.timeout ?? DEFAULT_TIMEOUT });
  return json?.data ?? json ?? {};
}

/* Convenience: directe save-calls die mappen op doPost(mode=...) in je GAS */
export const saveKlant = (data,   opts={}) => postJSON(data, { mode: 'saveKlant' },   { timeout: opts.timeout ?? DEFAULT_TIMEOUT }).then(j => j.data || {});
export const saveHond  = (data,   opts={}) => postJSON(data, { mode: 'saveHond'  },   { timeout: opts.timeout ?? DEFAULT_TIMEOUT }).then(j => j.data || {});
export const saveKlas  = (data,   opts={}) => postJSON(data, { mode: 'saveKlas'  },   { timeout: opts.timeout ?? DEFAULT_TIMEOUT }).then(j => j.data || {});
export const saveLes   = (data,   opts={}) => postJSON(data, { mode: 'saveLes'   },   { timeout: opts.timeout ?? DEFAULT_TIMEOUT }).then(j => j.data || {});

/* ─────────────────── Auto-init ─────────────────── */
/** Best-effort init bij load (kan je ook handmatig aanroepen vóór fetchSheet/save...) */
(async function autoInit(){
  try { await initFromMetaOrStorage(); } catch {}
})();
