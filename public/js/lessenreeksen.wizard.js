// Reeks-wizard (demo): maakt een reeks + genereert wekelijkse lessen
// Slaat op in LocalStorage via kleine store-functies
import { loadCatalog } from "/js/catalog.store.js";

const frm = document.getElementById("frm");
const selPakket = document.getElementById("pakket");
const inpNaam   = document.getElementById("naam");
const inpStartD = document.getElementById("startdatum");
const inpStartT = document.getElementById("starttijd");
const selTrainer= document.getElementById("trainer");
const selLoc    = document.getElementById("locatie");
const selStatus = document.getElementById("status");
const inpAantal = document.getElementById("aantal");
const inpDuur   = document.getElementById("lesduur");
const inpMax    = document.getElementById("max");
const inpWkn    = document.getElementById("wkn");
const btnDemo   = document.getElementById("btn-demo");
const msg       = document.getElementById("msg");

const prevBody  = document.getElementById("preview-body");

let state = { pakketten:[], trainers:[], locaties:[], reeksen:[], lessen:[] };

const S = v => String(v ?? "");

// ---- Local demo store (LS) ----
const LS = {
  reeksen: "sh_reeksen",
  lessen:  "sh_lessen",
};
const lsGet = (k,f=[])=>{ try{return JSON.parse(localStorage.getItem(k)) ?? f;}catch{return f;} };
const lsSet = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

function idNew(){ return String(Date.now()) + "-" + Math.floor(Math.random()*1000); }

function byId(list, id){ return (list||[]).find(x => String(x.id) === String(id)); }
function nameTrainer(t){ return [t?.voornaam, t?.achternaam].filter(Boolean).join(" "); }
function nameLoc(l){ return l?.naam || ""; }

function pad(n){ return n.toString().padStart(2,"0"); }
function addDays(d, plus){
  const x = new Date(d); x.setDate(x.getDate()+plus); return x;
}
function toISODate(d){ return d.toISOString().slice(0,10); }
function timeAdd(startHHMM, minutes){
  const [h,m] = startHHMM.split(":").map(Number);
  const dt = new Date(2000,0,1,h,m,0,0);
  dt.setMinutes(dt.getMinutes()+minutes);
  return `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function fillSelect(sel, items, mkText, mkVal){
  sel.innerHTML = items.map(x => `<option value="${mkVal(x)}">${mkText(x)}</option>`).join("");
}

function takeDefaultsFromPakket(){
  const p = byId(state.pakketten, selPakket.value);
  if (!p) return;
  inpAantal.value = p.aantal_strippen ?? 8;
  inpDuur.value   = p.lesduur_minuten ?? 60;
  inpMax.value    = p.max_deelnemers ?? 8;
  inpWkn.value    = p.geldigheidsduur_weken ?? 12;
  if (!inpNaam.value.trim()) inpNaam.value = `${p.naam} – Reeks`;
  renderPreview();
}

function renderPreview(){
  const p = byId(state.pakketten, selPakket.value); if(!p){ prevBody.innerHTML=""; return; }
  const t = byId(state.trainers,  selTrainer.value);
  const l = byId(state.locaties,  selLoc.value);

  const cnt  = Math.max(1, Number(inpAantal.value||p.aantal_strippen||1));
  const duur = Math.max(1, Number(inpDuur.value||p.lesduur_minuten||60));
  const d0   = inpStartD.value;
  const t0   = inpStartT.value || "10:00";

  let rows = "";
  for (let i=0;i<cnt;i++){
    const d = addDays(d0, i*7);
    const dat = d instanceof Date ? d : new Date(d);
    const dStr = toISODate(dat);
    const end  = timeAdd(t0, duur);
    rows += `<tr>
      <td>${i+1}</td>
      <td>${dStr}</td>
      <td>${t0}</td>
      <td>${end}</td>
      <td>${S(nameTrainer(t))}</td>
      <td>${S(nameLoc(l))}</td>
    </tr>`;
  }
  prevBody.innerHTML = rows;
}

function saveReeksAndLessons(payload){
  // haal huidige LS
  const reeksen = lsGet(LS.reeksen, state.reeksen);
  const lessen  = lsGet(LS.lessen,  state.lessen);

  // reeks
  const id = idNew();
  const reeks = {
    id,
    pakket_id: payload.pakket_id,
    klas_id: payload.klas_id,
    naam: payload.naam,
    type: payload.type,
    thema: payload.thema,
    aantal_strippen: payload.aantal_strippen,
    geldigheidsduur_weken: payload.geldigheidsduur_weken,
    startdatum: payload.startdatum,
    max_deelnemers: payload.max_deelnemers,
    lesduur_minuten: payload.lesduur_minuten,
    status: payload.status,
    bevestigd_door_admin: payload.status === "actief"
  };
  reeksen.push(reeks);

  // lessen genereren
  const newLessons = [];
  for (let i=0;i<payload.aantal_strippen;i++){
    const d = addDays(payload.startdatum, i*7);
    const datum = toISODate(d);
    const start = payload.starttijd;
    const einde = timeAdd(start, payload.lesduur_minuten);
    newLessons.push({
      id: idNew(),
      reeks_id: id,
      datum, start, einde,
      trainer_id: payload.trainer_id,
      locatie_id: payload.locatie_id,
      specificatie: `${(payload.naam||"REeks").slice(0,3).toUpperCase()}-${pad(i+1)}`,
      status: "actief"
    });
  }

  // bewaar
  lsSet(LS.reeksen, reeksen);
  lsSet(LS.lessen,  [...lessen, ...newLessons]);

  // update local state (zodat planner die meteen ziet als dezelfde sessie open blijft)
  state.reeksen = reeksen;
  state.lessen  = lsGet(LS.lessen, []);

  return { reeks, lessons: newLessons };
}

frm.addEventListener("change", renderPreview);
frm.addEventListener("input", renderPreview);

frm.addEventListener("submit", (e)=>{
  e.preventDefault();
  const p = byId(state.pakketten, selPakket.value);
  if(!p){ alert("Kies eerst een pakket."); return; }

  const payload = {
    pakket_id: p.id,
    klas_id: p.klas_id,
    naam: inpNaam.value.trim() || `${p.naam} – Reeks`,
    type: p.type || "",
    thema: p.thema || "",
    aantal_strippen: Number(inpAantal.value || p.aantal_strippen || 1),
    geldigheidsduur_weken: Number(inpWkn.value || p.geldigheidsduur_weken || 0),
    startdatum: inpStartD.value,
    starttijd: inpStartT.value || "10:00",
    max_deelnemers: Number(inpMax.value || p.max_deelnemers || 1),
    lesduur_minuten: Number(inpDuur.value || p.lesduur_minuten || 60),
    trainer_id: Number(selTrainer.value),
    locatie_id: Number(selLoc.value),
    status: selStatus.value || "actief"
  };

  if(!payload.startdatum){ alert("Startdatum is verplicht."); return; }

  const { reeks, lessons } = saveReeksAndLessons(payload);
  msg.textContent = `✅ Reeks “${reeks.naam}” aangemaakt met ${lessons.length} lessen.`;
});

btnDemo.addEventListener("click", ()=>{
  // Zo weinig mogelijk invulwerk: pak pakket[0], trainer[0], locatie[0], start = volgende zondag 10:00
  const p = state.pakketten[0]; if(!p){ alert("Geen pakketten gevonden."); return; }
  const t = state.trainers[0];  if(!t){ alert("Geen trainers gevonden."); return; }
  const l = state.locaties[0];  if(!l){ alert("Geen locaties gevonden."); return; }

  // volgende zondag:
  const d = new Date(); const dow = d.getDay(); const add = (7 - dow) % 7; d.setDate(d.getDate()+add);
  const startdatum = toISODate(d);

  const payload = {
    pakket_id: p.id, klas_id: p.klas_id,
    naam: `${p.naam} – DEMO`,
    type: p.type || "", thema: p.thema || "",
    aantal_strippen: p.aantal_strippen || 6,
    geldigheidsduur_weken: p.geldigheidsduur_weken || 12,
    startdatum, starttijd: "10:00",
    max_deelnemers: p.max_deelnemers || 8,
    lesduur_minuten: p.lesduur_minuten || 60,
    trainer_id: t.id, locatie_id: l.id,
    status: "actief"
  };

  const { reeks, lessons } = saveReeksAndLessons(payload);
  msg.textContent = `🎉 DEMO reeks “${reeks.naam}” toegevoegd (${lessons.length} lessen). Open de planner om te bekijken.`;
});

// init
(async function init(){
  const all = await loadCatalog(); // uit catalog.store.js
  state.pakketten = all.pakketten || [];
  state.trainers  = all.trainers  || [];
  state.locaties  = all.locaties  || [];
  state.reeksen   = all.reeksen   || [];
  state.lessen    = all.lessen    || [];

  fillSelect(selPakket, state.pakketten, p => p.naam, p => p.id);
  fillSelect(selTrainer, state.trainers, t => nameTrainer(t), t => t.id);
  fillSelect(selLoc, state.locaties, l => l.naam, l => l.id);

  // defaults
  if (state.pakketten.length) selPakket.value = state.pakketten[0].id;
  takeDefaultsFromPakket();

  // handige default startdatum = vandaag
  const today = new Date().toISOString().slice(0,10);
  inpStartD.value = today;

  renderPreview();
})();
