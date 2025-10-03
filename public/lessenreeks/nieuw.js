// Nieuwe lessenreeks – klassen laden + autofill + zichtbare debug
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? "").trim();

  /* ---------------- snelle helpers (voor performance/consistency) ---------------- */
  const pad = n => String(n).padStart(2, "0");
  function parseDateYMD(ymd) {
    const [y,m,d] = String(ymd||"").split("-").map(Number);
    return new Date(y||1970, (m||1)-1, d||1);
  }
  function addDays(date, days) {
    const d = new Date(date.getTime());
    d.setDate(d.getDate() + Number(days||0));
    return d;
  }
  function combineISO(date, hhmm) {
    const y = date.getFullYear(), m = pad(date.getMonth()+1), d = pad(date.getDate());
    const [hh="00", mm="00"] = String(hhmm||"").split(":");
    return `${y}-${m}-${d}T${pad(hh)}:${pad(mm)}:00`;
  }
  function addMinutesToHHmm(hhmm, minutes) {
    const [h=0,m=0] = String(hhmm||"0:0").split(":").map(Number);
    const total = h*60 + m + Number(minutes||0);
    const H = Math.floor(((total % 1440)+1440)%1440 / 60);
    const M = ((total % 60) + 60) % 60;
    return `${pad(H)}:${pad(M)}`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title: "Nieuwe lessenreeks", icon: "📦", back: "./" });
    }
    init();
  });

  async function init(){
    await populateClassSelect();
    bindClassAutofill();
  }

  /* ---------------- helpers ---------------- */
  function report(msg, isError=false){
    const hint = $("#classesHint");
    const err  = $("#classesError");
    if (!hint && !err) return; // geen hint-/error-plek in de HTML: gewoon stil zijn
    if (isError){
      if (err){ err.style.display = "block"; err.textContent = msg; }
      if (hint){ hint.textContent = ""; }
    } else {
      if (err){ err.style.display = "none"; err.textContent = ""; }
      if (hint){ hint.textContent = msg; }
    }
  }

  async function fetchJson(tryUrls){
    for (const u of tryUrls){
      try{
        const url = u + (u.includes("?")?"&":"?") + "t=" + Date.now();
        const r = await fetch(url, { cache:"no-store" });
        if (r.ok) return r.json();
      }catch(_){}
    }
    return null;
  }

  function loadDB(){
    try{
      const raw = localStorage.getItem("superhond-db");
      const db  = raw ? JSON.parse(raw) : {};
      db.classes = Array.isArray(db.classes) ? db.classes : [];
      db.klassen = Array.isArray(db.klassen) ? db.klassen : [];
      return db;
    }catch{
      return { classes:[], klassen:[] };
    }
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
      status: S(k.status || "actief").toLowerCase()
    })).filter(k => (k.id || k.naam));
  }

  function mergeById(primary=[], secondary=[]){
    const key = x => S(x.id) || S(x.naam);
    const map = new Map(secondary.map(x => [key(x), x])); // local eerst
    for (const p of primary) map.set(key(p), p);          // extern overschrijft
    return [...map.values()];
  }

  /* --------------- populate select --------------- */
  async function populateClassSelect(){
    const sel = $("#selKlas");
    if (!sel) return;

    report("Klassen laden…");

    // 1) extern
    const extRaw = await fetchJson([
      "../data/klassen.json", "/data/klassen.json",
      "../data/classes.json", "/data/classes.json"
    ]);
    const ext = normalizeClasses(extRaw);

    // 2) lokaal
    const db  = loadDB();
    const loc = normalizeClasses({ classes:[...db.classes, ...db.klassen] });

    // 3) merge + filter
    const all = mergeById(ext, loc)
      .filter(k => k.status !== "inactief")
      .sort((a,b) => S(a.naam).localeCompare(S(b.naam)));

    // 4) UI
    sel.innerHTML = "";
    if (all.length === 0){
      const o = document.createElement("option");
      o.value = "";
      o.textContent = "— Geen klassen gevonden —";
      sel.appendChild(o);
      sel.disabled = true;

      const extCnt = ext.length, locCnt = loc.length;
      const why = [
        `gevonden extern: ${extCnt}`,
        `gevonden lokaal: ${locCnt}`,
        `gefilterd (inactief): ${extCnt + locCnt - all.length}`
      ].join(" • ");
      report(`Geen klassen beschikbaar. (${why})`, true);

      console.warn("Plaats /public/data/klassen.json met bv.:", {
        klassen: [
          { id:"klas-001", naam:"Puppy start", type:"start", thema:"Puppypack",
            strippen:10, geldigheid_weken:12, status:"actief" }
        ]
      });
      return;
    }

    sel.disabled = false;

    // placeholder
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "— Kies een klas —";
    sel.appendChild(ph);

    // opties
    for (const k of all){
      const parts = [];
      if (k.type)  parts.push(k.type);
      if (k.thema) parts.push(k.thema);
      const label = parts.length ? `${k.naam} (${parts.join(" · ")})` : k.naam;

      const opt = document.createElement("option");
      opt.value = String(k.id || k.naam);
      opt.textContent = label;
      opt.dataset.type  = k.type;
      opt.dataset.thema = k.thema;
      opt.dataset.strip = String(k.strippen || 0);
      opt.dataset.weken = String(k.geldigheid_weken || 0);
      sel.appendChild(opt);
    }

    report(`${all.length} klas(sen) geladen. Kies er één om velden in te vullen.`);
  }

  /* --------------- autofill --------------- */
  function bindClassAutofill(){
    const sel = $("#selKlas");
    if (!sel) return;
    sel.addEventListener("change", () => {
      const opt = sel.selectedOptions?.[0];
      if (!opt) return;

      const fldType  = $("#type");
      const fldThema = $("#thema");
      const fldStrip = $("#strippen");
      const fldGeld  = $("#geldigheid");
      const fldPkg   = $("#pakNaam");

      if (fldType && !S(fldType.value))  fldType.value  = opt.dataset.type  || "";
      if (fldThema && !S(fldThema.value))fldThema.value = opt.dataset.thema || "";

      if (fldStrip) fldStrip.value = Number(opt.dataset.strip || 0);
      if (fldGeld)  fldGeld.value  = Number(opt.dataset.weken || 0);

      if (fldPkg && !S(fldPkg.value)){
        const txt = String(opt.textContent||"");
        // haal " (…)" achteraan weg indien aanwezig
        fldPkg.value = txt.replace(/\s\([^)]+\)$/, "");
      }
    });
  }
})();
