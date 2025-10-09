/**
 * public/js/sheets.js — robust proxy + GAS fallback (v0.26.4)
 * Exports:
 *   initFromConfig, fetchSheet, fetchAction, postAction,
 *   saveKlant, saveHond, saveKlas, saveLes, currentApiBase
 */

const PROXY  = '/api/sheets';
const CFG_EP = '/api/config';
const LS_KEY = 'superhond:apiBase';

let apiBase = '';   // e.g. https://script.google.com/macros/s/.../exec
let lastOnline = null;

const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));

export const currentApiBase = () => apiBase;

function setOnline(on){
  if (lastOnline === on) return;
  lastOnline = on;
  try { window.SuperhondUI?.setOnline?.(!!on); } catch {}
}

function toJSON(r){
  return r.text().then(t=>{
    if (!t || !t.trim()) {
      // lege body — behandel als fout met status
      throw new Error(`Lege respons (status ${r.status})`);
    }
    try { return JSON.parse(t); }
    catch(e){
      throw new Error(`Geen geldige JSON (status ${r.status}): ${t.slice(0,160)}`);
    }
  });
}

function okData(obj){
  // accepteer {ok:true,data:[..]}, direct array, of nested varianten
  if (Array.isArray(obj)) return obj;
  if (obj && obj.ok === true && Array.isArray(obj.data)) return obj.data;
  if (obj && Array.isArray(obj.data)) return obj.data;
  if (obj && Array.isArray(obj.rows)) return obj.rows;
  if (obj && obj.data && Array.isArray(obj.data.rows)) return obj.data.rows;
  throw new Error('Server gaf onverwachte respons');
}

function withTimeout(p, ms=15000, signal){
  if (!ms) return p;
  return new Promise((resolve, reject)=>{
    const t = setTimeout(()=> reject(new Error(`Timeout na ${ms}ms`)), ms);
    const clear = ()=> clearTimeout(t);

    if (signal?.aborted) { clear(); return reject(Object.assign(new Error('AbortError'),{name:'AbortError'})); }
    const onAbort = ()=>{ clear(); reject(Object.assign(new Error('AbortError'),{name:'AbortError'})); };
    signal?.addEventListener?.('abort', onAbort, { once:true });

    p.then(v=>{ clear(); resolve(v); }, e=>{ clear(); reject(e); });
  });
}

/* --------------------------------- Init --------------------------------- */
export async function initFromConfig(){
  // 1) query override (?apiBase=...)
  try{
    const q = new URLSearchParams(location.search);
    const qBase = q.get('apiBase');
    if (qBase) localStorage.setItem(LS_KEY, qBase);
  }catch{}

  // 2) /api/config (optioneel)
  try{
    const r = await fetch(CFG_EP, { cache:'no-store' });
    if (r.ok) {
      const cfg = await r.json().catch(()=> ({}));
      if (cfg?.apiBase) apiBase = cfg.apiBase;
    }
  }catch{}

  // 3) localStorage fallback
  if (!apiBase) {
    const ls = localStorage.getItem(LS_KEY);
    if (ls) apiBase = ls;
  }

  // Online check: proxy → GAS
  try{
    const rp = await fetch(`${PROXY}?action=ping&_=${Date.now()}`, { cache:'no-store' });
    if (rp.ok) { setOnline(true); return; }
  }catch(e){
    console.warn('[sheets] Proxy ping faalde:', e?.message || e);
  }
  if (apiBase) {
    try{
      const rg = await fetch(`${apiBase}?action=ping&_=${Date.now()}`, { cache:'no-store' });
      setOnline(rg.ok);
      return;
    }catch(e){
      console.warn('[sheets] GAS ping faalde:', e?.message || e);
    }
  }
  setOnline(false);
}

/* ------------------------------ Low-level calls ------------------------------ */
async function callProxy(path, { method='GET', body, timeout=15000, signal }={}){
  const url = `${PROXY}${path}${path.includes('?') ? '&' : '?'}_=${Date.now()}`;
  const init = { method, cache:'no-store', signal };
  if (body != null) {
    init.headers = { 'Content-Type':'text/plain' };
    init.body = (typeof body === 'string') ? body : JSON.stringify(body);
  }
  const r = await withTimeout(fetch(url, init), timeout, signal);
  if (!r.ok) throw new Error(`Proxy ${r.status} ${r.statusText}`);
  setOnline(true);
  return toJSON(r);
}

async function callGAS(params, { method='GET', body, timeout=15000, signal }={}){
  if (!apiBase) throw new Error('Geen apiBase ingesteld. Ga naar Instellingen en vul de GAS /exec URL in.');
  const url = method === 'GET'
    ? `${apiBase}?${params}&_=${Date.now()}`
    : `${apiBase}?_=${Date.now()}`;

  const init = { method, cache:'no-store', signal };
  if (body != null) {
    init.headers = { 'Content-Type':'text/plain' };
    init.body = (typeof body === 'string') ? body : JSON.stringify(body);
  }
  const r = await withTimeout(fetch(url, init), timeout, signal);
  if (!r.ok) throw new Error(`GAS ${r.status} ${r.statusText}`);
  setOnline(true);
  return toJSON(r);
}

/* ------------------------------- Fetch helpers ------------------------------- */
export async function fetchAction(action, { timeout=15000, signal, qs='' }={}){
  try {
    const obj = await callProxy(`?action=${encodeURIComponent(action)}${qs?`&${qs}`:''}`, { timeout, signal });
    return okData(obj);
  } catch (e1) {
    try {
      const obj = await callGAS(`action=${encodeURIComponent(action)}${qs?`&${qs}`:''}`, { timeout, signal });
      return okData(obj);
    } catch (e2) {
      const map = { getLeden:'klanten', getHonden:'honden', getKlassen:'klassen', getLessen:'lessen' };
      const legacy = map[action];
      if (!legacy) throw e1;
      const obj = await callGAS(`mode=${legacy}`, { timeout, signal });
      return okData(obj);
    }
  }
}

export async function fetchSheet(tab, { timeout=15000, signal }={}){
  try {
    const obj = await callProxy(`?action=getSheet&tab=${encodeURIComponent(tab)}`, { timeout, signal });
    return okData(obj);
  } catch (e1) {
    try {
      const obj = await callGAS(`action=getSheet&tab=${encodeURIComponent(tab)}`, { timeout, signal });
      return okData(obj);
    } catch (e2) {
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

/* ------------------------------- Post helpers ------------------------------- */
export async function postAction(entity, action, payload, { timeout=15000, signal }={}){
  const body = { entity, action, payload };
  try {
    const obj = await callProxy('', { method:'POST', body, timeout, signal });
    if (obj?.ok === false) throw new Error(obj.error || 'Serverfout');
    return obj.data ?? obj;
  } catch (e1) {
    try {
      const obj = await callGAS('', { method:'POST', body, timeout, signal });
      if (obj?.ok === false) throw new Error(obj.error || 'Serverfout');
      return obj.data ?? obj;
    } catch (e2) {
      const modeMap = { klant:'saveKlant', hond:'saveHond', klas:'saveKlas', les:'saveLes' };
      if (!modeMap[entity] || (action !== 'add' && action !== 'update')) throw e1;
      const legacy = modeMap[entity];
      const legacyBody = JSON.stringify(payload || {});
      const r = await callGAS(`mode=${legacy}`, { method:'POST', body: legacyBody, timeout, signal });
      if (r?.ok === false) throw new Error(r.error || 'Serverfout');
      return r.data ?? r;
    }
  }
}

/* -------------------------- Convenience save()-helpers -------------------------- */
export const saveKlant = (k, opt) => postAction('klant','add',k,opt);
export const saveHond  = (h, opt) => postAction('hond','add',h,opt);
export const saveKlas  = (k, opt) => postAction('klas','add',k,opt);
export const saveLes   = (l, opt) => postAction('les','add',l,opt);
// onderaan sheets.js
export function currentApiBase(){ return apiBase; }
