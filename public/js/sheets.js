/**
 * public/js/sheets.js — Centrale API-laag voor Superhond (v0.27.4)
 * - Rechtstreeks naar GAS /exec (geen /api-proxy)
 * - Eén bron van waarheid voor Exec-URL (localStorage -> window -> <meta>)
 * - Timeouts, retries, nette fouten
 * - Exports: getExecBase, setExecBase, pingExec, initFromConfig
 *           fetchSheet, fetchAction, postAction
 *           saveKlant, saveHond, saveKlas, saveLes
 */

const DEFAULT_TIMEOUT = 12_000;      // 12s
const DEFAULT_RETRIES = 2;           // totaal 1+2 pogingen
const LS_KEY_EXEC     = 'superhond:execBase';

let EXEC_BASE = '';                   // actuele, gevalideerde /exec

/* ───────────────────────────────── Base URL ───────────────────────────────── */

function sanitizeExecUrl(url = '') {
  try {
    const u = new URL(String(url).trim());
    // Alleen publiek toegankelijke GAS exec is toegestaan
    if (
      u.hostname === 'script.google.com' &&
      u.pathname.startsWith('/macros/s/') &&
      u.pathname.endsWith('/exec')
    ) {
      return `${u.origin}${u.pathname}`; // zonder querystring, schoon
    }
  } catch {}
  return '';
}

function resolveExecBase() {
  // 1) localStorage
  try {
    const ls = localStorage.getItem(LS_KEY_EXEC);
    if (ls) {
      const safe = sanitizeExecUrl(ls);
      if (safe) return safe;
    }
  } catch {}

  // 2) window.SUPERHOND_SHEETS_URL
  if (typeof window !== 'undefined' && window.SUPERHOND_SHEETS_URL) {
    const safe = sanitizeExecUrl(window.SUPERHOND_SHEETS_URL);
    if (safe) return safe;
  }

  // 3) <meta name="superhond-exec" content="...">
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="superhond-exec"]');
    if (meta?.content) {
      const safe = sanitizeExecUrl(meta.content);
      if (safe) return safe;
    }
  }

  return '';
}

/** Zet de Exec-URL (sanitized) en persist in localStorage */
export function setExecBase(url) {
  const safe = sanitizeExecUrl(url);
  EXEC_BASE = safe;
  try {
    if (safe) localStorage.setItem(LS_KEY_EXEC, safe);
    else localStorage.removeItem(LS_KEY_EXEC);
  } catch {}
}

/** Haal de actieve Exec-URL op (string of lege string) */
export function getExecBase() {
  return EXEC_BASE || '';
}

/** Best-effort init; roept je op bij page-start */
export async function initFromConfig() {
  if (!EXEC_BASE) {
    const resolved = resolveExecBase();
    if (resolved) setExecBase(resolved);
  }
}

/* ─────────────────────────────── Fetch utils ─────────────────────────────── */

function peekBody(s, n = 160) {
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

async function withRetry(doReq, { retries = DEFAULT_RETRIES, baseDelay = 300 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await doReq(attempt);
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

/* ───────────────────────────── URL & JSON helpers ─────────────────────────── */

function buildUrl(paramsObj) {
  if (!EXEC_BASE) throw new Error('Geen Exec-URL geconfigureerd. Stel deze in via Instellingen.');
  const url = new URL(EXEC_BASE);
  if (paramsObj) {
    Object.entries(paramsObj).forEach(([k, v]) => {
      if (v != null && v !== '') url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

async function getJSON(paramsObj, { timeout = DEFAULT_TIMEOUT, signal } = {}) {
  return withRetry(async () => {
    const url = buildUrl(paramsObj);
    const res = await fetchWithTimeout(url, { method: 'GET', signal }, timeout);
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

async function postJSON(body, paramsObj, { timeout = DEFAULT_TIMEOUT, signal } = {}) {
  // text/plain → GAS leest e.postData.contents; geen CORS preflight
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body || {});
  return withRetry(async () => {
    const url = buildUrl(paramsObj);
    const res = await fetchWithTimeout(
      url,
      { method: 'POST', headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: bodyText, signal },
      timeout
    );
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

/* ───────────────────────────── Netwerk test ──────────────────────────────── */

/** Ping rechtstreeks naar /exec?mode=ping; geeft true/false terug */
export async function pingExec() {
  try {
    await initFromConfig();
    if (!EXEC_BASE) return false;
    const url = buildUrl({ mode: 'ping', t: Date.now() });
    const r = await fetchWithTimeout(url, { method: 'GET' }, 6_000);
    return r.ok;
  } catch {
    return false;
  }
}

/* ───────────────────────────── Publieke helpers ───────────────────────────── */

/** Normaliseer statusvelden (bv. "Actief" → "actief") */
export function normStatus(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}

/** Lees een sheet-tab via legacy `mode=`: klanten|honden|klassen|lessen|reeksen|all|diag */
export async function fetchSheet(tabName, opts = {}) {
  const mode = String(tabName || '').toLowerCase();
  if (!mode) throw new Error('tabName vereist');
  const json = await getJSON({ mode }, opts);
  // accepteer zowel {ok:true,data:[…]} als direct array
  return Array.isArray(json) ? json : (json?.data || []);
}

/** Moderne GET actions uit GAS (indien aanwezig), bv. action=getLessen */
export async function fetchAction(action, params = {}, opts = {}) {
  const a = String(action || '').trim();
  if (!a) throw new Error('action vereist');
  const json = await getJSON({ action: a, ...params }, opts);
  return Array.isArray(json) ? json : (json?.data || []);
}

/** Moderne POST actions (algemene router): { entity, action, payload } */
export async function postAction(entity, action, payload = {}, opts = {}) {
  const e = String(entity || '').trim().toLowerCase();
  const a = String(action || '').trim().toLowerCase();
  if (!e || !a) throw new Error('entity en action vereist');
  const json = await postJSON({ entity: e, action: a, payload }, undefined, opts);
  return json?.data || {};
}

/* Convenience: directe save-calls die mappen op doPost(mode=...) in main.gs */
export const saveKlant = (data, opts) => postJSON(data, { mode: 'saveKlant' }, opts).then(j => j.data || {});
export const saveHond  = (data, opts) => postJSON(data, { mode: 'saveHond'  }, opts).then(j => j.data || {});
export const saveKlas  = (data, opts) => postJSON(data, { mode: 'saveKlas'  }, opts).then(j => j.data || {});
export const saveLes   = (data, opts) => postJSON(data, { mode: 'saveLes'   }, opts).then(j => j.data || {});

/* ───────────────────────────── Auto-init ───────────────────────────── */
(async function autoInit() {
  try { await initFromConfig(); } catch {}
})();
