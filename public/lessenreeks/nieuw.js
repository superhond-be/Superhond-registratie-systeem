// /lessenreeks/nieuw.js  (alleen het stuk rond klassen laden + init toevoegen)
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? "").trim();

  // --- bestaande mount mag blijven ---
  document.addEventListener("DOMContentLoaded", () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title: "Nieuwe lessenreeks", icon: "📦", back: "./" });
    }
  });

  // ---------- helpers ----------
  async function fetchJson(tryUrls){
    for (const u of tryUrls){
      try{
        const url = u + (u.includes("?") ? "&" : "?") + "t=" + Date.now();
        const r = await fetch(url, { cache: "no-store" });
        if (r.ok) return r.json();
      }catch(_){}
    }
    return null;
  }
  function loadDB(){
    try{
      const raw = localStorage.getItem("superhond-db");
      const db  = raw ? JSON.parse(raw) : {};
      // zowel db.classes als db.klassen ondersteunen
      db.classes = Array.isArray(db.classes) ? db.classes : [];
      db.klassen = Array.isArray(db.klassen) ? db.klassen : [];
      return db;
    }catch{ return { classes:[], klassen:[] }; }
  }
  function normalizeClasses(raw){
    const arr =
      Array.isArray(raw)           ? raw :
      Array.isArray(raw?.klassen)  ? raw.klassen :
      Array.isArray(raw?.classes)  ? raw.classes :
      Array.isArray(raw?.items)    ? raw.items :
      Array.isArray(raw?.data)     ? raw.data  : [];
    return arr.map(k => ({
      id: k.id ?? k.classId ?? k.klasId ?? null,
      naam: S(k.naam || k.name || ""),
      type: S(k.type || ""),
      thema: S(k.thema || k.theme || ""),
      strippen: Number(k.strippen ?? k.aantal_strips ?? 0) || 0,
      geldigheid_weken: Number(k.geldigheid_weken ?? k.geldigheid ?? 0) || 0,
      status: (S(k.status || "actief").toLowerCase())
    })).filter(k => k.id || k.naam);
  }
  function mergeById(primary=[], secondary=[]){
    const key = x => S(x.id) || S(x.naam);
    const map = new Map(secondary.map(x => [key(x), x])); // local eerst
    for (const p of primary) map.set(key(p), p);          // extern overschrijft
    return [...map.values()];
  }

  async function populateClassSelect(){
    const sel = $("#selKlas");
    if (!sel) return; // select ontbreekt in HTML

    // 1) extern: klassen.json (en fallback classes.json)
    const extRaw = await fetchJson([
      "../data/klassen.json", "/data/klassen.json",
      "../data/classes.json", "/data/classes.json"
    ]);
    const ext = normalizeClasses(extRaw);

    // 2) lokaal: db.classes + db.klassen
    const db = loadDB();
    const loc = normalizeClasses({ classes: (db.classes || []).concat(db.klassen || []) });

    // 3) merge + filter (alleen expliciet 'inactief' uitsluiten)
    const all = mergeById(ext, loc)
      .filter(k => k.status !== "inactief")
      .sort((a,b) => S(a.naam).localeCompare(S(b.naam)));

    // 4) vullen
    sel.innerHTML = ""; // clear
    if (all.length === 0){
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Geen klassen gevonden";
      sel.appendChild(opt);
      sel.disabled = true;
      return;
    }

    // placeholder
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "— Kies een klas —";
    sel.appendChild(ph);

    for (const k of all){
      const opt = document.createElement("option");
      opt.value = String(k.id || k.naam);
      // toon extra info in label
      const sub = [];
      if (k.type)  sub.push(k.type);
      if (k.thema) sub.push(k.thema);
      opt.textContent = sub.length ? `${k.naam} (${sub.join(" · ")})` : k.naam;

      // handige data-attributen voor auto-invulling/validatie
      opt.dataset.type   = k.type;
      opt.dataset.thema  = k.thema;
      opt.dataset.strip  = String(k.strippen || 0);
      opt.dataset.weken  = String(k.geldigheid_weken || 0);

      sel.appendChild(opt);
    }
    sel.disabled = false;
  }

  // --- optioneel: wanneer je bij keuze automatisch velden in de reeks wil invullen ---
  function bindClassAutofill(){
    const sel = $("#selKlas");
    if (!sel) return;
    sel.addEventListener("change", () => {
      const opt = sel.selectedOptions?.[0];
      if (!opt) return;
      // Vul velden in als ze leeg zijn (pas aan naar je eigen ids)
      const fldThema  = document.getElementById("thema");
      const fldNaamPkg= document.getElementById("pakNaam");   // pakket-naam
      if (fldThema && !S(fldThema.value)) fldThema.value = opt.dataset.thema || "";
      if (fldNaamPkg && !S(fldNaamPkg.value)) fldNaamPkg.value = opt.textContent || "";
      // Je kan hier ook strippen/geldigheid als “klant-info” tonen indien gewenst
    });
  }

  // ---- init ----
  document.addEventListener("DOMContentLoaded", async () => {
    await populateClassSelect();
    bindClassAutofill();
  });
})();
