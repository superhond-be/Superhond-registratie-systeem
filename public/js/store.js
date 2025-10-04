// store.js — lichte, snelle opslag (losse buckets) + status-normalisatie + nette migratie

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
    // stil falen (quota, private mode, ...)
  }
}

function S(v) { return String(v ?? '').trim(); }

/** Normaliseer status naar exact 'actief' of 'inactief'. */
function normalizeStatus(s) {
  // booleans/nummers eerst
  if (s === true || s === 1 || s === '1')  return 'actief';
  if (s === false || s === 0 || s === '0') return 'inactief';

  const v = S(s).toLowerCase().replace(/\s+/g, ' ').trim();

  const ACTIVE_SET = new Set(['actief','active','enabled','aan','on','true','waar','yes','y','1']);
  const INACTIVE_SET = new Set(['inactief','inactive','disabled','uit','off','false','niet actief','nee','n','0']);

  if (ACTIVE_SET.has(v))   return 'actief';
  if (INACTIVE_SET.has(v)) return 'inactief';

  // Fallback: onbekend/lege waarden tellen als actief (behoud bestaand gedrag)
  return 'actief';
}

/** Pas minimale normalisatie toe op records (trim + status). */
function normalizeArray(arr) {
  return (Array.isArray(arr) ? arr : []).map(item => {
    if (!item || typeof item !== 'object') return item;
    const out = { ...item };

    // Pak eventueel 'Status' (met hoofdletter) mee als 'status' ontbreekt
    if (!('status' in out) && 'Status' in out) out.status = out.Status;

    if ('status' in out) out.status = normalizeStatus(out.status);
    if ('id' in out)      out.id    = S(out.id);
    if ('naam' in out)    out.naam  = S(out.naam);
    if ('name' in out)    out.name  = S(out.name);

    return out;
  });
}

/** Eenvoudige dedupe: key op id; als id ontbreekt dan op naam/name. Extern wint (latere items overschrijven eerdere). */
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

    // Migreer KLASSEN: merge db.classes + db.klassen als target nog leeg is (zonder dubbels)
    if (!localStorage.getItem('superhond-classes')) {
      const legacyClasses = []
        .concat(Array.isArray(db.classes) ? db.classes : [])
        .concat(Array.isArray(db.klassen) ? db.klassen : []);
      if (legacyClasses.length) {
        writeBucket('superhond-classes', dedupeByIdOrName(legacyClasses));
      }
    }

    // Migreer REEKSEN
    if (Array.isArray(db.series) && !localStorage.getItem('superhond-series')) {
      writeBucket('superhond-series', dedupeByIdOrName(db.series));
    }

    // Migreer LESSEN
    if (Array.isArray(db.lessons) && !localStorage.getItem('superhond-lessons')) {
      writeBucket('superhond-lessons', dedupeByIdOrName(db.lessons));
    }

    // Optioneel: opruimen van legacy blob (alleen inschakelen als je 100% gemigreerd bent)
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
