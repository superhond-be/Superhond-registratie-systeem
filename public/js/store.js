// Superhond store.js — robuuste loader (altijd absolute /data/* paden)

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
