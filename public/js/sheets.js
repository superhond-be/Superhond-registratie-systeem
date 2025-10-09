/**
 * public/js/sheets.js — robust proxy + GAS fallback (v0.26.3)
 * Exports:
 *   initFromConfig, fetchSheet, fetchAction, postAction,
 *   saveKlant, saveHond, saveKlas, saveLes,
 *   currentApiBase   ← nieuw
 */

const PROXY = '/api/sheets';
const CFG_EP = '/api/config';
const LS_KEY = 'superhond:apiBase';

let apiBase = '';   // e.g. https://script.google.com/macros/s/.../exec
let lastOnline = null;

const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));

function setOnline(on){
  if (lastOnline === on) return;
  lastOnline = on;
  try { window.SuperhondUI?.setOnline?.(!!on); } catch {}
}

function toJSON(r){
  return r.text().then(t=>{
    try { return JSON.parse(t); }
    catch(e){ throw new Error(`Geen geldige JSON (status ${r.status}): ${t.slice(0,140)}`); }
  });
}

function okData(obj){
  // accepteer {ok:true,data:[..]} of direct een array
  if (Array.isArray(obj)) return obj;
  if (obj && obj.ok === true) return obj.data;
  if (obj && Array.isArray(obj.data)) return obj.data;
  throw new Error('Server gaf onverwachte respons');
}

function withTimeout(p, ms=15000, signal){
  if (!ms) return p;
  return Promise.race([
    p,
    new Promise((_,rej)=>{
      const t = setTimeout(()=>{ rej(new Error(`Timeout na ${ms}ms`)); }, ms);
      signal?.addEventListener?.('abort', ()=>{
        clearTimeout(t);
        const err = new Error('AbortError');
        err.name = 'AbortError';
        rej(err);
      });
    })
  ]);
}

/* --------------------------------- Init --------------------------------- */
export async function initFromConfig(){
  // 1) query override
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

  // test online-status: proxy OF direct GAS
  try{
    // eerst proxy
    const rp = await fetch(`${PROXY}?action=ping`, { cache:'no-store' });
    if (rp.ok) { setOnline(true); return; }
  }catch{}
  if (apiBase) {
    try{
      const rg = await fetch(`${apiBase}?action=ping`, { cache:'no-store' });
      setOnline(rg.ok);
      return;
    }catch{}
  }
  setOnline(false);
}

/* ------------------------------ Low-level calls ------------------------------ */
async function callProxy(path, { method='GET', body, timeout=15000, signal }={}){
  const url = `${PROXY}${path}`;
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
    ? `${apiBase}?${params}`
    : apiBase;

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
  // Probeer moderne "action" via proxy, dan direct GAS; val desnoods terug op legacy "mode"
  try {
    const obj = await callProxy(`?action=${encodeURIComponent(action)}${qs?`&${qs}`:''}`, { timeout, signal });
    return okData(obj);
  } catch (e1) {
    // direct GAS action
    try {
      const obj = await callGAS(`action=${encodeURIComponent(action)}${qs?`&${qs}`:''}`, { timeout, signal });
      return okData(obj);
    } catch (e2) {
      // legacy mode naam mapping (alleen waar logisch)
      const map = { getLeden:'klanten', getHonden:'honden', getKlassen:'klassen', getLessen:'lessen' };
      const legacy = map[action];
      if (!legacy) throw e1;
      const obj = await callGAS(`mode=${legacy}`, { timeout, signal });
      return okData(obj);
    }
  }
}

export async function fetchSheet(tab, { timeout=15000, signal }={}){
  // Eerst via action=getSheet&tab=...
  try {
    const obj = await callProxy(`?action=getSheet&tab=${encodeURIComponent(tab)}`, { timeout, signal });
    return okData(obj);
  } catch (e1) {
    try {
      const obj = await callGAS(`action=getSheet&tab=${encodeURIComponent(tab)}`, { timeout, signal });
      return okData(obj);
    } catch (e2) {
      // Legacy: specifieke modes
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
  // 1) proxy
  try {
    const obj = await callProxy('', { method:'POST', body, timeout, signal });
    if (obj?.ok === false) throw new Error(obj.error || 'Serverfout');
    return obj.data ?? obj;
  } catch (e1) {
    // 2) direct GAS JSON
    try {
      const obj = await callGAS('', { method:'POST', body, timeout, signal });
      if (obj?.ok === false) throw new Error(obj.error || 'Serverfout');
      return obj.data ?? obj;
    } catch (e2) {
      // 3) legacy per-entity mode
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

/* -------------------------- Nieuw: apiBase uitlezen -------------------------- */
export function currentApiBase() {
  try {
    return apiBase || localStorage.getItem(LS_KEY) || '';
  } catch {
    return apiBase || '';
  }
}
