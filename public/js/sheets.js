// /public/js/sheets.js  v0.26.3 — proxy-first + fallback GAS + striktere JSON + betere fallbacks
// Exports: initFromConfig, currentApiBase, setApiBase, fetchSheet, postAction, saveHond, diag

const UI = globalThis.SuperhondUI || { noteSuccess(){}, noteFailure(){} };
export const VERSION = '0.26.3';

let _apiBase = '';     // bv. https://script.google.com/macros/s/XXX/exec
let _config   = null;  // { apiBase, version, env }

export function currentApiBase(){ return _apiBase || ''; }
export function setApiBase(url){
  _apiBase = String(url || '').trim();
  try { localStorage.setItem('apiBase', _apiBase); } catch {}
}

// ───────────────────────── Helpers ─────────────────────────
function withTimeout(ms, signal){
  const timeoutCtrl = new AbortController();
  const t = setTimeout(()=> timeoutCtrl.abort(new Error('timeout')), ms);
  const combo = new AbortController();
  function abortFrom(src){ try { combo.abort(src?.reason || src); } catch {} }
  signal?.addEventListener('abort', ()=> abortFrom(signal), { once:true });
  timeoutCtrl.signal.addEventListener('abort', ()=> abortFrom(timeoutCtrl.signal), { once:true });
  return { signal: combo.signal, cancel(){ clearTimeout(t); } };
}

async function fetchText(url, opts={}){
  const res = await fetch(url, opts);
  const text = await res.text();
  return { res, text };
}
function safeParseJSON(text){
  try { return JSON.parse(text); } catch { return null; }
}
function isNetError(err){
  // TypeError from fetch, AbortError, or our timeout → netwerk
  return err?.name === 'AbortError' || err?.message === 'timeout' || (err instanceof TypeError);
}

// Status doorzetten:
// - netwerk/timeouts → noteFailure()
// - HTTP 4xx/5xx (server bereikbaar) → noteSuccess() (online, maar functionele fout)
function markStatusFromError(e){
  if (isNetError(e)) UI.noteFailure?.(e);
  else UI.noteSuccess?.('http-error');
}
function markOk(){ UI.noteSuccess?.('ok'); }

// ───────────────────────── Config ─────────────────────────
export async function initFromConfig(){
  // volgorde: /api/config → localStorage('apiBase') → noop
  try {
    const { res, text } = await fetchText('/api/config', { cache:'no-store' });
    const cfg = safeParseJSON(text);
    if (res.ok && cfg && typeof cfg === 'object') {
      _config = cfg;
      if (cfg.apiBase) setApiBase(cfg.apiBase);
      markOk();
      return _config;
    }
    // /api/config bestaat niet of is geen JSON → val door naar localStorage
  } catch (e) {
    markStatusFromError(e);
  }
  try {
    const ls = localStorage.getItem('apiBase');
    if (ls) { setApiBase(ls); markOk(); return { apiBase: _apiBase, source:'localStorage' }; }
  } catch {}
  throw new Error('Geen geldige apiBase gevonden. Zet /api/config of localStorage("apiBase").');
}

// ───────────────────────── Kern calls ─────────────────────────
// NB: voor sheet/diag paden verwachten we **JSON**. Anders fallback.
function ensureJsonOrThrow(text, res, label){
  const j = safeParseJSON(text);
  if (j === null) {
    const err = new Error(`${label || 'invalid_json'}`);
    err.status = res?.status;
    throw err;
  }
  return j;
}

// Probeer eerst de server-proxy: /api/sheets?action=…  (mag 404’en)
// Als 404/Not Found → val terug op GAS (apiBase).
async function proxyGet(params, { timeout=20000, signal } = {}){
  const u = new URL('/api/sheets', location.origin);
  Object.entries(params).forEach(([k,v]) => v!=null && u.searchParams.set(k, v));
  const { signal: sig, cancel } = withTimeout(timeout, signal);
  try {
    const { res, text } = await fetchText(u.toString(), { signal: sig, credentials: 'same-origin' });
    cancel();
    if (res.status === 404) throw new Error('proxy_not_found'); // dwing fallback
    if (!res.ok) {
      // server bereikbaar → online
      markOk();
      // Probeer error body te lezen als JSON
      const data = safeParseJSON(text);
      const msg = (data && (data.error || data.message)) || `Proxy fout ${res.status}`;
      const err = new Error(msg); err.status = res.status; throw err;
    }
    // OK → verwacht JSON
    const data = ensureJsonOrThrow(text, res, 'proxy_bad_payload'); // forceer fallback pad hogerop
    markOk();
    return data;
  } catch (e) {
    if (e.message === 'proxy_not_found' || e.message === 'proxy_bad_payload' || e.message === 'invalid_json') {
      // signaleer expliciete fallback
      throw e;
    }
    markStatusFromError(e);
    throw e;
  }
}

async function gasGet(params, { timeout=20000, signal } = {}){
  if (!_apiBase) throw new Error('apiBase ontbreekt');
  const u = new URL(_apiBase);
  Object.entries(params).forEach(([k,v]) => v!=null && u.searchParams.set(k, v));
  const { signal: sig, cancel } = withTimeout(timeout, signal);
  try {
    const { res, text } = await fetchText(u.toString(), { signal: sig, mode:'cors' });
    cancel();
    if (!res.ok) {
      markOk(); // HTTP → online
      const data = safeParseJSON(text);
      const msg = (data && (data.error || data.message)) || `GAS fout ${res.status}`;
      const err = new Error(msg); err.status = res.status; throw err;
    }
    // OK → verwacht JSON
    const data = ensureJsonOrThrow(text, res, 'gas_bad_payload');
    markOk();
    return data;
  } catch (e) {
    markStatusFromError(e);
    throw e;
  }
}

async function gasPost(body, { timeout=20000, signal } = {}){
  if (!_apiBase) throw new Error('apiBase ontbreekt');
  const { signal: sig, cancel } = withTimeout(timeout, signal);
  try {
    const res = await fetch(_apiBase, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(body),
      signal: sig,
      mode: 'cors'
    });
    const text = await res.text();
    cancel();
    if (!res.ok) {
      markOk();
      const data = safeParseJSON(text);
      const msg = (data && (data.error || data.message)) || `GAS fout ${res.status}`;
      const err = new Error(msg); err.status = res.status; throw err;
    }
    const data = ensureJsonOrThrow(text, res, 'gas_bad_payload');
    markOk();
    return data;
  } catch (e) {
    markStatusFromError(e);
    throw e;
  }
}

// ───────────────────────── Public API ─────────────────────────
/**
 * Haal rijen uit een tab.
 * @param {string} sheetName  - exact tabblad: 'Klanten' of 'Honden'
 * @param {object} opts       - { timeout, signal, range? }
 * Retourneert één van: array | {data:[]|rows:[]|result:[]}
 */
export async function fetchSheet(sheetName, opts = {}){
  if (!sheetName) throw new Error('sheetName ontbreekt');
  // 1) Proxy (mag 404 of bad payload → fallback)
  try {
    const data = await proxyGet({ action:'sheet', sheet: sheetName, range: opts.range }, opts);
    return data;
  } catch (e) {
    if (!['proxy_not_found','proxy_bad_payload','invalid_json'].includes(e.message)) {
      // andere proxy-fout (HTTP 5xx/4xx behalve 404): laat bubbelen (functionele fout)
      throw e;
    }
    // 2) Fallback GAS (GET action=sheet)
    const data = await gasGet({ action:'sheet', sheet: sheetName, range: opts.range }, opts);
    return data;
  }
}

/** Acties naar GAS/proxy (create/update/delete enz.) */
export async function postAction(entity, action, payload={}, opts={}){
  // 1) Probeer proxy als POST JSON
  try {
    const u = new URL('/api/sheets', location.origin);
    const res = await fetch(u.toString(), {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ entity, action, payload }),
      signal: opts.signal,
      credentials: 'same-origin'
    });
    const text = await res.text();
    if (res.status === 404) throw new Error('proxy_not_found');
    if (!res.ok) {
      markOk();
      const data = safeParseJSON(text);
      const msg = (data && (data.error || data.message)) || `Proxy fout ${res.status}`;
      const err = new Error(msg); err.status = res.status; throw err;
    }
    const data = ensureJsonOrThrow(text, res, 'proxy_bad_payload');
    markOk();
    return data;
  } catch (e) {
    // Fallback voorwaarden: proxy niet aanwezig, slechte payload, of netwerk/CORS/timeout
    if (e.message === 'proxy_not_found' || e.message === 'proxy_bad_payload' || isNetError(e)) {
      const data = await gasPost({ entity, action, payload }, opts);
      return data;
    }
    markStatusFromError(e);
    throw e;
  }
}

export async function saveHond(payload, opts={}){
  // verwacht { id } terug
  const res = await postAction('hond','create', payload, opts);
  return res;
}

// ───────────────────────── Diagnose ─────────────────────────
export async function diag(){
  const out = { ok:false, steps:[] };
  function push(step, data){ out.steps.push({ step, ...data }); }
  try {
    // 1) config
    try {
      const { res, text } = await fetchText('/api/config', { cache:'no-store' });
      push('api/config', { status: res.status, body: text.slice(0,200) });
      const j = safeParseJSON(text);
      if (res.ok && j?.apiBase) { setApiBase(j.apiBase); }
    } catch (e) { push('api/config', { error: String(e) }); }

    // 2) apiBase from localStorage (fallback)
    try {
      const ls = localStorage.getItem('apiBase') || '';
      push('localStorage.apiBase', { value: ls });
      if (!_apiBase && ls) setApiBase(ls);
    } catch (e) { push('localStorage', { error: String(e) }); }

    // 3) Proxy test
    try {
      const data = await proxyGet({ action:'ping' }, { timeout: 6000 });
      push('/api/sheets?action=ping', { ok:true, data });
    } catch (e) {
      push('/api/sheets?action=ping', { error: String(e) });
    }

    // 4) GAS test
    if (!_apiBase) throw new Error('apiBase ontbreekt');
    try {
      const data = await gasGet({ action:'ping' }, { timeout: 6000 });
      push('GAS ping', { ok:true, data });
    } catch (e) {
      push('GAS ping', { error: String(e) });
    }

    // 5) Klanten + Honden (alleen head/len)
    try {
      const klanten = await fetchSheet('Klanten', { timeout: 12000 });
      push('Sheet:Klanten', { type: typeof klanten, keys: Object.keys(klanten||{}).slice(0,5), length: guessLen(klanten) });
    } catch (e) {
      push('Sheet:Klanten', { error: String(e) });
    }
    try {
      const honden = await fetchSheet('Honden', { timeout: 12000 });
      push('Sheet:Honden', { type: typeof honden, keys: Object.keys(honden||{}).slice(0,5), length: guessLen(honden) });
    } catch (e) {
      push('Sheet:Honden', { error: String(e) });
    }

    out.ok = true;
  } catch (e) {
    out.ok = false;
    out.error = String(e);
  }
  console.table(out.steps.map(s => ({ step: s.step, status: s.status || (s.error?'ERR':'OK'), note: s.error || s.value || s.length || '' })));
  return out;
}

function guessLen(x){
  if (Array.isArray(x)) return x.length;
  if (x && Array.isArray(x.data)) return x.data.length;
  if (x && Array.isArray(x.rows)) return x.rows.length;
  if (x && Array.isArray(x.result)) return x.result.length;
  if (x && x?.data?.rows && Array.isArray(x.data.rows)) return x.data.rows.length;
  return -1;
}
