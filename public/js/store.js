/**
 * public/js/store.js — Lichte datastore (localStorage) voor Superhond
 * - ensureMigrated(): migreert oude keys → nieuwe schema
 * - Getters/setters: Klassen & Reeksen
 * - Helpers: isActiefStatus, upsertById, removeById, uuid
 */

const LS = {
  KLASSEN: 'superhond:klassen',
  REEKSEN: 'superhond:reeksen',
  // legacy keys (voorbeeld)
  LEGACY_KLASSEN: 'klassen',
  LEGACY_REEKSEN: 'reeksen'
};

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch { return fallback; }
}

function readKey(key, fallback = []) {
  const v = localStorage.getItem(key);
  return v ? safeParse(v, fallback) : fallback;
}
function writeKey(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

/** ===== Helpers ===== */
export function isActiefStatus(s) {
  return String(s == null ? '' : s).trim().toLowerCase() === 'actief';
}
export function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  // Fallback
  return 'u-' + Math.random().toString(16).slice(2) + Date.now().toString(16);
}
export function upsertById(list, item) {
  const id = String(item?.id || '');
  if (!id) throw new Error('upsertById: item.id ontbreekt');
  const idx = list.findIndex(x => String(x.id) === id);
  if (idx >= 0) list[idx] = { ...list[idx], ...item };
  else list.push(item);
  return list;
}
export function removeById(list, id) {
  const i = list.findIndex(x => String(x.id) === String(id));
  if (i >= 0) list.splice(i, 1);
  return list;
}

/** ===== Migratie =====
 * Verplaats legacy data naar nieuwe keys; milde normalisatie.
 */
export function ensureMigrated() {
  // Klassen
  if (!localStorage.getItem(LS.KLASSEN)) {
    const legacy = readKey(LS.LEGACY_KLASSEN, null);
    if (legacy && Array.isArray(legacy)) {
      writeKey(LS.KLASSEN, normalizeKlassen(legacy));
    }
  }
  // Reeksen
  if (!localStorage.getItem(LS.REEKSEN)) {
    const legacy = readKey(LS.LEGACY_REEKSEN, null);
    if (legacy && Array.isArray(legacy)) {
      writeKey(LS.REEKSEN, normalizeReeksen(legacy));
    }
  }
}

function normalizeKlassen(arr) {
  return arr.map(k => ({
    id: k.id || uuid(),
    naam: k.naam || k.name || 'Klas',
    status: k.status || 'actief',
    trainer: k.trainer || '',
    niveau: k.niveau || k.level || '',
    extra: k.extra || {}
  }));
}

function normalizeReeksen(arr) {
  return arr.map(r => ({
    id: r.id || uuid(),
    naam: r.naam || r.name || 'Reeks',
    status: r.status || 'actief',
    start: r.start || r.startDate || '',
    einde: r.einde || r.endDate || '',
    capacity: Number(r.capacity || 0),
    extra: r.extra || {}
  }));
}

/** ===== Klassen API ===== */
export function getKlassen() {
  return readKey(LS.KLASSEN, []);
}
export function setKlassen(list) {
  writeKey(LS.KLASSEN, Array.isArray(list) ? list : []);
}
export function addKlas(klas) {
  const list = getKlassen();
  upsertById(list, { id: klas.id || uuid(), ...klas });
  setKlassen(list);
  return klas;
}
export function updateKlas(partial) {
  const list = getKlassen();
  upsertById(list, partial);
  setKlassen(list);
}
export function removeKlas(id) {
  const list = getKlassen();
  removeById(list, id);
  setKlassen(list);
}

/** ===== Reeksen API ===== */
export function getReeksen() {
  return readKey(LS.REEKSEN, []);
}
export function setReeksen(list) {
  writeKey(LS.REEKSEN, Array.isArray(list) ? list : []);
}
export function addReeks(reeks) {
  const list = getReeksen();
  upsertById(list, { id: reeks.id || uuid(), ...reeks });
  setReeksen(list);
  return reeks;
}
export function updateReeks(partial) {
  const list = getReeksen();
  upsertById(list, partial);
  setReeksen(list);
}
export function removeReeks(id) {
  const list = getReeksen();
  removeById(list, id);
  setReeksen(list);
}

/** ===== Utilities ===== */
export function clearAllStore() {
  localStorage.removeItem(LS.KLASSEN);
  localStorage.removeItem(LS.REEKSEN);
}
