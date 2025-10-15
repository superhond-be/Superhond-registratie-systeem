/**
 * public/js/sheets.js — Centrale API (v0.27.2)
 * - Leest GAS base via <meta name="superhond-exec"> of localStorage
 * - GET: fetchSheet / fetchAction
 * - POST: postAction; saveKlant/Hond/Klas/Les (compat)
 */

const DEFAULT_TIMEOUT = 15000;
const DEFAULT_RETRIES = 2;
const LS_BASE = 'superhond:execBase';

let GAS_BASE_URL = '';

function metaBase() {
  const m = document.querySelector('meta[name="superhond-exec"]');
  return (m?.content || '').trim();
}
export function setBaseUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== 'script.google.com') throw 0;
    if (!u.pathname.endsWith('/exec')) throw 0;
    GAS_BASE_URL = `${u.origin}${u.pathname}`;
    localStorage.setItem(LS_BASE, GAS_BASE_URL);
  } catch { GAS_BASE_URL = ''; localStorage.removeItem(LS_BASE); }
}
export function getBaseUrl() { return GAS_BASE_URL; }

export async function initFromConfig() {
  if (!GAS_BASE_URL) {
    const m = metaBase(); if (m) setBaseUrl(m);
  }
  if (!GAS_BASE_URL) {
    const ls = localStorage.getItem(LS_BASE); if (ls) setBaseUrl(ls);
  }
}

const peek = (s,n=180)=>String(s||'').trim().replace(/\s+/g,' ').slice(0,n);
async function fetchWithTimeout(url, init={}, ms=DEFAULT_TIMEOUT){
  const ac=new AbortController(); const t=setTimeout(()=>ac.abort(new Error('timeout')),ms);
  try{ return await fetch(url,{...init,signal:ac.signal,cache:'no-store'}); } finally { clearTimeout(t); }
}

async function getJSON(params, {timeout=DEFAULT_TIMEOUT, retries=DEFAULT_RETRIES}={}) {
  let lastErr;
  for (let i=0;i<=retries;i++){
    try{
      if(!GAS_BASE_URL) throw new Error('Geen exec-URL');
      const u = new URL(GAS_BASE_URL); Object.entries(params||{}).forEach(([k,v])=>{ if(v!=null&&v!=='') u.searchParams.set(k,String(v)); });
      const r = await fetchWithTimeout(u.toString(), {}, timeout);
      const txt = await r.text();
      let j; try{ j=JSON.parse(txt); }catch{ throw new Error(`Geen geldige JSON (status ${r.status}): ${peek(txt)}`); }
      if(!r.ok || j?.ok===false) throw new Error(j?.error || `Upstream ${r.status}`);
      return j;
    }catch(e){ lastErr=e; if(i<retries) await new Promise(r=>setTimeout(r,300*(2**i))); }
  }
  throw lastErr;
}
async function postJSON(body, params, {timeout=DEFAULT_TIMEOUT, retries=DEFAULT_RETRIES}={}) {
  const bodyText = typeof body==='string' ? body : JSON.stringify(body||{});
  let lastErr;
  for (let i=0;i<=retries;i++){
    try{
      if(!GAS_BASE_URL) throw new Error('Geen exec-URL');
      const u = new URL(GAS_BASE_URL); Object.entries(params||{}).forEach(([k,v])=>{ if(v!=null&&v!=='') u.searchParams.set(k,String(v)); });
      const r = await fetchWithTimeout(u.toString(), { method:'POST', headers:{'Content-Type':'text/plain; charset=utf-8'}, body: bodyText }, timeout);
      const txt = await r.text();
      let j; try{ j=JSON.parse(txt); }catch{ throw new Error(`Geen geldige JSON (status ${r.status}): ${peek(txt)}`); }
      if(!r.ok || j?.ok===false) throw new Error(j?.error || `Upstream ${r.status}`);
      return j;
    }catch(e){ lastErr=e; if(i<retries) await new Promise(r=>setTimeout(r,300*(2**i))); }
  }
  throw lastErr;
}

export async function fetchSheet(tab) {
  if (!tab) throw new Error('tabName vereist');
  const j = await getJSON({ mode: String(tab).toLowerCase() });
  return j?.data || [];
}
export async function fetchAction(action, params={}) {
  if (!action) throw new Error('action vereist');
  const j = await getJSON({ action, ...params });
  return j?.data || [];
}
export async function postAction(entity, action, payload={}) {
  const e = String(entity||'').toLowerCase(); const a = String(action||'').toLowerCase();
  if (!e || !a) throw new Error('entity en action vereist');
  const j = await postJSON({ entity:e, action:a, payload }, {});
  return j?.data || {};
}

// compat helpers (legacy doPost mode=...)
export const saveKlant = (data)=> postJSON(data,{mode:'saveKlant'}).then(j=>j.data||{});
export const saveHond  = (data)=> postJSON(data,{mode:'saveHond' }).then(j=>j.data||{});
export const saveKlas  = (data)=> postJSON(data,{mode:'saveKlas' }).then(j=>j.data||{});
export const saveLes   = (data)=> postJSON(data,{mode:'saveLes'  }).then(j=>j.data||{});

// autoinit
(async()=>{ try{ await initFromConfig(); }catch{} })();
