// sheets.js — dunne client voor jouw Google Apps Script web-app
// Gebruik: setBaseUrl('https://script.google.com/macros/s/.../exec')
//          const klassen = await fetchSheet('Klassen');

let _BASE_URL =
  (typeof window !== 'undefined' && window.SUPERHOND_SHEETS_URL) || // optioneel via HTML
  null;

// standaard 60s cache; pas aan indien nodig
let _CACHE_SECS = 60;

/* =========================
   Config
   ========================= */
export function setBaseUrl(url) { _BASE_URL = String(url || '').trim() || null; }
export function getBaseUrl()    { return _BASE_URL; }
export function setCacheSecs(s) { _CACHE_SECS = Math.max(0, Number(s) || 0); }

/* =========================
   Cache helpers
   ========================= */
const CK = (sheet) => `sh-cache:${_BASE_URL || 'no-base'}:${sheet}`;

export function clearCache(sheetName = null) {
  if (!sheetName) {
    // wis alle keys van dit domain die met sh-cache: beginnen
    try {
      const keys = Object.keys(localStorage);
      for (const k of keys) if (k.startsWith('sh-cache:')) localStorage.removeItem(k);
    } catch {}
  } else {
    try { localStorage.removeItem(CK(sheetName)); } catch {}
  }
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

/* =========================
   Normalisatie helpers
   ========================= */
/** Converteer diverse JSON vormen naar array van objecten. */
function toObjects(json) {
  if (!json) return [];

  // meest gangbaar: { items: [ {...}, ... ] } of { data: [ {...} ] }
  const arrObj = Array.isArray(json.items) ? json.items
               : Array.isArray(json.data)  ? json.data
               : null;
  if (arrObj && arrObj.every(x => x && typeof x === 'object' && !Array.isArray(x))) {
    return arrObj;
  }

  // soms: { headers:[...], rows:[[...],[...]] }
  if (Array.isArray(json.headers) && Array.isArray(json.rows)) {
    const H = json.headers.map(s => String(s ?? '').trim());
    return json.rows.map(row => {
      const o = {};
      H.forEach((k, i) => { o[k] = row[i]; });
      return o;
    });
  }

  // fallback: array van arrays met 1e rij als headers
  const arr = Array.isArray(json) ? json
           : Array.isArray(json?.rows) ? json.rows
           : Array.isArray(json?.items) ? json.items
           : [];
  if (Array.isArray(arr) && arr.length && Array.isArray(arr[0])) {
    const H = arr[0].map(s => String(s ?? '').trim());
    return arr.slice(1).map(row => {
      const o = {};
      H.forEach((k, i) => { o[k] = row[i]; });
      return o;
    });
  }

  return [];
}

/** Normaliseer statussen naar 'actief' / 'inactief'. */
export function normStatus(s) {
  const v = String(s ?? '').trim().toLowerCase();
  if (['actief','active','aan','on','true','1','yes','y'].includes(v)) return 'actief';
  if (['inactief','inactive','uit','off','false','0','nee','n','niet actief'].includes(v)) return 'inactief';
  // default: actief (conservatief, zoals je app nu doet)
  return 'actief';
}

/* =========================
   Fetch helpers
   ========================= */
async function fetchWithTimeout(url, ms = 12000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    return r;
  } finally {
    clearTimeout(id);
  }
}

/** Haal 1 tabblad op als array van objecten (koprij = velden). */
export async function fetchSheet(sheetName) {
  const base = _BASE_URL;
  if (!base) throw new Error('Sheets base URL ontbreekt. Gebruik setBaseUrl(...) of zet window.SUPERHOND_SHEETS_URL.');

  const cache = _readCache(sheetName);
  if (cache) return cache;

  const url = `${base}?sheet=${encodeURIComponent(sheetName)}&t=${Date.now()}`;
  let r;
  try {
    r = await fetchWithTimeout(url);
  } catch (e) {
    throw new Error(`Sheets netwerkfout/timeout voor "${sheetName}": ${String(e && e.message || e)}`);
  }
  if (!r.ok) throw new Error(`Sheets response ${r.status} voor "${sheetName}"`);

  let json;
  try { json = await r.json(); }
  catch { throw new Error('Sheets gaf geen geldige JSON terug.'); }

  // typische Apps Script shape: { ok:true, sheet:'Klanten', items:[...] }
  const arr = toObjects(json);
  _writeCache(sheetName, arr);
  return arr;
}

/** Haal meerdere tabbladen parallel op. */
export async function fetchSheets(sheetNames = []) {
  const out = {};
  await Promise.all(sheetNames.map(async (nm) => {
    out[nm] = await fetchSheet(nm);
  }));
  return out;
}
