// Superhond — Catalogus datastore (API → /data → LocalStorage)
// Beheert: klassen, pakketten (+ leest reeksen, lessen, locaties, trainers)

const BUST = () => `?t=${Date.now()}`;
const API = {
  klassen:   "/api/klassen",
  pakketten: "/api/pakketten",
  reeksen:   "/api/reeksen",
  lessen:    "/api/lessen",
  locaties:  "/api/locaties",
  trainers:  "/api/trainers",
};
const DATA = {
  klassen:   "/data/klassen.json",
  pakketten: "/data/pakketten.json",
  reeksen:   "/data/reeksen.json",
  lessen:    "/data/lessen.json",
  locaties:  "/data/locaties.json",
  trainers:  "/data/trainers.json",
};
const LS = {
  klassen:   "sh_klassen",
  pakketten: "sh_pakketten",
  reeksen:   "sh_reeksen",
  lessen:    "sh_lessen",
  locaties:  "sh_locaties",
  trainers:  "sh_trainers",
};

async function tryFetch(url, opts={}) {
  const r = await fetch(url + BUST(), { cache:"no-store", ...opts });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}
async function firstOk(urls, opts) {
  for (const u of urls) {
    try { return await tryFetch(u, opts); } catch {}
  }
  throw new Error(`Geen bron bereikbaar:\n${urls.join("\n")}`);
}
function lsGet(key, fallback=[]) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

export async function loadCatalog() {
  // API → DATA → LS
  const [klassen, pakketten, reeksen, lessen, locaties, trainers] = await Promise.all([
    firstOk([API.klassen, DATA.klassen]).catch(()=>lsGet(LS.klassen, [])),
    firstOk([API.pakketten, DATA.pakketten]).catch(()=>lsGet(LS.pakketten, [])),
    firstOk([API.reeksen,  DATA.reeksen ]).catch(()=>lsGet(LS.reeksen,  [])),
    firstOk([API.lessen,   DATA.lessen  ]).catch(()=>lsGet(LS.lessen,   [])),
    firstOk([API.locaties, DATA.locaties]).catch(()=>lsGet(LS.locaties, [])),
    firstOk([API.trainers, DATA.trainers]).catch(()=>lsGet(LS.trainers, [])),
  ]);
  // cache naar LS
  lsSet(LS.klassen, klassen);
  lsSet(LS.pakketten, pakketten);
  lsSet(LS.reeksen, reeksen);
  lsSet(LS.lessen, lessen);
  lsSet(LS.locaties, locaties);
  lsSet(LS.trainers, trainers);
  return { klassen, pakketten, reeksen, lessen, locaties, trainers };
}

/* ---------- CRUD: KLASSEN ---------- */
async function apiSave(url, item) {
  const isNew = !item.id;
  const endpoint = isNew ? url : `${url}/${encodeURIComponent(item.id)}`;
  const method = isNew ? "POST" : "PUT";
  return tryFetch(endpoint, {
    method, headers: { "Content-Type":"application/json" }, body: JSON.stringify(item)
  });
}
async function apiDelete(url, id) {
  const r = await fetch(`${url}/${encodeURIComponent(id)}`, { method:"DELETE" });
  if (!r.ok) throw new Error(`${url}/${id} → HTTP ${r.status}`);
}

export async function saveKlas(klas) {
  try {
    const saved = await apiSave(API.klassen, klas);
    const all = lsGet(LS.klassen, []);
    const i = all.findIndex(x => String(x.id) === String(saved.id));
    if (i>=0) all[i] = saved; else all.push(saved);
    lsSet(LS.klassen, all);
    return saved;
  } catch {
    const all = lsGet(LS.klassen, []);
    if (!klas.id) klas.id = String(Date.now());
    const i = all.findIndex(x => String(x.id) === String(klas.id));
    if (i>=0) all[i] = { ...all[i], ...klas }; else all.push(klas);
    lsSet(LS.klassen, all);
    return klas;
  }
}
export async function deleteKlas(id) {
  try { await apiDelete(API.klassen, id); }
  finally {
    const all = lsGet(LS.klassen, []).filter(x => String(x.id)!==String(id));
    lsSet(LS.klassen, all);
  }
}

/* ---------- CRUD: PAKKETTEN ---------- */
export async function savePakket(p) {
  try {
    const saved = await apiSave(API.pakketten, p);
    const all = lsGet(LS.pakketten, []);
    const i = all.findIndex(x => String(x.id) === String(saved.id));
    if (i>=0) all[i] = saved; else all.push(saved);
    lsSet(LS.pakketten, all);
    return saved;
  } catch {
    const all = lsGet(LS.pakketten, []);
    if (!p.id) p.id = String(Date.now());
    const i = all.findIndex(x => String(x.id) === String(p.id));
    if (i>=0) all[i] = { ...all[i], ...p }; else all.push(p);
    lsSet(LS.pakketten, all);
    return p;
  }
}
export async function deletePakket(id) {
  try { await apiDelete(API.pakketten, id); }
  finally {
    const all = lsGet(LS.pakketten, []).filter(x => String(x.id)!==String(id));
    lsSet(LS.pakketten, all);
  }
}

/* ---------- helpers ---------- */
export const S = v => String(v ?? "");
export const nameTrainer = t => [t?.voornaam, t?.achternaam].filter(Boolean).join(" ");
export const lists = {
  statusSelect(selected="actief") {
    const o = ["actief","inactief","concept","archief"];
    return `<select class="input">${o.map(x=>`<option ${x===selected?"selected":""}>${x}</option>`).join("")}</select>`;
  },
  klasSelect(klassen, selectedId) {
    return `<select class="input">` + klassen.map(k =>
      `<option value="${k.id}" ${String(k.id)===String(selectedId)?"selected":""}>${k.naam}</option>`
    ).join("") + `</select>`;
  },
  typeSelect(selected="") {
    const o = ["puppy","basis","puber","groep","privé","workshop","seminar"];
    return `<select class="input">` + o.map(x => `<option ${x===selected?"selected":""}>${x}</option>`).join("") + `</select>`;
  }
};
