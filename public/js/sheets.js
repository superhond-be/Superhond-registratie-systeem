// sheets.js — dunne client voor jouw Google Apps Script web-app
// Gebruik: stel BASE_URL 1x in en roep fetchSheet('Klanten') etc. aan.

const SHEETS_BASE_URL =
  'https://script.google.com/macros/s/___JOUW_WEBAPP_URL_HIER___/exec'; // <— plak hier je /exec URL

const CACHE_SECS = 60; // eenvoudige cache om onnodige requests te vermijden

function _cacheKey(sheet){ return `sh-cache:${sheet}`; }

function _readCache(sheet){
  try{
    const raw = localStorage.getItem(_cacheKey(sheet));
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (!at || Date.now() - at > CACHE_SECS*1000) return null;
    return data;
  }catch{ return null; }
}

function _writeCache(sheet, data){
  try{
    localStorage.setItem(_cacheKey(sheet), JSON.stringify({ at: Date.now(), data }));
  }catch{}
}

/** Haal 1 tabblad op als array van objecten (koprij = velden). */
export async function fetchSheet(sheetName){
  const cached = _readCache(sheetName);
  if (cached) return cached;

  const url = `${SHEETS_BASE_URL}?sheet=${encodeURIComponent(sheetName)}&t=${Date.now()}`;
  const r = await fetch(url, { cache:'no-store' });
  if (!r.ok) throw new Error(`Sheets fetch mislukte (${r.status})`);
  const json = await r.json();
  const arr = Array.isArray(json?.items) ? json.items : [];

  _writeCache(sheetName, arr);
  return arr;
}

/** Kleine helper: status normaliseren naar 'actief' of 'inactief'. */
export function normStatus(s){
  const v = String(s ?? '').trim().toLowerCase();
  if (['actief','active','aan','on','true','1','yes','y'].includes(v)) return 'actief';
  if (['inactief','inactive','uit','off','false','0','nee','n','niet actief'].includes(v)) return 'inactief';
  return v ? 'actief' : 'actief';
}

// utility
function S(v){ return String(v ?? '').trim(); }
