/**
 * public/js/sheets.js — Centrale API-laag voor Superhond (v0.27.5)
 * - Leest exec-URL uit meta-tag of localStorage
 * - Exporteert getExecBase, setExecBase, pingExec, initFromConfig
 *   en de fetch/post functies
 */

const DEFAULT_TIMEOUT = 12_000;
const DEFAULT_RETRIES = 2;
const LS_KEY_EXEC = 'superhond:execBase';

let EXEC_BASE = '';

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
  } catch (e) {
    // invalid URL
  }
  return '';
}

function resolveExecBase() {
  // 1) meta-tag
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="superhond-exec"]');
    if (meta?.content) {
      const safe = sanitizeExecUrl(meta.content);
      if (safe) return safe;
    }
  }
  // 2) localStorage
  try {
    const ls = localStorage.getItem(LS_KEY_EXEC);
    if (ls) {
      const safe = sanitizeExecUrl(ls);
      if (safe) return safe;
    }
  } catch (e) {
    // ignore
  }
  // fallback
  console.warn('[sheets] Geen geldige exec-URL gevonden (meta-tag of localStorage)');
  return '';
}

export function setExecBase(url) {
  const safe = sanitizeExecUrl(url);
  EXEC_BASE = safe;
  try {
    if (safe) localStorage.setItem(LS_KEY_EXEC, safe);
    else localStorage.removeItem(LS_KEY_EXEC);
  } catch (e) {
    // ignore
  }
}

export function getExecBase() {
  return EXEC_BASE || '';
}

export async function initFromConfig() {
  if (!EXEC_BASE) {
    const resolved = resolveExecBase();
    if (resolved) {
      setExecBase(resolved);
    }
  }
}

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
        const wait = baseDelay * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

function buildUrl(paramsObj) {
  if (!EXEC_BASE) throw new Error('Geen Exec-URL geconfigureerd. Voeg een <meta name="superhond-exec"> toe.');
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
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error(`Geen geldige JSON (status ${res.status}): ${peekBody(text)}`);
    }
    if (!res.ok || json?.ok === false) {
      const err = json?.error || `Upstream ${res.status}`;
      throw new Error(`${err}: ${peekBody(text)}`);
    }
    return json;
  });
}

async function postJSON(body, paramsObj, { timeout = DEFAULT_TIMEOUT, signal } = {}) {
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
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error(`Geen geldige JSON (status ${res.status}): ${peekBody(text)}`);
    }
    if (!res.ok || json?.ok === false) {
      const err = json?.error || `Upstream ${res.status}`;
      throw new Error(`${err}: ${peekBody(text)}`);
    }
    return json;
  });
}

export async function pingExec() {
  try {
    await initFromConfig();
    if (!EXEC_BASE) return false;
    const url = buildUrl({ mode: 'ping', t: Date.now() });
    const r = await fetchWithTimeout(url, { method: 'GET' }, 6000);
    return r.ok;
  } catch (e) {
    return false;
  }
}

export function normStatus(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}

export async function fetchSheet(tabName, opts = {}) {
  const mode = String(tabName || '').toLowerCase();
  if (!mode) throw new Error('tabName vereist');
  const json = await getJSON({ mode }, opts);
  return Array.isArray(json) ? json : (json?.data || []);
}

export async function fetchAction(action, params = {}, opts = {}) {
  const a = String(action || '').trim();
  if (!a) throw new Error('action vereist');
  const json = await getJSON({ action: a, ...params }, opts);
  return Array.isArray(json) ? json : (json?.data || []);
}

export async function postAction(entity, action, payload = {}, opts = {}) {
  const e = String(entity || '').trim().toLowerCase();
  const a = String(action || '').trim().toLowerCase();
  if (!e || !a) throw new Error('entity en action vereist');
  const json = await postJSON({ entity: e, action: a, payload }, undefined, opts);
  return json?.data || {};
}

export const saveKlant = (data, opts) =>
  postJSON(data, { mode: 'saveKlant' }, opts).then(j => j.data || {});
export const saveHond = (data, opts) =>
  postJSON(data, { mode: 'saveHond' }, opts).then(j => j.data || {});
export const saveKlas = (data, opts) =>
  postJSON(data, { mode: 'saveKlas' }, opts).then(j => j.data || {});
export const saveLes = (data, opts) =>
  postJSON(data, { mode: 'saveLes' }, opts).then(j => j.data || {});

/* ───────────────────────── Auto-init ───────────────────────── */
(async function autoInit() {
  try {
    await initFromConfig();
  } catch (e) {
    console.warn('[sheets] autoInit fout:', e);
  }
})();
