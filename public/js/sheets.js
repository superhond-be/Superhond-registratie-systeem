/**
 * public/js/sheets.js — Centrale API zonder server-proxy (v0.27.3)
 * - Leest/zet EXEC uit meta + localStorage (sleutels: superhond:exec én superhond:apiBase)
 * - GET: fetchSheet/tab of fetchAction(action)
 * - POST: postAction(entity, action, payload)
 * - Convenience saveKlant/saveHond/saveKlas (legacy mode=...)
 */

const DEFAULT_TIMEOUT = 15000;
const DEFAULT_RETRIES = 2;

const LS_KEYS = ['superhond:exec', 'superhond:apiBase']; // compat
let GAS_BASE_URL = ''; // eindigt op /exec

function sanitizeExecUrl(url = '') {
  try {
    const u = new URL(String(url).trim());
    if (u.hostname === 'script.google.com' &&
        u.pathname.startsWith('/macros/s/') &&
        u.pathname.endsWith('/exec')) {
      return `${u.origin}${u.pathname}`;
    }
  } catch {}
  return '';
}

export function setBaseUrl(url) {
  const safe = sanitizeExecUrl(url);
  GAS_BASE_URL = safe;
  try {
    for (const k of LS_KEYS) {
      if (safe) localStorage.setItem(k, safe);
      else localStorage.removeItem(k);
    }
  } catch {}
}
export function getBaseUrl() { return GAS_BASE_URL; }

export async function initFromConfig() {
  // 1) meta
  if (!GAS_BASE_URL) {
    const m = document.querySelector('meta[name="superhond-exec"]')?.content?.trim();
    if (m) setBaseUrl(m.endsWith('/exec') ? m : (m.replace(/\/+$/, '') + '/exec'));
  }
  // 2) localStorage (beide sleutels)
  if (!GAS_BASE_URL) {
    for (const k of LS_KEYS) {
      const v = localStorage.getItem(k);
      if (v) { setBaseUrl(v); break; }
    }
  }
  // 3) window override
  if (!GAS_BASE_URL && window.SUPERHOND_SHEETS_URL) setBaseUrl(window.SUPERHOND_SHEETS_URL);
}

/* ───────── fetch utils ───────── */
function peekBody(s, n = 200) {
  return String(s || '').trim().replace(/\s+/g, ' ').slice(0, n);
}
async function fetchWithTimeout(url, init = {}, timeoutMs = DEFAULT_TIMEOUT) {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(new Error('timeout')), timeoutMs);
  try {
    return await fetch(url, { ...init, cache: 'no-store', signal: ac.signal });
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
      const timeout = err?.name === 'AbortError' || /timeout/i.test(String(err?.message||''));
      const transient = timeout || /NetworkError|ECONNRESET|ENOTFOUND|Failed to fetch/i.test(String(err));
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

/* ───────── kern GET/POST ───────── */
function buildUrl(paramsObj = {}) {
  if (!GAS_BASE_URL) throw new Error('Geen EXEC URL ingesteld');
  const u = new URL(GAS_BASE_URL);
  Object.entries(paramsObj).forEach(([k,v]) => { if (v != null && v !== '') u.searchParams.set(k, String(v)); });
  return u.toString();
}

async function getJSON(paramsObj, { timeout = DEFAULT_TIMEOUT } = {}) {
  return withRetry(async () => {
    const res  = await fetchWithTimeout(buildUrl(paramsObj), { method:'GET' }, timeout);
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { throw new Error(`Geen geldige JSON (${res.status}): ${peekBody(text)}`); }
    if (!res.ok || json?.ok === false) {
      const err = json?.error || `Upstream ${res.status}`;
      throw new Error(`${err}: ${peekBody(text)}`);
    }
    return json;
  });
}

async function postJSON(body, paramsObj, { timeout = DEFAULT_TIMEOUT } = {}) {
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body || {});
  return withRetry(async () => {
    const res  = await fetchWithTimeout(buildUrl(paramsObj), {
      method:'POST', headers:{ 'Content-Type':'text/plain; charset=utf-8' }, body: bodyText
    }, timeout);
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { throw new Error(`Geen geldige JSON (${res.status}): ${peekBody(text)}`); }
    if (!res.ok || json?.ok === false) {
      const err = json?.error || `Upstream ${res.status}`;
      throw new Error(`${err}: ${peekBody(text)}`);
    }
    return json;
  });
}

/* ───────── publieke helpers ───────── */
export function normStatus(s){ return String(s == null ? '' : s).trim().toLowerCase(); }

/** Legacy tab-lezen via mode= */
export async function fetchSheet(tabName, opts = {}) {
  const mode = String(tabName || '').trim();
  if (!mode) throw new Error('tabName vereist');
  await initFromConfig();
  const json = await getJSON({ mode }, opts);
  return json?.data || [];
}

/** Moderne GET action: ?action=getKlanten etc. */
export async function fetchAction(action, params = {}, opts = {}) {
  const a = String(action || '').trim();
  if (!a) throw new Error('action vereist');
  await initFromConfig();
  const json = await getJSON({ action: a, ...params }, opts);
  return json?.data || [];
}

/** POST action router */
export async function postAction(entity, action, payload = {}, opts = {}) {
  const e = String(entity || '').trim().toLowerCase();
  const a = String(action || '').trim().toLowerCase();
  if (!e || !a) throw new Error('entity en action vereist');
  await initFromConfig();
  const json = await postJSON({ entity: e, action: a, payload }, {}, opts);
  return json?.data || {};
}

/* Convenience legacy calls (doPost(mode=...)) */
export const saveKlant = (data, opts) => postJSON(data, { mode:'saveKlant' }, opts).then(j => j.data || {});
export const saveHond  = (data, opts) => postJSON(data, { mode:'saveHond'  }, opts).then(j => j.data || {});
export const saveKlas  = (data, opts) => postJSON(data, { mode:'saveKlas'  }, opts).then(j => j.data || {});
export const saveLes   = (data, opts) => postJSON(data, { mode:'saveLes'   }, opts).then(j => j.data || {});

/* Auto-init best effort */
(async () => { try { await initFromConfig(); } catch {} })();
