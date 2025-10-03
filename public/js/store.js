// store.js — lichte, snelle opslag (losse buckets) + status-normalisatie

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
  try {
    localStorage.setItem(key, JSON.stringify(Array.isArray(arr) ? arr : []));
  } catch {
    // stil falen: bij storage-quota e.d.
  }
}

function S(v) {
  return String(v ?? '').trim();
}

/** Normaliseer status naar exact 'actief' of 'inactief'. */
function normalizeStatus(s) {
  const v = S(s).toLowerCase();

  // Actief varianten
  const ACTIVE_SET = new Set([
    'actief', 'active', 'enabled', 'aan', 'on', 'true', 'waar', 'yes', 'y', '1'
  ]);

  // Inactief varianten
  const INACTIVE_SET = new Set([
    'inactief', 'inactive', 'disabled', 'uit', 'off', 'false', 'niet actief',
    'nee', 'n', '0'
  ]);

  if (ACTIVE_SET.has(v)) return 'actief';
  if (INACTIVE_SET.has(v)) return 'inactief';

  // Fallback: als leeg/onbekend -> 'actief' (conservatief, zoals eerder gedrag)
  return v ? 'actief' : 'actief';
}

/** Pas minimale normalisatie toe op records (trim + status-normalisatie). */
function normalizeArray(arr) {
  return (Array.isArray(arr) ? arr : []).map(item => {
    if (!item || typeof item !== 'object') return item;
    const out = { ...item };
    if ('status' in out) out.status = normalizeStatus(out.status);
    // Kleine trims voor veelvoorkomende velden
    if ('id' in out) out.id = S(out.id);
    if ('naam' in out) out.naam = S(out.naam);
    if ('name' in out) out.name = S(out.name);
    return out;
  });
}

/* =========================
   Buckets API
   ========================= */

// Klassen
export function getKlassen()  { return normalizeArray(readBucket('superhond-classes')); }
export function setKlassen(v) { writeBucket('superhond-classes', v); }

// Lessenreeksen (series)
export function getReeksen()  { return normalizeArray(readBucket('superhond-series')); }
export function setReeksen(v) { writeBucket('superhond-series', v); }

// Lessen
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

    // Let op: alleen migreren als de nieuwe buckets nog leeg zijn
    if (Array.isArray(db.classes) && !localStorage.getItem('superhond-classes')) {
      writeBucket('superhond-classes', db.classes);
    }
    // fallback key 'klassen'
    if (Array.isArray(db.klassen) && !localStorage.getItem('superhond-classes')) {
      writeBucket('superhond-classes', db.klassen);
    }

    if (Array.isArray(db.series) && !localStorage.getItem('superhond-series')) {
      writeBucket('superhond-series', db.series);
    }
    if (Array.isArray(db.lessons) && !localStorage.getItem('superhond-lessons')) {
      writeBucket('superhond-lessons', db.lessons);
    }

    // Optioneel: opruimen van legacy blob om duplicatie te vermijden:
    // localStorage.removeItem('superhond-db');
  } catch {
    // negeer migratiefouten
  }
}

/* =========================
   Status helpers (voor UI)
   ========================= */
export function isActiefStatus(s) {
  return normalizeStatus(s) === 'actief';
}

export function statusLabel(s) {
  return isActiefStatus(s) ? 'Actief' : 'Inactief';
}
