// Superhond store.js — robuuste loader (altijd absolute /data/* paden)
// /public/js/store.js

// --- generieke buckets ---
function readBucket(key){
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}
function writeBucket(key, arr){
  localStorage.setItem(key, JSON.stringify(arr || []));
}

// --- specifieke helpers ---
export function getKlassen(){  return readBucket('superhond-classes'); }
export function setKlassen(v){ writeBucket('superhond-classes', v); }

export function getReeksen(){  return readBucket('superhond-series'); }
export function setReeksen(v){ writeBucket('superhond-series', v); }

export function getLessen(){   return readBucket('superhond-lessons'); }
export function setLessen(v){  writeBucket('superhond-lessons', v); }

// backward-compat: migreer 1x uit oude sleutel
export function ensureMigrated(){
  try{
    const raw = localStorage.getItem('superhond-db');
    if (!raw) return;
    const db = JSON.parse(raw) || {};
    if (Array.isArray(db.classes) && !localStorage.getItem('superhond-classes')){
      writeBucket('superhond-classes', db.classes);
    }
    if (Array.isArray(db.series) && !localStorage.getItem('superhond-series')){
      writeBucket('superhond-series', db.series);
    }
    if (Array.isArray(db.lessons) && !localStorage.getItem('superhond-lessons')){
      writeBucket('superhond-lessons', db.lessons);
    }
    // 1x opruimen mag, maar is optioneel:
    // localStorage.removeItem('superhond-db');
  }catch{}
}
const LS = {
  klanten: "sh_klanten",
  honden: "sh_honden",
  version: "sh_version",
};

let _klanten = null;
let _honden  = null;

const bust = () => `?t=${Date.now()}`;

async function loadJsonAbs(path) {
  const url = `${path}${bust()}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}

async function loadAllDemo() {
  const [klanten, honden] = await Promise.all([
    loadJsonAbs("/data/klanten.json"),
    loadJsonAbs("/data/honden.json"),
  ]);
  return { klanten, honden };
}

export async function ensureData() {
  if (_klanten && _honden) return;

  // 1) uit localStorage als beschikbaar
  const kl = localStorage.getItem(LS.klanten);
  const ho = localStorage.getItem(LS.honden);
  if (kl && ho) {
    try {
      _klanten = JSON.parse(kl);
      _honden  = JSON.parse(ho);
      return;
    } catch {
      // val terug op fetch
    }
  }

  // 2) static demo-data (absolute paden!)
  try {
    const { klanten, honden } = await loadAllDemo();
    _klanten = klanten || [];
    _honden  = honden  || [];
    localStorage.setItem(LS.klanten, JSON.stringify(_klanten));
    localStorage.setItem(LS.honden,  JSON.stringify(_honden));
  } catch (e) {
    // gooi door zodat pagina's het tonen in #error
    throw new Error("Kon demo-data niet laden. " + e.message);
  }
}

/* -------- getters / setters -------- */
export const getKlanten = () => _klanten || [];
export const getHonden  = () => _honden  || [];

export function setKlanten(list) {
  _klanten = Array.isArray(list) ? list : [];
  localStorage.setItem(LS.klanten, JSON.stringify(_klanten));
}
export function setHonden(list) {
  _honden = Array.isArray(list) ? list : [];
  localStorage.setItem(LS.honden, JSON.stringify(_honden));
}

/* -------- misc helpers -------- */
export function debounce(fn, ms=300){
  let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
}
