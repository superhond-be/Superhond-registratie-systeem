// Superhond — Lessenbeheer (inline edit + auto agenda export + reeksgeneratie)

import { generateLessons } from "/js/lessen.reeks.generator.js";
import {
  loadAll, saveLes, deleteLes,
  exportJSON, importJSON, lists
} from "/js/lessen.store.js";

/* ====== DOM ====== */
const table      = document.getElementById("tbl-lessen");
const tbody      = table.querySelector("tbody");
const btnAdd     = document.getElementById("btn-add");
const btnExport  = document.getElementById("btn-export");
const btnReeksGen= document.getElementById("btn-reeks-gen");
const fileImport = document.getElementById("file-import");
const totalEl    = document.getElementById("total");

// Dialog (globale generator)
const dlgReeks   = document.getElementById("dlg-reeks");
const formReeks  = document.getElementById("form-reeks");
const selReeks   = document.getElementById("sel-reeks");
const regenStart = document.getElementById("regen-start");
const regenClear = document.getElementById("regen-clear");
const regenCancel= document.getElementById("regen-cancel");
const regenMsg   = document.getElementById("regen-msg");

/* ====== STATE ====== */
let state = { lessen:[], reeksen:[], locaties:[], trainers:[] };
const S    = v => String(v ?? "");
const pad2 = n => String(n).padStart(2,"0");

/* ====== helpers ====== */
function trainerName(t){ return [t?.voornaam, t?.achternaam].filter(Boolean).join(" "); }
function sortByDate(a,b){ return S(a.datum+a.start).localeCompare(S(b.datum+b.start)); }
function mapById(arr){ const m = new Map(); (arr||[]).forEach(x=>m.set(String(x.id), x)); return m; }
let mapLoc, mapTrainer, mapReeks;

function addDays(dateISO, days){
  const x = new Date(dateISO); x.setDate(x.getDate()+days); return x.toISOString().slice(0,10);
}
function getField(obj, ...names){
  for (const n of names){ if (obj && obj[n] != null) return obj[n]; }
  return undefined;
}

/* ====== rij opbouwen ====== */
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
      <button class="btn btn-xs" data-act="save"  title="Bewaren">💾</button>
      <button class="btn btn-xs" data-act="del"   title="Verwijderen">🗑️</button>
      <button class="btn btn-xs" data-act="regen" title="Genereren voor deze reeks">♻️</button>
    </td>
  `;
  return tr;
}

function collect(tr){
  const [selReeks, selType, selLoc, selThema, selTrainer, inpDate, inpTime, inpCap] =
    tr.querySelectorAll("select, input");

  return {
    id: tr.dataset.id || undefined,
    reeksId: Number(selReeks.value) || null,
    naam: lists.textFromReeks(selReeks),
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
  autoUpdateAgenda(); // zeker voor LS/JSON flows
}

/* ====== agenda ====== */
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
    exportJSON(agenda, "agenda.json"); // client-side download
  }catch(err){
    console.error("Auto agenda export mislukte:", err);
  }
}

/* ====== reeksgeneratie ====== */
async function deleteLessonsOfReeks(reeksId){
  const toDel = (state.lessen||[]).filter(l => String(getField(l,"reeksId","reeks_id")) === String(reeksId));
  for (const l of toDel) { try { await deleteLes(l.id); } catch {} }
  state.lessen = state.lessen.filter(l => String(getField(l,"reeksId","reeks_id")) !== String(reeksId));
}

async function generateLessonsForReeks(reeks, startHHMM, clearBefore = true){
  // gebruik de generator-module (starttijd + lesduur → eindtijd)
  const pakket = {}; // niet nodig voor nu; velden zitten in 'reeks' of defaulten in store
  const lessons = generateLessons({ reeks: {
    id: reeks.id,
    naam: reeks.naam,
    type: reeks.type,
    startdatum: reeks.startdatum,
    starttijd: startHHMM || reeks.starttijd || "10:00",
    lesduurMinutenOverride: reeks.lesduurMinuten || reeks.lesduurMinutenOverride,
    maxDeelnemersOverride:  reeks.maxDeelnemers  || reeks.maxDeelnemersOverride,
    locatieId: reeks.locatieId,
    trainerIds: Array.isArray(reeks.trainerIds) ? reeks.trainerIds
               : (reeks.trainerId!=null ? [reeks.trainerId] : [])
  }, pakket });

  if (clearBefore) await deleteLessonsOfReeks(reeks.id);

  for (const l of lessons) await saveLes(l);

  // refresh
  state = await loadAll();
  render();
  return lessons.length;
}

/* ====== events ====== */
tbody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const tr = btn.closest("tr");
  const id = tr.dataset.id;

  if (btn.dataset.act === "save") {
    const payload = collect(tr);
    if (!payload.datum || !payload.start) { alert("Datum en starttijd zijn verplicht."); return; }
    const saved = await saveLes(payload);
    tr.dataset.id = saved.id;
    autoUpdateAgenda();
  }

  if (btn.dataset.act === "del") {
    if (!id) { tr.remove(); autoUpdateAgenda(); return; }
    if (!confirm("Les verwijderen?")) return;
    await deleteLes(id);
    tr.remove();
    state.lessen = state.lessen.filter(x => String(x.id)!==String(id));
    autoUpdateAgenda();
  }

  if (btn.dataset.act === "regen") {
    const sel = tr.querySelector("td select"); // eerste select = reeks
    const reeksId = sel?.value;
    if (!reeksId) { alert("Kies eerst een reeks in deze rij."); return; }
    const reeks = state.reeksen.find(r => String(r.id) === String(reeksId));
    if (!reeks) { alert("Reeks niet gevonden."); return; }

    const startHHMM = prompt("Starttijd HH:MM?", "10:00") || "10:00";
    const clear = confirm("Bestaande lessen van deze reeks eerst verwijderen?");
    try {
      const n = await generateLessonsForReeks(reeks, startHHMM, clear);
      alert(`♻️ ${n} lessen gegenereerd voor reeks “${S(reeks.naam)}”.`);
    } catch(e){ alert("Fout bij genereren: " + e.message); }
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
});

fileImport.addEventListener("change", async () => {
  const f = fileImport.files[0];
  if (!f) return;
  const text = await f.text();
  const data = JSON.parse(text);
  state.lessen = await importJSON(data);
  render();
});

/* ==== globale reeksgenerator (dialoog) ==== */
if (btnReeksGen) {
  btnReeksGen.addEventListener("click", () => {
    selReeks.innerHTML = (state.reeksen||[]).map(r => `<option value="${r.id}">${S(r.naam)||("Reeks "+r.id)}</option>`).join("");
    regenMsg.textContent = "";
    dlgReeks.showModal();
  });
}
if (regenCancel) regenCancel.addEventListener("click", ()=> dlgReeks.close());
if (formReeks) {
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
}

/* ====== init ====== */
(async function init(){
  try {
    state = await loadAll(); // {lessen, reeksen, locaties, trainers}
    mapLoc     = mapById(state.locaties);
    mapTrainer = mapById(state.trainers);
    mapReeks   = mapById(state.reeksen);
    render();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="9" class="error">⚠️ Kon lessen niet laden: ${S(e.message)}</td></tr>`;
  }
})();
