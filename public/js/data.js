// /js/data.js — helpers om demo-data of API te laden voor reeksen/lessen/trainers/locaties

const BUST = () => `?t=${Date.now()}`;

async function fetchJson(candidates) {
  const errors = [];
  for (const url of candidates) {
    try {
      const r = await fetch(url + BUST(), { cache: "no-store" });
      if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
      return await r.json();
    } catch (e) { errors.push(e.message); }
  }
  // Laatste redmiddel: lege lijst
  console.warn("[data] geen bron bereikbaar:", errors.join(" | "));
  return [];
}

export async function loadAll() {
  // 1) probeer API; 2) fallback naar /data/*.json
  const [reeksen, lessen, trainers, locaties] = await Promise.all([
    fetchJson(["/api/lessenreeksen", "/data/lessenreeksen.json"]),
    fetchJson(["/api/lessen",        "/data/lessen.json"]),
    fetchJson(["/api/trainers",      "/data/trainers.json"]),
    fetchJson(["/api/locaties",      "/data/locaties.json"]),
  ]);

  return {
    reeksen: Array.isArray(reeksen) ? reeksen : [],
    lessen: Array.isArray(lessen) ? lessen : [],
    trainers: Array.isArray(trainers) ? trainers : [],
    locaties: Array.isArray(locaties) ? locaties : []
  };
}

export function indexById(arr) {
  const map = Object.create(null);
  (arr || []).forEach(x => { if (x && x.id != null) map[String(x.id)] = x; });
  return map;
}

export function humanDate(s) {
  if (!s) return "—";
  try {
    const d = new Date(s.length <= 10 ? s + "T00:00:00" : s);
    return d.toLocaleDateString("nl-BE", { weekday:"short", day:"2-digit", month:"2-digit", year:"numeric" });
  } catch { return s; }
}

export function timeRange(start, end) {
  const s = start || ""; const e = end || "";
  if (!s && !e) return "—";
  return [s, e].filter(Boolean).join("–");
}
