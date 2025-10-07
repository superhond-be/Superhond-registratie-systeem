// /public/js/store.js — lichte, snelle opslag + status-normalisatie + migratie

/* =========================
   Interne helpers
   ========================= */
function readBucket(key) {
  try {
    const raw = localStorage.getItem(key);
    const val = raw ? JSON.parse(raw) : [];
    return Array.isArray(val) ? val : [];
  } catch {
    return [];
  }
}
function writeBucket(key, arr) {
  try { localStorage.setItem(key, JSON.stringify(Array.isArray(arr) ? arr : [])); }
  catch { /* stil falen */ }
}
function S(v) { return String(v ?? '').trim(); }

/** Normaliseer status naar exact 'actief' of 'inactief'. */
function normalizeStatus(s) {
  if (s === true || s === 1 || s === '1')  return 'actief';
  if (s === false || s === 0 || s === '0') return 'inactief';
  const v = S(s).toLowerCase().replace(/\s+/g, ' ').trim();
  const ACTIVE_SET   = new Set(['actief','active','enabled','aan','on','true','waar','yes','y','1']);
  const INACTIVE_SET = new Set(['inactief','inactive','disabled','uit','off','false','niet actief','nee','n','0']);
  if (ACTIVE_SET.has(v))   return 'actief';
  if (INACTIVE_SET.has(v)) return 'inactief';
  return 'actief'; // fallback behoud gedrag
}
function normalizeArray(arr) {
  return (Array.isArray(arr) ? arr : []).map(item => {
    if (!item || typeof item !== 'object') return item;
    const out = { ...item };
    if (!('status' in out) && 'Status' in out) out.status = out.Status;
    if ('status' in out) out.status = normalizeStatus(out.status);
    if ('id' in out)      out.id    = S(out.id);
    if ('naam' in out)    out.naam  = S(out.naam);
    if ('name' in out)    out.name  = S(out.name);
    return out;
  });
}
function dedupeByIdOrName(list) {
  const map = new Map();
  for (const it of (list || [])) {
    if (!it || typeof it !== 'object') continue;
    const id   = S(it.id);
    const name = S(it.naam || it.name);
    const key  = id || name || Math.random().toString(36).slice(2);
    map.set(key, it);
  }
  return [...map.values()];
}

/* =========================
   Buckets API
   ========================= */
// Nieuw: klanten + honden
export function getKlanten()  { return normalizeArray(readBucket('superhond-klanten')); }
export function setKlanten(v) { writeBucket('superhond-klanten', v); }

export function getHonden()   { return normalizeArray(readBucket('superhond-honden')); }
export function setHonden(v)  { writeBucket('superhond-honden', v); }

// Bestaand (klassen/reeksen/lessen)
export function getKlassen()  { return normalizeArray(readBucket('superhond-classes')); }
export function setKlassen(v) { writeBucket('superhond-classes', v); }

export function getReeksen()  { return normalizeArray(readBucket('superhond-series')); }
export function setReeksen(v) { writeBucket('superhond-series', v); }

export function getLessen()   { return normalizeArray(readBucket('superhond-lessons')); }
export function setLessen(v)  { writeBucket('superhond-lessons', v); }

/* =========================
   Migratie uit legacy 'superhond-db'
   ========================= */
export function ensureMigrated() {
  try {
    const raw = localStorage.getItem('superhond-db');
    if (!raw) return;
    const db = JSON.parse(raw) || {};

    // legacy klanten/honden -> nieuwe buckets als nog leeg
    if (!localStorage.getItem('superhond-klanten') && Array.isArray(db.klanten)) {
      writeBucket('superhond-klanten', dedupeByIdOrName(db.klanten));
    }
    if (!localStorage.getItem('superhond-honden') && Array.isArray(db.honden)) {
      writeBucket('superhond-honden', dedupeByIdOrName(db.honden));
    }

    // klassen
    if (!localStorage.getItem('superhond-classes')) {
      const legacyClasses = []
        .concat(Array.isArray(db.classes) ? db.classes : [])
        .concat(Array.isArray(db.klassen) ? db.klassen : []);
      if (legacyClasses.length) writeBucket('superhond-classes', dedupeByIdOrName(legacyClasses));
    }
    if (Array.isArray(db.series) && !localStorage.getItem('superhond-series')) {
      writeBucket('superhond-series', dedupeByIdOrName(db.series));
    }
    if (Array.isArray(db.lessons) && !localStorage.getItem('superhond-lessons')) {
      writeBucket('superhond-lessons', dedupeByIdOrName(db.lessons));
    }
    // legacy cleanup optioneel:
    // localStorage.removeItem('superhond-db');
  } catch { /* negeer migratiefouten */ }
}

/* =========================
   Status helpers (voor UI)
   ========================= */
export function isActiefStatus(s) { return normalizeStatus(s) === 'actief'; }
export function statusLabel(s)    { return isActiefStatus(s) ? 'Actief' : 'Inactief'; }
