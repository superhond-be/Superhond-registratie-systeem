// public/js/sheets.js — v0.27.1 (diagnostics+timeouts)

const DEFAULT_TIMEOUT = 15_000;         // 15s (mag je verhogen)
const DEFAULT_RETRIES = 1;              // 1 retry (dus max 2 pogingen)
const LS_KEY_BASE     = 'superhond:apiBase';

let GAS_BASE_URL = '';

/* ── Base helpers ── */
function sanitizeExecUrl(url = '') {
  try {
    const u = new URL(String(url).trim());
    if (u.hostname === 'script.google.com' && u.pathname.startsWith('/macros/s/') && u.pathname.endsWith('/exec')) {
      return `${u.origin}${u.pathname}`;
    }
  } catch {}
  return '';
}
export function setBaseUrl(url) {
  const safe = sanitizeExecUrl(url);
  GAS_BASE_URL = safe;
  try { safe ? localStorage.setItem(LS_KEY_BASE, safe) : localStorage.removeItem(LS_KEY_BASE); } catch {}
}
export function getBaseUrl(){ return GAS_BASE_URL; }

export async function initFromConfig() {
  if (!GAS_BASE_URL && typeof window.SUPERHOND_SHEETS_URL === 'string') setBaseUrl(window.SUPERHOND_SHEETS_URL);
  if (!GAS_BASE_URL) { try { const ls = localStorage.getItem(LS_KEY_BASE); if (ls) setBaseUrl(ls); } catch {} }
}

/* ── Fetch utils ── */
function peek(s, n=160){ return String(s||'').replace(/\s+/g,' ').slice(0,n); }

async function fetchWithTimeout(url, init={}, timeoutMs=DEFAULT_TIMEOUT){
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(new Error('timeout')), timeoutMs);
  try { return await fetch(url, { ...init, signal: ac.signal, cache:'no-store' }); }
  finally { clearTimeout(to); }
}

async function withRetry(doRequest, {retries=DEFAULT_RETRIES, baseDelay=350}={}){
  let last;
  for (let a=0; a<=retries; a++){
    const t0 = performance.now();
    try {
      const out = await doRequest(a, t0);
      return out;
    } catch (err){
      last = err;
      const transient = err?.name === 'AbortError' || /timeout|Failed to fetch|NetworkError/i.test(String(err));
      if (a < retries && transient){
        const wait = baseDelay * Math.pow(2, a);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      break;
    }
  }
  throw last;
}

/* ── URL builder ── */
function buildUrl(params){
  if (!GAS_BASE_URL) throw new Error('GAS_BASE_URL ontbreekt (initFromConfig/setBaseUrl)');

  const u = new URL(GAS_BASE_URL);
  Object.entries(params||{}).forEach(([k,v]) => { if (v!=null && v!=='') u.searchParams.set(k, String(v)); });
  // cache-buster
  u.searchParams.set('t', Date.now().toString());
  return u.toString();
}

/* ── Kern GET/POST ── */
async function getJSON(params, {timeout=DEFAULT_TIMEOUT}={}){
  return withRetry(async () => {
    const url = buildUrl(params);
    const r = await fetchWithTimeout(url, {method:'GET'}, timeout);
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch { throw new Error(`Geen geldige JSON (HTTP ${r.status}): ${peek(text)}`); }
    if (!r.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${r.status}: ${peek(text)}`);
    return json;
  });
}
async function postJSON(body, params, {timeout=DEFAULT_TIMEOUT}={}){
  const payload = (typeof body === 'string') ? body : JSON.stringify(body||{});
  return withRetry(async () => {
    const url = buildUrl(params);
    const r = await fetchWithTimeout(url,
      { method:'POST', headers:{'Content-Type':'text/plain; charset=utf-8'}, body:payload },
      timeout
    );
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch { throw new Error(`Geen geldige JSON (HTTP ${r.status}): ${peek(text)}`); }
    if (!r.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${r.status}: ${peek(text)}`);
    return json;
  });
}

/* ── Publiek API ── */
export function normStatus(s){ return String(s ?? '').trim().toLowerCase(); }

/** Legacy tabs: klanten|honden|klassen|lessen|reeksen|all|diag */
export async function fetchSheet(tabName, {timeout}={}){
  const mode = String(tabName||'').toLowerCase();
  if (!mode) throw new Error('tabName vereist');
  const json = await getJSON({ mode }, { timeout });
  return json?.data || [];
}

/** Moderne GET action (als je die in GAS hebt) */
export async function fetchAction(action, params={}, {timeout}={}){
  const a = String(action||'').trim();
  if (!a) throw new Error('action vereist');
  const json = await getJSON({ action:a, ...params }, { timeout });
  return json?.data || [];
}

/** Moderne POST action */
export async function postAction(entity, action, payload={}, {timeout}={}){
  const e = String(entity||'').trim().toLowerCase();
  const a = String(action||'').trim().toLowerCase();
  if (!e || !a) throw new Error('entity en action vereist');
  const json = await postJSON({ entity:e, action:a, payload }, {}, { timeout });
  return json?.data || {};
}

/* Convenience savers (als je GAS doPost(mode=...) gebruikt) */
export const saveKlant = (data, opts) => postJSON(data, { mode:'saveKlant' }, opts).then(j => j.data || {});
export const saveHond  = (data, opts) => postJSON(data, { mode:'saveHond'  }, opts).then(j => j.data || {});

/* ── Diagnostiek (console) ── */
async function diagOnce(mode, timeout=12_000){
  const start = performance.now();
  try{
    const data = await fetchSheet(mode, {timeout});
    const ms = Math.round(performance.now() - start);
    console.log(`✅ ${mode}: ${data.length} rijen in ${ms}ms`);
    return { ok:true, mode, rows:data.length, ms };
  }catch(err){
    const ms = Math.round(performance.now() - start);
    console.warn(`❌ ${mode} faalde na ${ms}ms:`, err?.message || err);
    return { ok:false, mode, error:String(err), ms };
  }
}

window.SuperhondDiag = {
  setBaseUrl,
  getBaseUrl,
  async ping(){ try { await fetchSheet('diag', {timeout:5000}); return true; } catch { return false; } },
  async testAll(){
    console.log('— SuperhondDiag: start —');
    await initFromConfig();
    console.log('base:', getBaseUrl());
    const out = {
      klanten: await diagOnce('Klanten', 20_000),
      honden:  await diagOnce('Honden',  15_000),
    };
    console.log('— result —', out);
    return out;
  }
};
