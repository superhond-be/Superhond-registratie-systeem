/public/js/store.js
```js
// store.js — lichte, snelle opslag (losse buckets) + status-normalisatie + nette migratie
// v0.23.0

/* =========================
   Storage shim (werkt ook bij quota / private mode)
   ========================= */
const memoryStore = new Map();
function safeGetItem(k) {
  try { return localStorage.getItem(k); } catch { return memoryStore.get(k) ?? null; }
}
function safeSetItem(k, v) {
  try { localStorage.setItem(k, v); }
  catch { memoryStore.set(k, v); }
}
function safeRemoveItem(k) {
  try { localStorage.removeItem(k); }
  catch { memoryStore.delete(k); }
}

/* =========================
   Interne helpers
   ========================= */
function readBucket(key) {
  try {
    const raw = safeGetItem(key);
    const val = raw ? JSON.parse(raw) : [];
    return Array.isArray(val) ? val : [];
  } catch {
    return [];
  }
}

function writeBucket(key, arr) {
  try {
    safeSetItem(key, JSON.stringify(Array.isArray(arr) ? arr : []));
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

  // Fallback: onbekend/lege waarden -> behoud bestaand gedrag (actief)
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

/** Eenvoudige dedupe: key op id; als id ontbreekt dan op naam/name; als dat ook ontbreekt -> stabiele hash. */
function dedupeByIdOrName(list) {
  const map = new Map();

  for (const it of (list || [])) {
    if (!it || typeof it !== 'object') continue;

    const id   = S(it.id);
    const name = S(it.naam || it.name);

    // stabiele hash (deterministisch op inhoud) i.p.v. random
    const fallback = stableKey(it);
    const key  = id || name || fallback;

    // "extern wint": later element overschrijft eerder
    map.set(key, it);
  }
  return [...map.values()];
}

function stableKey(obj) {
  try {
    // stringify met gesorteerde keys voor stabiliteit
    const ordered = JSON.stringify(obj, Object.keys(obj).sort());
    let h = 0;
    for (let i = 0; i < ordered.length; i++) {
      h = (h * 31 + ordered.charCodeAt(i)) >>> 0;
    }
    return 'k_' + h.toString(36);
  } catch {
    return 'k_' + Math.abs((obj && obj.toString && obj.toString().length) || 0);
  }
}

/* =========================
   Buckets API
   ========================= */
const K_KLASSEN = 'superhond-classes';
const K_REEKSEN = 'superhond-series';
const K_LESSEN  = 'superhond-lessons';

export function getKlassen()  { return normalizeArray(readBucket(K_KLASSEN)); }
export function setKlassen(v) { writeBucket(K_KLASSEN, v); }

export function getReeksen()  { return normalizeArray(readBucket(K_REEKSEN)); }
export function setReeksen(v) { writeBucket(K_REEKSEN, v); }

export function getLessen()   { return normalizeArray(readBucket(K_LESSEN)); }
export function setLessen(v)  { writeBucket(K_LESSEN, v); }

/** Handig bij testen of voor een "Reset lokale data" knop. */
export function clearBuckets() {
  [K_KLASSEN, K_REEKSEN, K_LESSEN].forEach(safeRemoveItem);
}

/* =========================
   Migratie uit legacy 'superhond-db'
   ========================= */
const MIG_FLAG = 'superhond-migrated-v1';

export function ensureMigrated() {
  try {
    if (safeGetItem(MIG_FLAG)) return; // idempotent

    const raw = safeGetItem('superhond-db');
    if (!raw) { safeSetItem(MIG_FLAG, '1'); return; }

    const db = JSON.parse(raw) || {};

    // Migreer KLASSEN: merge db.classes + db.klassen als target nog leeg is (zonder dubbels)
    if (!safeGetItem(K_KLASSEN)) {
      const legacyClasses = []
        .concat(Array.isArray(db.classes) ? db.classes : [])
        .concat(Array.isArray(db.klassen) ? db.klassen : []);
      if (legacyClasses.length) {
        writeBucket(K_KLASSEN, dedupeByIdOrName(legacyClasses));
      }
    }

    // Migreer REEKSEN
    if (Array.isArray(db.series) && !safeGetItem(K_REEKSEN)) {
      writeBucket(K_REEKSEN, dedupeByIdOrName(db.series));
    }

    // Migreer LESSEN
    if (Array.isArray(db.lessons) && !safeGetItem(K_LESSEN)) {
      writeBucket(K_LESSEN, dedupeByIdOrName(db.lessons));
    }

    // Zet migratievlag
    safeSetItem(MIG_FLAG, '1');

    // Optioneel: opruimen van legacy blob (alleen inschakelen als je 100% gemigreerd bent)
    // safeRemoveItem('superhond-db');
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
