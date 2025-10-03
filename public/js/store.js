// store.js – snelle bucket-based opslag voor Superhond

// --- generieke helpers ---
function readBucket(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

function writeBucket(key, arr) {
  localStorage.setItem(key, JSON.stringify(arr || []));
}

// --- specifieke buckets ---
export function getKlassen()   { return readBucket('superhond-classes'); }
export function setKlassen(v) { writeBucket('superhond-classes', v); }

export function getReeksen()   { return readBucket('superhond-series'); }
export function setReeksen(v) { writeBucket('superhond-series', v); }

export function getLessen()   { return readBucket('superhond-lessons'); }
export function setLessen(v) { writeBucket('superhond-lessons', v); }

// --- migratie vanuit oude "superhond-db" ---
export function ensureMigrated() {
  try {
    const raw = localStorage.getItem('superhond-db');
    if (!raw) return;
    const db = JSON.parse(raw) || {};

    if (Array.isArray(db.classes) && !localStorage.getItem('superhond-classes')) {
      writeBucket('superhond-classes', db.classes);
    }
    if (Array.isArray(db.series) && !localStorage.getItem('superhond-series')) {
      writeBucket('superhond-series', db.series);
    }
    if (Array.isArray(db.lessons) && !localStorage.getItem('superhond-lessons')) {
      writeBucket('superhond-lessons', db.lessons);
    }

    // Optioneel: opruimen
    // localStorage.removeItem('superhond-db');
  } catch {
    // ignore
  }
}

// --- status helper ---
export function isActiefStatus(s) {
  return String(s || '').trim().toLowerCase() === 'actief';
}
