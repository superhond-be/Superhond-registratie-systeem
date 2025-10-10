/**
 * public/js/sheets.js — robust proxy + GAS fallback (v0.26.4)
 * Exports:
 *   initFromConfig, fetchSheet, fetchAction, postAction,
 *   saveKlant, saveHond, saveKlas, saveLes,
 *   currentApiBase, setApiBase, ping
 */

const PROXY  = '/api/sheets';
const CFG_EP = '/api/config';
const LS_KEY = 'superhond:apiBase';

let apiBase = '';     // bv. https://script.google.com/macros/s/.../exec
let lastOnline = null;

/* ─────────────────────────── UI status helpers ─────────────────────────── */
function note(ok, detail){
  try {
    if (ok) {
      lastOnline !== true && (lastOnline = true);
      globalThis.SuperhondUI?.noteSuccess?.(detail);
    } else {
      lastOnline !== false && (lastOnline = false);
      globalThis.SuperhondUI?.noteFailure?.(detail);
    }
  } catch {}
}

/* ─────────────────────────── util helpers ─────────────────────────── */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function toJSON(res){
  return res.text().then(t=>{
    // probeer JSON; zo niet → nette fout met snippet
    try { return JSON.parse(t); }
    catch(e){
      const snippet = t.replace(/\s+/g,' ').slice(0,160);
      throw new Error(`Geen geldige JSON (status ${res.status}). Body: ${snippet}`);
    }
  });
}

function okData(obj){
  // accepteer array of { ok:true, data:[…] } of { data:[…] }
  if (Array.isArray(obj)) return obj;
  if (obj && obj.ok === true && Array.isArray(obj.data)) return obj.data;
  if (obj && Array.isArray(obj.data)) return obj.data;
  if (obj && Array.isArray(obj.rows)) return obj.rows;
  if (obj && Array.isArray(obj.result)) return obj.result;
  throw new Error('Server gaf onverwachte responsvorm (geen lijst).');
}

function withTimeout(promise, ms=15000, signal){
  if (!ms) return promise;
  return Promise.race([
    promise,
    new Promise((_,rej)=>{
      const t = setTimeout(()=>{ const e = new Error(`Timeout na ${ms}ms`); e.name='AbortError'; rej(e); }, ms);
      signal?.addEventListener?.('abort', ()=>{ clearTimeout(t); const e=new Error('AbortError'); e.name='AbortError'; rej(e); }, { once:true });
    })
  ]);
}

/* ─────────────────────────── apiBase beheer ─────────────────────────── */
export function currentApiBase(){
  try { return apiBase || localStorage.getItem(LS_KEY) || ''; }
  catch { return apiBase || ''; }
}
export function setApiBase(url){
  apiBase = String(url || '').trim();
  try { localStorage.setItem(LS_KEY, apiBase); } catch {}
  return apiBase;
}

/** Publieke ping helper (handig voor Instellingen) */
export async function ping(base = currentApiBase(), { timeout=6000 } = {}){
  if (!base) throw new Error('apiBase ontbreekt');
  const u = new URL(base);
  u.searchParams.set('action','ping');
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(new Error('timeout')), timeout);
  try{
    const r = await fetch(u.toString(), { mode:'cors', signal: ctrl.signal });
    const body = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${body.slice(0,120)}`);
    note(true, 'ping');
    return { status:r.status, body: body.slice(0,160) };
  } catch (e) {
    note(false, e);
    throw e;
  } finally { clearTimeout(t); }
}

/* ─────────────────────────── init ─────────────────────────── */
/**
 * Volgorde:
 * 0) query ?apiBase=…  → set & return
 * 1) /api/config       → gebruik cfg.apiBase
 * 2) localStorage      → fallback
 * Daarna korte online-check via proxy of GAS.
 */
export async function initFromConfig(){
  // 0) URL override (hoogste prioriteit)
  try {
    const u = new URL(location.href);
    const qBase = u.searchParams.get('apiBase');
    if (qBase) {
      setApiBase(qBase);
      note(true, 'apiBase:query');
      // bewust niet meteen return: we doen nog een korte ping-check hieronder
    }
  } catch {}

  // 1) /api/config (optioneel)
  if (!apiBase) {
    try{
      const r = await fetch(CFG_EP, { cache:'no-store' });
      const t = await r.text(); // handmatig parse → betere foutmelding
      if (r.ok) {
        try {
          const cfg = JSON.parse(t);
          if (cfg?.apiBase) setApiBase(cfg.apiBase);
          note(true, 'config');
        } catch {
          // config bestond maar was geen JSON
          note(false, 'config_json_error');
        }
      } else {
        // 404 op /api/config is ok; val terug op LS
      }
    }catch(e){
      // netwerk naar server stuk → noteFailure maar ga door
      note(false, e);
    }
  }

  // 2) localStorage fallback
  if (!apiBase) {
    try {
      const ls = localStorage.getItem(LS_KEY);
      if (ls) { setApiBase(ls); note(true,'localStorage'); }
    } catch {}
  }

  // Online-check: proxy eerst, dan GAS
  try {
    const rp = await fetch(`${PROXY}?action=ping`, { cache:'no-store' });
    if (rp.ok) { note(true, 'proxy_ok'); return; }
  } catch {}
  if (apiBase) {
    try {
      const rg = await fetch(`${apiBase}?action=ping`, { cache:'no-store', mode:'cors' });
      note(rg.ok, 'gas_ping');
      return;
    } catch(e) {
      note(false, e);
    }
  }
  // geen geldige apiBase beschikbaar
  if (!apiBase) throw new Error('Geen geldige apiBase. Zet deze in Instellingen of via ?apiBase=…');
}

/* ─────────────────────────── low-level calls ─────────────────────────── */
async function callProxy(path, { method='GET', body, timeout=15000, signal } = {}){
  const url = `${PROXY}${path}`;
  const init = { method, cache:'no-store', signal };
  if (body != null) {
    init.headers = { 'Content-Type':'application/json' };
    init.body = (typeof body === 'string') ? body : JSON.stringify(body);
  }
  try{
    const res = await withTimeout(fetch(url, init), timeout, signal);
    if (!res.ok) {
      note(true, 'http_proxy'); // server bereikbaar → online
      throw new Error(`Proxy ${res.status} ${res.statusText}`);
    }
    note(true, 'proxy_ok');
    return toJSON(res);
  } catch(e){
    // netwerk/timeout → offline
    note(false, e);
    throw e;
  }
}

async function callGAS(params, { method='GET', body, timeout=15000, signal } = {}){
  if (!apiBase) throw new Error('Geen apiBase ingesteld. Ga naar Instellingen en vul de GAS /exec URL in.');
  const url = method === 'GET' ? `${apiBase}?${params}` : apiBase;
  const init = { method, cache:'no-store', signal, mode:'cors' };
  if (body != null) {
    init.headers = { 'Content-Type':'application/json' };
    init.body = (typeof body === 'string') ? body : JSON.stringify(body);
  }
  try{
    const res = await withTimeout(fetch(url, init), timeout, signal);
    if (!res.ok) {
      note(true, 'http_gas'); // HTTP fout = online, functionele error
      const txt = await res.text();
      throw new Error(`GAS ${res.status}: ${txt.slice(0,140)}`);
    }
    note(true, 'gas_ok');
    return toJSON(res);
  } catch(e){
    note(false, e);
    throw e;
  }
}

/* ─────────────────────────── fetch helpers ─────────────────────────── */
export async function fetchAction(action, { timeout=15000, signal, qs='' } = {}){
  const qp = `action=${encodeURIComponent(action)}${qs?`&${qs}`:''}`;
  // 1) Proxy
  try {
    const obj = await callProxy(`?${qp}`, { timeout, signal });
    return okData(obj);
  } catch (e1) {
    // 2) GAS (zelfde action)
    try {
      const obj = await callGAS(qp, { timeout, signal });
      return okData(obj);
    } catch (e2) {
      // 3) Legacy mode
      const map = { getLeden:'klanten', getHonden:'honden', getKlassen:'klassen', getLessen:'lessen' };
      const legacy = map[action];
      if (!legacy) throw e1;
      const obj = await callGAS(`mode=${legacy}`, { timeout, signal });
      return okData(obj);
    }
  }
}

export async function fetchSheet(tab, { timeout=15000, signal } = {}){
  const qp = `action=getSheet&tab=${encodeURIComponent(tab)}`;
  // 1) Proxy
  try {
    const obj = await callProxy(`?${qp}`, { timeout, signal });
    return okData(obj);
  } catch (e1) {
    // 2) GAS
    try {
      const obj = await callGAS(qp, { timeout, signal });
      return okData(obj);
    } catch (e2) {
      // 3) Legacy per-tab
      const legacy = {
        'Klanten':'klanten', 'Leden':'klanten',
        'Honden':'honden', 'Lessen':'lessen', 'Klassen':'klassen', 'Reeksen':'reeksen'
      }[tab] || '';
      if (!legacy) throw e1;
      const obj = await callGAS(`mode=${legacy}`, { timeout, signal });
      return okData(obj);
    }
  }
}

/* ─────────────────────────── post helpers ─────────────────────────── */
export async function postAction(entity, action, payload, { timeout=15000, signal } = {}){
  const body = { entity, action, payload };
  // 1) Proxy
  try {
    const obj = await callProxy('', { method:'POST', body, timeout, signal });
    if (obj?.ok === false) throw new Error(obj.error || 'Serverfout (proxy)');
    return obj.data ?? obj;
  } catch (e1) {
    // 2) GAS
    try {
      const obj = await callGAS('', { method:'POST', body, timeout, signal });
      if (obj?.ok === false) throw new Error(obj.error || 'Serverfout (gas)');
      return obj.data ?? obj;
    } catch (e2) {
      // 3) Legacy fallback (alleen add/update)
      const modeMap = { klant:'saveKlant', hond:'saveHond', klas:'saveKlas', les:'saveLes' };
      if (!modeMap[entity] || (action !== 'add' && action !== 'update')) throw e1;
      const legacy = modeMap[entity];
      const r = await callGAS(`mode=${legacy}`, { method:'POST', body: JSON.stringify(payload||{}), timeout, signal });
      if (r?.ok === false) throw new Error(r.error || 'Serverfout (legacy)');
      return r.data ?? r;
    }
  }
}

/* ─────────────────────────── convenience save() helpers ─────────────────────────── */
export const saveKlant = (k, opt) => postAction('klant','add',k,opt);
export const saveHond  = (h, opt) => postAction('hond','add',h,opt);
export const saveKlas  = (k, opt) => postAction('klas','add',k,opt);
export const saveLes   = (l, opt) => postAction('les','add',l,opt);
