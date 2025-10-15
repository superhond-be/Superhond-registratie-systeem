/**
 * public/js/sheets.js — Centrale API-laag zonder /api-proxy (v0.27.3)
 * - Leest GAS /exec-basis uit:
 *   1) <meta name="superhond-exec" content="...">
 *   2) localStorage 'superhond:execBase'
 *   3) window.SUPERHOND_SHEETS_URL
 * - GET/POST rechtstreeks naar GAS (POST = text/plain; geen preflight)
 * - Timeouts, abort, nette fouten
 * - Publieke helpers: initFromConfig, fetchSheet, fetchAction, postAction
 * - Legacy saveX helpers voor doPost(mode=...)
 */

const DEFAULT_TIMEOUT = 20000; // 20s
const LS_EXEC_KEY     = 'superhond:execBase';

let EXEC_BASE = ''; // bv. https://script.google.com/macros/s/XXXXX/exec

/* ───────────────────── Base helpers ───────────────────── */
function sanitizeExecUrl(url = '') {
  try {
    const u = new URL(String(url).trim());
    // alleen Google Apps Script /exec toestaan
    if (u.hostname === 'script.google.com' &&
        u.pathname.startsWith('/macros/s/') &&
        u.pathname.endsWith('/exec')) {
      return `${u.origin}${u.pathname}`;
    }
  } catch {}
  return '';
}

function readMetaExec() {
  const m = document.querySelector('meta[name="superhond-exec"]');
  return (m?.content || '').trim();
}

function readExecFromLS() {
  try { return localStorage.getItem(LS_EXEC_KEY) || ''; }
  catch { return ''; }
}

function writeExecToLS(val) {
  try {
    if (val) localStorage.setItem(LS_EXEC_KEY, val);
    else localStorage.removeItem(LS_EXEC_KEY);
  } catch {}
}

/** Resolvet de /exec-basis uit meta → LS → window-var */
function resolveExecBase() {
  // 1) meta
  const m = sanitizeExecUrl(readMetaExec());
  if (m) return m;
  // 2) LS
  const l = sanitizeExecUrl(readExecFromLS());
  if (l) return l;
  // 3) window var
  const w = sanitizeExecUrl(window.SUPERHOND_SHEETS_URL || '');
  if (w) return w;
  return '';
}

/** Stelt (en persist) de exec-basis in; gebruik bij init. */
export function setBaseUrl(url) {
  EXEC_BASE = sanitizeExecUrl(url);
  writeExecToLS(EXEC_BASE);
}
export function getBaseUrl() { return EXEC_BASE; }

/** Te callen bij paginalaad (heet zo voor backwards compat). */
export async function initFromConfig() {
  if (!EXEC_BASE) {
    const r = resolveExecBase();
    if (r) setBaseUrl(r);
  }
}

/* ───────────────────── Fetch utils ───────────────────── */
function buildUrl(paramsObj) {
  if (!EXEC_BASE) throw new Error('GAS /exec URL is niet ingesteld.');
  const u = new URL(EXEC_BASE);
  Object.entries(paramsObj || {}).forEach(([k, v]) => {
    if (v != null && v !== '') u.searchParams.set(k, String(v));
  });
  // cache-buster
  u.searchParams.set('t', String(Date.now()));
  return u.toString();
}

function peekBody(s, n = 200) {
  return String(s || '').trim().replace(/\s+/g, ' ').slice(0, n);
}

async function fetchWithTimeout(url, init = {}, timeoutMs = DEFAULT_TIMEOUT) {
  const ac = new AbortController();
  const outerSignal = init.signal;
  const onAbort = () => ac.abort(new Error('timeout'));
  const timer = setTimeout(onAbort, timeoutMs);

  // combineer signals (simpel: als outer aborteert, abort onze ook)
  if (outerSignal) {
    if (outerSignal.aborted) ac.abort(outerSignal.reason);
    else outerSignal.addEventListener('abort', () => ac.abort(outerSignal.reason), { once:true });
  }

  try {
    const res = await fetch(url, { ...init, signal: ac.signal, cache: 'no-store' });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/* ───────────────────── Kern GET/POST ───────────────────── */
async function getJSON(paramsObj, { timeout = DEFAULT_TIMEOUT, signal } = {}) {
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
}

async function postJSON(body, paramsObj, { timeout = DEFAULT_TIMEOUT, signal } = {}) {
  const url = buildUrl(paramsObj);
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body || {});
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }, // geen preflight
    body: bodyText,
    signal
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
}

/* ───────────────────── Publieke helpers ───────────────────── */
export function normStatus(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}

/** Legacy tab-lezer: klanten|honden|klassen|lessen|reeksen|all|diag */
export async function fetchSheet(tabName, opts = {}) {
  const mode = String(tabName || '').trim().toLowerCase();
  if (!mode) throw new Error('tabName vereist');
  const json = await getJSON({ mode }, opts);
  return json?.data || [];
}

/** Moderne GET actions uit GAS: bv. action=getLeden */
export async function fetchAction(action, params = {}, opts = {}) {
  const a = String(action || '').trim();
  if (!a) throw new Error('action vereist');
  const json = await getJSON({ action: a, ...params }, opts);
  return json?.data || [];
}

/** Moderne POST actions: { entity, action, payload } */
export async function postAction(entity, action, payload = {}, opts = {}) {
  const e = String(entity || '').trim().toLowerCase();
  const a = String(action || '').trim().toLowerCase();
  if (!e || !a) throw new Error('entity en action vereist');
  const json = await postJSON({ entity: e, action: a, payload }, undefined, opts);
  return json?.data || {};
}

/* Convenience: legacy doPost(mode=...) in main.gs */
export const saveKlant = (data, opts) => postJSON(data, { mode: 'saveKlant' }, opts).then(j => j.data || {});
export const saveHond  = (data, opts) => postJSON(data, { mode: 'saveHond'  }, opts).then(j => j.data || {});
export const saveKlas  = (data, opts) => postJSON(data, { mode: 'saveKlas'  }, opts).then(j => j.data || {});
export const saveLes   = (data, opts) => postJSON(data, { mode: 'saveLes'   }, opts).then(j => j.data || {});

/* ───────────────────── Auto-init ───────────────────── */
(async function autoInit() {
  try { await initFromConfig(); } catch {}
})();
