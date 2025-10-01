// Superhond — Lessen data store (API → fallback JSON → LocalStorage)
// Exporteert:
// - loadAll() -> {lessen, reeksen, locaties, trainers}
// - saveLes(les), deleteLes(id)
// - exportJSON(data, filename), importJSON(data)
// - lists.* helpers voor <select>

const BUST = () => `?t=${Date.now()}`;

// ---- API endpoints (pas aan zodra backend live is) ----
const API = {
  lessen:   "/api/lessen",
  reeksen:  "/api/reeksen",
  locaties: "/api/locaties",
  trainers: "/api/trainers",
};

// ---- Fallback JSON (plaats in /public/data/...) ----
const DATA = {
  lessen:   "/data/lessen.json",
  reeksen:  "/data/reeksen.json",
  locaties: "/data/locaties.json",
  trainers: "/data/trainers.json",
};

// ---- LocalStorage keys (laat demo werken) ----
const LS = {
  lessen:   "sh_lessen",
  reeksen:  "sh_reeksen",
  locaties: "sh_locaties",
  trainers: "sh_trainers",
};

async function tryFetch(url, opts = {}) {
  const r = await fetch(url + BUST(), { cache: "no-store", ...opts });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}

async function firstOk(urls, opts) {
  for (const u of urls) {
    try { return await tryFetch(u, opts); } catch { /* try next */ }
  }
  throw new Error(`Geen bron bereikbaar:\n${urls.join("\n")}`);
}

function lsGet(key, fallback = []) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function lsSet(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

export async function loadAll() {
  // 1) API → 2) /data/*.json → 3) LocalStorage
  const [reeksen, locaties, trainers] = await Promise.all([
    firstOk([API.reeksen, DATA.reeksen]).catch(() => lsGet(LS.reeksen, [])),
    firstOk([API.locaties, DATA.locaties]).catch(() => lsGet(LS.locaties, [])),
    firstOk([API.trainers, DATA.trainers]).catch(() => lsGet(LS.trainers, [])),
  ]);

  let lessen;
  try {
    lessen = await firstOk([API.lessen, DATA.lessen]);
  } catch {
    lessen = lsGet(LS.lessen, []);
  }

  // Cache in LS zodat demo altijd blijft werken
  lsSet(LS.reeksen, reeksen);
  lsSet(LS.locaties, locaties);
  lsSet(LS.trainers, trainers);
  lsSet(LS.lessen, lessen);

  return { lessen, reeksen, locaties, trainers };
}

// ---- CRUD (werkt direct in LS, schakelt vanzelf naar API als beschikbaar) ----
async function apiSave(les) {
  const isNew = !les.id;
  const url = API.lessen + (isNew ? "" : `/${encodeURIComponent(les.id)}`);
  const method = isNew ? "POST" : "PUT";
  return tryFetch(url, { method, headers:{ "Content-Type":"application/json" }, body: JSON.stringify(les) });
}
async function apiDelete(id) {
  const url = `${API.lessen}/${encodeURIComponent(id)}`;
  const r = await fetch(url, { method:"DELETE" });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
}

export async function saveLes(les) {
  // Probeer API
  try {
    const saved = await apiSave(les);
    // Sync LS kopie
    const all = lsGet(LS.lessen, []);
    const idx = all.findIndex(x => String(x.id) === String(saved.id));
    if (idx >= 0) all[idx] = saved; else all.push(saved);
    lsSet(LS.lessen, all);
    return saved;
  } catch {
    // Demo: LS
    const all = lsGet(LS.lessen, []);
    if (!les.id) les.id = String(Date.now());
    const idx = all.findIndex(x => String(x.id) === String(les.id));
    if (idx >= 0) all[idx] = { ...all[idx], ...les }; else all.push(les);
    lsSet(LS.lessen, all);
    return les;
  }
}

export async function deleteLes(id) {
  if (!id) return;
  try {
    await apiDelete(id);
    const all = lsGet(LS.lessen, []).filter(x => String(x.id) !== String(id));
    lsSet(LS.lessen, all);
  } catch {
    const all = lsGet(LS.lessen, []).filter(x => String(x.id) !== String(id));
    lsSet(LS.lessen, all);
  }
}

// ---- Export / Import ----
export async function exportJSON(data, filename = "lessen.json") {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
export async function importJSON(data) {
  // Schrijf in LS (en later naar API via bulk endpoint als gewenst)
  lsSet(LS.lessen, Array.isArray(data) ? data : []);
  return lsGet(LS.lessen, []);
}

// ---- Dropdown helpers ----
export const lists = {
  textFromReeks(sel) {
    const opt = sel?.selectedOptions?.[0];
    return opt?.dataset?.naam ?? opt?.textContent ?? "";
  },
  reeksSelect(reeksen, selectedId, fallbackText = "") {
    const opts = reeksen.map(r => `<option value="${r.id}" data-naam="${r.naam}" ${String(r.id)===String(selectedId)?"selected":""}>${r.naam}</option>`).join("");
    const blank = !selectedId && !fallbackText ? `<option value="" selected>— kies —</option>` : "";
    return `<select>${blank}${opts}</select>`;
  },
  typeSelect(selected="Groep"){
    const types = ["Groep","Privé","Workshop","Seminar"];
    return `<select>${types.map(t=>`<option ${t===selected?"selected":""}>${t}</option>`).join("")}</select>`;
  },
  locSelect(locaties, selectedId){
    const opts = locaties.map(l=>`<option value="${l.id}" ${String(l.id)===String(selectedId)?"selected":""}>${l.naam}</option>`).join("");
    return `<select>${opts}</select>`;
  },
  trainerSelect(trainers, selectedId){
    const name = t => [t.voornaam,t.achternaam].filter(Boolean).join(" ");
    const opts = trainers.map(t=>`<option value="${t.id}" ${String(t.id)===String(selectedId)?"selected":""}>${name(t)}</option>`).join("");
    return `<select>${opts}</select>`;
  },
  themaSelect(selected=""){
    const items = ["Start","Gevorderd","Nosework","Balans & Coördinatie","Puppy"];
    const opts = items.map(x=>`<option ${x===selected?"selected":""}>${x}</option>`).join("");
    return `<select>${opts}</select>`;
  },
};

// ---- Extra helpers ----
export const date = {
  addDays(d, n){ const x = new Date(d); x.setDate(x.getDate()+n); return x; },
  startOfWeek(d){ const x = new Date(d); const dow = (x.getDay()+6)%7; x.setDate(x.getDate()-dow); x.setHours(0,0,0,0); return x; },
  fmtISO(d){ return d.toISOString().slice(0,10); },
  fmtNL(d){ return d.toLocaleDateString("nl-BE", { day:"2-digit", month:"short", year:"numeric" }); },
};
