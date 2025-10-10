/**
 * public/js/sheets.js — proxy-first + GAS fallback + nette netstatus (v0.26.4-net)
 * Exports:
 *   initFromConfig, fetchSheet, fetchAction, postAction,
 *   saveKlant, saveHond, saveKlas, saveLes,
 *   currentApiBase
 */

const PROXY = '/api/sheets';
const CFG_EP = '/api/config';
const LS_KEY = 'superhond:apiBase';

let apiBase = '';   // e.g. https://script.google.com/macros/s/.../exec

// ───────────────────────── Netstatus helpers ─────────────────────────
const UI = globalThis.SuperhondUI || {};
const netOK   = (...a) => { try{ UI.noteSuccess?.(...a); }catch{} };
const netFAIL = (...a) => { try{ UI.noteFailure?.(...a); }catch{} };

// onderscheid netwerk vs. functionele fout
function isNetError(err){
  return err?.name === 'AbortError' ||
         err?.message === 'timeout'  ||
         (err instanceof TypeError);
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
  if (obj && obj.ok === true && Array.isArray(obj.data)) return obj.data;
  if (obj && Array.isArray(obj.data)) return obj.data;
  if (obj && Array.isArray(obj.rows)) return obj.rows;
  if (obj && Array.isArray(obj.result)) return obj.result;
  throw new Error('Server gaf onverwachte respons');
}

function withTimeout(p, ms=15000, signal){
  if (!ms) return p;
  return Promise.race([
    p,
    new Promise((_,rej)=>{
      const t = setTimeout(()=>{ const e=new Error('timeout'); e.name='AbortError'; rej(e); }, ms);
      signal?.addEventListener?.('abort', ()=>{ clearTimeout(t); rej(Object.assign(new Error('AbortError'),{name:'AbortError'})); });
    })
  ]);
}

// ───────────────────────── Init ─────────────────────────
export async function initFromConfig(){
  // 1) query override (alleen lokaal; overschrijft niet serverconfig)
  try{
    const q = new URLSearchParams(location.search);
    const qBase = q.get('apiBase');
    if (qBase) localStorage.setItem(LS_KEY, qBase);
  }catch{}

  // 2) /api/config (primair)
  try{
    const r = await fetch(CFG_EP, { cache:'no-store' });
    if (r.ok) {
      const cfg = await r.json().catch(()=> ({}));
      if (cfg?.apiBase) apiBase = cfg.apiBase;
      netOK('config');
    } else {
      // server bereikbaar ⇒ functionele fout, maar online
      netOK('config-http');
    }
  }catch(e){
    // netwerkprobleem naar node-server
    netFAIL(e);
  }

  // 3) localStorage fallback
  if (!apiBase) {
    try {
      const ls = localStorage.getItem(LS_KEY);
      if (ls) apiBase = ls;
    } catch {}
  }

  // 4) snelle online check: proxy OF GAS
  try{
    const rp = await fetch(`${PROXY}?action=ping`, { cache:'no-store' });
    rp.ok ? netOK('proxy') : netOK('proxy-http');
    if (rp.ok) return;
  }catch{}
  if (apiBase) {
    try{
      const rg = await fetch(`${apiBase}?action=ping`, { cache:'no-store' });
      rg.ok ? netOK('gas') : netOK('gas-http');
      return;
    }catch(e){ netFAIL(e); }
  }
}

// ───────────────────────── Low-level calls ─────────────────────────
async function callProxy(path, { method='GET', body, timeout=15000, signal }={}){
  const url = `${PROXY}${path}`;
  const init = { method, cache:'no-store', signal };
  if (body != null) {
    init.headers = { 'Content-Type':'text/plain' };
    init.body = (typeof body === 'string') ? body : JSON.stringify(body);
  }
  try{
    const r = await withTimeout(fetch(url, init), timeout, signal);
    if (!r.ok) { netOK('proxy-http'); const data = await r.text(); throw new Error(`Proxy ${r.status}: ${data.slice(0,140)}`); }
    netOK('proxy');
    return toJSON(r);
  }catch(e){ isNetError(e) ? netFAIL(e) : netOK('proxy-http'); throw e; }
}

async function callGAS(params, { method='GET', body, timeout=15000, signal }={}){
  if (!apiBase) throw new Error('Geen apiBase ingesteld. Ga naar Instellingen en vul de GAS /exec URL in.');
  const url = method === 'GET' ? `${apiBase}?${params}` : apiBase;

  const init = { method, cache:'no-store', signal };
  if (body != null) {
    init.headers = { 'Content-Type':'text/plain' };
    init.body = (typeof body === 'string') ? body : JSON.stringify(body);
  }
  try{
    const r = await withTimeout(fetch(url, init), timeout, signal);
    if (!r.ok) { netOK('gas-http'); const data = await r.text(); throw new Error(`GAS ${r.status}: ${data.slice(0,140)}`); }
    netOK('gas');
    return toJSON(r);
  }catch(e){ isNetError(e) ? netFAIL(e) : netOK('gas-http'); throw e; }
}

// ───────────────────────── Fetch helpers ─────────────────────────
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

// ───────────────────────── Post helpers ─────────────────────────
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

// ───────────────────────── Convenience saves ─────────────────────────
export const saveKlant = (k, opt) => postAction('klant','add',k,opt);
export const saveHond  = (h, opt) => postAction('hond','add',h,opt);
export const saveKlas  = (k, opt) => postAction('klas','add',k,opt);
export const saveLes   = (l, opt) => postAction('les','add',l,opt);

// ───────────────────────── Utils ─────────────────────────
export function currentApiBase() {
  try { return apiBase || localStorage.getItem(LS_KEY) || ''; }
  catch { return apiBase || ''; }
}
