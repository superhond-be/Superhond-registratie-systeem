// Eenvoudige client-side "datastore" met seed fallback en localStorage.
// Keys
const K_KLANTEN = "superhond.klanten";
const K_HONDEN  = "superhond.honden";

// Seed-loaders
async function loadSeed(path) {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`Seed niet geladen: ${path}`);
  return await r.json();
}

// Init: laad uit localStorage of seed
export async function ensureData() {
  if (!localStorage.getItem(K_KLANTEN)) {
    const seed = await loadSeed("/data/klanten.json").catch(() => []);
    localStorage.setItem(K_KLANTEN, JSON.stringify(seed));
  }
  if (!localStorage.getItem(K_HONDEN)) {
    const seed = await loadSeed("/data/honden.json").catch(() => []);
    localStorage.setItem(K_HONDEN, JSON.stringify(seed));
  }
}

export function getKlanten() {
  return JSON.parse(localStorage.getItem(K_KLANTEN) || "[]");
}
export function setKlanten(list) {
  localStorage.setItem(K_KLANTEN, JSON.stringify(list));
}
export function getHonden() {
  return JSON.parse(localStorage.getItem(K_HONDEN) || "[]");
}
export function setHonden(list) {
  localStorage.setItem(K_HONDEN, JSON.stringify(list));
}

// ID helpers
function nextId(list) {
  const max = list.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0);
  return max + 1;
}
export function newKlantId() { return nextId(getKlanten()); }
export function newHondId()  { return nextId(getHonden()); }

// Utils
export function byId(list, id) {
  return list.find(x => String(x.id) === String(id));
}
export function debounce(fn, ms=300) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
