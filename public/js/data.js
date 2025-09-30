// /js/data.js
const CANDIDATES = (p) => [p, `.${p}`, `..${p}`]; // root & submap fallback
const bust = () => `cb=${Date.now().toString(36)}`;

async function loadJson(path) {
  let lastErr;
  for (const u of CANDIDATES(path)) {
    try {
      const res = await fetch(`${u}?${bust()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (e) { lastErr = e; }
  }
  // Bestaat niet? Geef lege array terug (zodat de UI blijft werken).
  console.warn(`Kon ${path} niet laden:`, lastErr);
  return [];
}

export async function loadAll() {
  const [lessen, reeksen, trainers, locaties, mededelingen] = await Promise.all([
    loadJson('/data/lessen.json'),
    loadJson('/data/lessenreeksen.json'),
    loadJson('/data/trainers.json'),
    loadJson('/data/locaties.json'),
    loadJson('/data/mededelingen.json'),
  ]);

  return { lessen, reeksen, trainers, locaties, mededelingen };
}

export function indexById(arr) {
  const map = {};
  for (const x of arr || []) map[String(x.id)] = x;
  return map;
}

export function humanDate(isoLike) {
  if (!isoLike) return '';
  // Sta zowel "2025-10-02" als volledige ISO toe
  const d = new Date(isoLike.length <= 10 ? `${isoLike}T00:00:00` : isoLike);
  if (isNaN(d)) return isoLike;
  return d.toLocaleDateString('nl-BE', { weekday: 'short', day: '2-digit', month: 'short' });
}

export function timeRange(start, end) {
  if (!start && !end) return '';
  const fmt = (t) => (t?.length === 5 ? t : (t || '')).slice(0,5); // "19:00"
  return [fmt(start), fmt(end)].filter(Boolean).join('–');
}
