
import { generateLessons } from "/js/lessen.reeks.generator.js";
import { loadAll, saveLes } from "/js/lessen.store.js";


async function generateForReeks(reeksId){
  const all = await loadAll(); // {pakketten, reeksen, locaties, trainers, lessen}
  const reeks  = all.reeksen.find(r => String(r.id)===String(reeksId));
  const pakket = all.pakketten.find(p => String(p.id)===String(reeks.lessenpakketId));
  const lessons = generateLessons({ reeks, pakket });
  for (const l of lessons) await saveLes(l);
  state = await loadAll();
  render();
}

if (btn.dataset.act === "gen") {
  const id = tr.dataset.id || collect(tr).reeksId;
  await generateForReeks(id);
  alert("Reeks gegenereerd 👍");
}
// Superhond — Lessenbeheer (inline edit + auto agenda export + reeksgeneratie)
import {
  loadAll, saveLes, deleteLes,
  exportJSON, importJSON, lists
} from "/js/lessen.store.js";

const table      = document.getElementById("tbl-lessen");
const tbody      = table.querySelector("tbody");
const btnAdd     = document.getElementById("btn-add");
const btnExport  = document.getElementById("btn-export");
const btnReeksGen= document.getElementById("btn-reeks-gen");
const fileImport = document.getElementById("file-import");
const totalEl    = document.getElementById("total");

// Dialog UI
const dlgReeks   = document.getElementById("dlg-reeks");
const formReeks  = document.getElementById("form-reeks");
const selReeks   = document.getElementById("sel-reeks");
const regenStart = document.getElementById("regen-start");
const regenClear = document.getElementById("regen-clear");
const regenCancel= document.getElementById("regen-cancel");
const regenMsg   = document.getElementById("regen-msg");

let state = { lessen:[], reeksen:[], locaties:[], trainers:[] };

const S = v => String(v ?? "");
const pad2 = n => String(n).padStart(2,"0");

function trainerName(t){ return [t?.voornaam, t?.achternaam].filter(Boolean).join(" "); }
function sortByDate(a,b){ return S(a.datum+a.start).localeCompare(S(b.datum+b.start)); }

function mapById(arr){ const m = new Map(); (arr||[]).forEach(x=>m.set(String(x.id), x)); return m; }
let mapLoc, mapTrainer, mapReeks;

// ------ tijd/datum helpers ------
function addDays(dateISO, days){
  const x = new Date(dateISO); x.setDate(x.getDate()+days); return x.toISOString().slice(0,10);
}
function timeAdd(hhmm, minutes){
  const [h,m] = (hhmm||"10:00").split(":").map(Number);
  const dt = new Date(2000,0,1,h,m,0,0);
  dt.setMinutes(dt.getMinutes() + (minutes||0));
  return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

// ------ field helpers (camel/snake tolerant) ------
function getField(obj, ...names){
  for (const n of names){
    if (obj && obj[n] != null) return obj[n];
  }
  return undefined;
}

// ------ rij opbouwen ------
function row(les = {}) {
  const tr = document.createElement("tr");
  tr.dataset.id = les.id ?? "";

  tr.innerHTML = `
    <td>${lists.reeksSelect(state.reeksen, getField(les,"reeksId","reeks_id"), les.naam)}</td>
    <td>${lists.typeSelect(les.type || "Groep")}</td>
    <td>${lists.locSelect(state.locaties, getField(les,"locatieId","locatie_id"))}</td>
    <td>${lists.themaSelect(les.thema || "")}</td>
    <td>${lists.trainerSelect(state.trainers, getField(les,"trainerId","trainer_id"))}</td>
    <td><input type="date" value="${S(les.datum)}" class="input"></td>
    <td><input type="time" value="${S(getField(les,"start","starttijd"))}" class="input"></td>
    <td><input type="number" min="1" value="${S(getField(les,"capaciteit","max_deelnemers") ?? 8)}" class="input input-nr"></td>
    <td class="right nowrap">
      <button class="btn btn-xs" data-act="save" title="Bewaren">💾</button>
      <button class="btn btn-xs" data-act="del"  title="Verwijderen">🗑️</button>
    </td>
    <td class="right nowrap">
      <button class="btn btn-xs" data-act="regen" title="Genereer voor deze reeks">♻️</button>
    </td>
  `;
  return tr;
}

// ------ waarden uit 1 rij halen ------
function collect(tr){
  const [selReeks, selType, selLoc, selThema, selTrainer, inpDate, inpTime, inpCap] =
    tr.querySelectorAll("select, input");

  return {
    id: tr.dataset.id || undefined,
    reeksId: Number(selReeks.value) || null,
    naam: lists.textFromReeks(selReeks),          // gekozen reeksnaam
    type: selType.value || "Groep",
    locatieId: Number(selLoc.value) || null,
    thema: selThema.value || "",
    trainerId: Number(selTrainer.value) || null,
    datum: inpDate.value,
    start: inpTime.value,
    capaciteit: Number(inpCap.value) || 8,
    status: "actief"
  };
}

function render(){
  tbody.innerHTML = "";
  state.lessen.sort(sortByDate).forEach(les => tbody.appendChild(row(les)));
  totalEl.textContent = `${state.lessen.length} lessen`;
  // na render ook agenda auto updaten (zekerheid als data uit LS komt)
  autoUpdateAgenda();
}

// ---- agenda builder + auto-export ----
function buildAgendaFromLessen(lessen) {
  return (lessen || []).map(l => {
    const loc = getField(l,"locatieId","locatie_id") != null ? mapLoc.get(String(getField(l,"locatieId","locatie_id"))) : null;
    const trn = getField(l,"trainerId","trainer_id") != null ? mapTrainer.get(String(getField(l,"trainerId","trainer_id"))) : null;

    return {
      id: l.id,
      type: "les",
      naam: l.naam || (getField(l,"reeksId","reeks_id") != null
              ? (mapReeks.get(String(getField(l,"reeksId","reeks_id")))?.naam || "Onbekende reeks")
              : "Onbekende les"),
      datum: (l.datum || "1970-01-01") + "T" + (getField(l,"start","starttijd") || "00:00"),
      locatie: loc?.naam || "",
      trainer: trn ? trainerName(trn) : ""
    };
  });
}

function autoUpdateAgenda(){
  try{
    const agenda = buildAgendaFromLessen(state.lessen);
    // Client-side download van agenda.json (zonder backend write)
    exportJSON(agenda, "agenda.json");
  }catch(err){
    console.error("Auto agenda export mislukte:", err);
  }
}

/* ----------------- Reeks → Lessen generator ----------------- */

function deriveParamsFromReeks(reeks, startHHMM){
  return {
    id: getField(reeks,"id"),
    naam: getField(reeks,"naam"),
    startdatum: getField(reeks,"startdatum"),
    starttijd: startHHMM || getField(reeks,"starttijd") || "10:00",
    aantal: Number(getField(reeks,"aantalStrippen","aantal_strippen")) || 1,
    duur: Number(getField(reeks,"lesduurMinuten","lesduur_minuten")) || 60,
    max: Number(getField(reeks,"maxDeelnemers","max_deelnemers")) || 8,
    trainerId: Number(getField(reeks,"trainerId","trainer_id")) || null,
    locatieId: Number(getField(reeks,"locatieId","locatie_id")) || null
  };
}

async function deleteLessonsOfReeks(reeksId){
  const toDel = (state.lessen||[]).filter(l => String(getField(l,"reeksId","reeks_id")) === String(reeksId));
  for (const l of toDel) { try { await deleteLes(l.id); } catch {} }
  state.lessen = state.lessen.filter(l => String(getField(l,"reeksId","reeks_id")) !== String(reeksId));
}

async function generateLessonsForReeks(reeks, startHHMM, clearBefore = true){
  const p = deriveParamsFromReeks(reeks, startHHMM);
  if (!p.startdatum) throw new Error("Reeks heeft geen startdatum.");
  if (!p.aantal) throw new Error("Aantal lessen is 0.");
  if (clearBefore) { await deleteLessonsOfReeks(p.id); }

  const created = [];
  for (let i=0;i<p.aantal;i++){
    const datum = addDays(p.startdatum, i*7);
    const payload = {
      reeksId: Number(p.id) || p.id,
      naam: p.naam,
      type: "Groep",
      locatieId: p.locatieId,
      thema: "",
      trainerId: p.trainerId,
      datum,
      start: p.starttijd,
      capaciteit: p.max,
      status: "actief"
    };
    const saved = await saveLes(payload);
    created.push(saved);
  }
  // refresh & render
  const fresh = await loadAll();
  state.lessen = fresh.lessen || created;
  render();
  // auto agenda update na genereren
  autoUpdateAgenda();
  return created.length;
}

/* ----------------- Events ----------------- */

// table row actions
tbody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const tr = btn.closest("tr");
  const id = tr.dataset.id;

  if (btn.dataset.act === "save") {
    const payload = collect(tr);
    if (!payload.datum || !payload.start) {
      alert("Datum en starttijd zijn verplicht.");
      return;
    }
    const saved = await saveLes(payload);
    tr.dataset.id = saved.id;
    autoUpdateAgenda(); // ⟵ na opslaan
  }

  if (btn.dataset.act === "del") {
    if (!id) { tr.remove(); autoUpdateAgenda(); return; }
    if (!confirm("Les verwijderen?")) return;
    await deleteLes(id);
    tr.remove();
    // sync lokale state
    state.lessen = state.lessen.filter(x => String(x.id)!==String(id));
    autoUpdateAgenda(); // ⟵ na verwijderen
  }

  if (btn.dataset.act === "regen") {
    // per-rij genereren: gebruik de geselecteerde reeks in deze rij
    const sel = tr.querySelector("td select"); // eerste select = reeks
    const reeksId = sel?.value;
    if (!reeksId) { alert("Kies eerst een reeks in deze rij."); return; }
    const reeks = state.reeksen.find(r => String(r.id) === String(reeksId));
    if (!reeks) { alert("Reeks niet gevonden."); return; }

    const startHHMM = prompt("Starttijd HH:MM?", "10:00") || "10:00";
    const clear = confirm("Bestaande lessen van deze reeks eerst verwijderen?");
    try {
      const n = await generateLessonsForReeks(reeks, startHHMM, clear);
      alert(`♻️ ${n} lessen gegenereerd voor reeks: ${reeks.naam}`);
    } catch(e){
      alert("Fout bij genereren: " + e.message);
    }
  }
});

btnAdd.addEventListener("click", () => {
  const nieuw = { capaciteit: 8, type:"Groep" };
  const tr = row(nieuw);
  tbody.prepend(tr);
  tr.querySelector("select, input")?.focus();
});

btnExport.addEventListener("click", () => {
  exportJSON(state.lessen, "lessen.json");
  // je exporteert lessen handmatig; agenda wordt sowieso auto geüpdatet bij wijzigingen
});

fileImport.addEventListener("change", async () => {
  const f = fileImport.files[0];
  if (!f) return;
  const text = await f.text();
  const data = JSON.parse(text);
  state.lessen = await importJSON(data);
  render();
  autoUpdateAgenda(); // ⟵ na import
});

// ---- dialoog (globale) generator ----
btnReeksGen.addEventListener("click", () => {
  selReeks.innerHTML = (state.reeksen||[]).map(r => `<option value="${r.id}">${S(r.naam)||("Reeks "+r.id)}</option>`).join("");
  regenMsg.textContent = "";
  dlgReeks.showModal();
});
regenCancel.addEventListener("click", ()=> dlgReeks.close());

formReeks.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const reeksId = selReeks.value;
  const reeks = state.reeksen.find(r => String(r.id)===String(reeksId));
  if (!reeks) { regenMsg.textContent = "Reeks niet gevonden."; return; }
  try {
    const n = await generateLessonsForReeks(reeks, regenStart.value || "10:00", !!regenClear.checked);
    regenMsg.textContent = `✅ ${n} lessen gegenereerd voor reeks “${S(reeks.naam)}”.`;
  } catch (err) {
    regenMsg.textContent = "⚠️ " + err.message;
  }
});

// init
(async function init(){
  try {
    state = await loadAll(); // {lessen, reeksen, locaties, trainers}
    mapLoc     = mapById(state.locaties);
    mapTrainer = mapById(state.trainers);
    mapReeks   = mapById(state.reeksen);
    render();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="10" class="error">⚠️ Kon lessen niet laden: ${S(e.message)}</td></tr>`;
  }
})();
