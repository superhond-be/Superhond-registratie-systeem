// sheets.js — dunne client voor Google Apps Script web-app
// Gebruik:
//   setBaseUrl('https://script.google.com/macros/s/.../exec')
//   const klassen = await fetchSheet('Klassen');

let _BASE_URL =
  (typeof window !== 'undefined' && window.SUPERHOND_SHEETS_URL) || null;

let _CACHE_SECS = 60; // 60s cache

/* ============ Config ============ */
export function setBaseUrl(url) { _BASE_URL = (url || '').trim() || null; }
export function getBaseUrl()    { return _BASE_URL; }
export function setCacheSecs(s) { _CACHE_SECS = Math.max(0, Number(s) || 0); }

/* ============ Cache ============ */
const CK = (sheet) => `sh-cache:${_BASE_URL || 'no-base'}:${sheet}`;

export function clearCache(sheetName = null) {
  try {
    if (!sheetName) {
      // wis alle keys die met 'sh-cache:' starten
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('sh-cache:')) localStorage.removeItem(k);
      });
    } else {
      localStorage.removeItem(CK(sheetName));
    }
  } catch {} // stil falen (quota/private mode)
}

function _readCache(sheet) {
  if (!_CACHE_SECS) return null;
  try {
    const raw = localStorage.getItem(CK(sheet));
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (!at || (Date.now() - at) > _CACHE_SECS * 1000) return null;
    return data;
  } catch { return null; }
}

function _writeCache(sheet, data) {
  if (!_CACHE_SECS) return;
  try { localStorage.setItem(CK(sheet), JSON.stringify({ at: Date.now(), data })); } catch {}
}

/* ============ Normalisatie ============ */
// Converteer diverse JSON vormen naar array van objecten.
function toObjects(json) {
  if (!json) return [];

  // Apps Script standaard: { ok:true, items:[{...}] }
  if (Array.isArray(json.items)) return json.items;

  // Alternatieven
  if (Array.isArray(json.data))  return json.data;

  // { headers:[...], rows:[[...]] }
  if (Array.isArray(json.headers) && Array.isArray(json.rows)) {
    const H = json.headers.map(s => String(s ?? '').trim());
    return json.rows.map(row => {
      const o = {}; H.forEach((k,i)=> o[k] = row[i]); return o;
    });
  }

  // Fallback: array met eerste rij als headers
  const arr = Array.isArray(json) ? json
           : Array.isArray(json?.rows) ? json.rows
           : Array.isArray(json?.items) ? json.items
           : [];
  if (arr.length && Array.isArray(arr[0])) {
    const H = arr[0].map(s => String(s ?? '').trim());
    return arr.slice(1).map(row => {
      const o = {}; H.forEach((k,i)=> o[k] = row[i]); return o;
    });
  }

  return [];
}

// Status → 'actief' / 'inactief'
export function normStatus(s) {
  const v = String(s ?? '').trim().toLowerCase();
  if (['actief','active','aan','on','true','1','yes','y'].includes(v)) return 'actief';
  if (['inactief','inactive','uit','off','false','0','nee','n','niet actief'].includes(v)) return 'inactief';
  return 'actief';
}

/* ============ Fetch ============ */
async function fetchWithTimeout(url, ms = 12000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { cache: 'no-store', signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

/** Haal 1 tabblad op als array van objecten (koprij = velden). */
export async function fetchSheet(sheetName) {
  const base = _BASE_URL;
  if (!base) {
    throw new Error('Sheets base URL ontbreekt. Gebruik setBaseUrl(...) of zet window.SUPERHOND_SHEETS_URL.');
  }

  const cached = _readCache(sheetName);
  if (cached) return cached;

  const url = `${base}?sheet=${encodeURIComponent(sheetName)}&t=${Date.now()}`;
  let r;
  try {
    r = await fetchWithTimeout(url);
  } catch (e) {
    throw new Error(`Sheets netwerkfout/timeout voor "${sheetName}": ${e?.message || e}`);
  }
  if (!r.ok) throw new Error(`Sheets response ${r.status} voor "${sheetName}"`);

  let json;
  try { json = await r.json(); }
  catch { throw new Error('Sheets gaf geen geldige JSON terug.'); }

  // Als server expliciet ok:false geeft → fout doorgeven met detail.
  if (json && json.ok === false) {
    throw new Error(json.error || 'Sheets gaf ok:false terug.');
  }

  const arr = toObjects(json);
  _writeCache(sheetName, arr);
  return arr;
}

/** Haal meerdere tabbladen parallel op. */
export async function fetchSheets(sheetNames = []) {
  const out = {};
  await Promise.all(sheetNames.map(async (nm) => { out[nm] = await fetchSheet(nm); }));
  return out;
}
