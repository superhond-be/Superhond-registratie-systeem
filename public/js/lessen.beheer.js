// Superhond — Lessenbeheer (inline edit + agenda-export)
// Werkt met /js/lessen.store.js (API → /data → LocalStorage)

import {
  loadAll, saveLes, deleteLes,
  exportJSON, importJSON, lists
} from "/js/lessen.store.js";

const tbody      = document.querySelector("#tbl-lessen tbody");
const btnAdd     = document.getElementById("btn-add");
const btnExport  = document.getElementById("btn-export");
const btnAgenda  = document.getElementById("btn-agenda");
const fileImport = document.getElementById("file-import");
const totalEl    = document.getElementById("total");

let state = { lessen:[], reeksen:[], locaties:[], trainers:[] };

const S = v => String(v ?? "");

// helpers
const trainerName = t => [t?.voornaam, t?.achternaam].filter(Boolean).join(" ");
const sortByDate  = (a,b) => S(a.datum+a.start).localeCompare(S(b.datum+b.start));

function mapById(arr){ const m = new Map(); (arr||[]).forEach(x=>m.set(String(x.id), x)); return m; }
let mapLoc, mapTrainer, mapReeks;

// row builder
function row(les = {}) {
  const tr = document.createElement("tr");
  tr.dataset.id = les.id ?? "";

  tr.innerHTML = `
    <td>${lists.reeksSelect(state.reeksen, les.reeksId, les.naam)}</td>
    <td>${lists.typeSelect(les.type || "Groep")}</td>
    <td>${lists.locSelect(state.locaties, les.locatieId)}</td>
    <td>${lists.themaSelect(les.thema || "")}</td>
    <td>${lists.trainerSelect(state.trainers, les.trainerId)}</td>
    <td><input type="date" value="${S(les.datum)}" class="input"></td>
    <td><input type="time" value="${S(les.start)}" class="input"></td>
    <td><input type="number" min="1" value="${S(les.capaciteit ?? 8)}" class="input input-nr"></td>
    <td class="right nowrap">
      <button class="btn btn-xs" data-act="save" title="Bewaren">💾</button>
      <button class="btn btn-xs" data-act="del"  title="Verwijderen">🗑️</button>
    </td>
  `;

  return tr;
}

// verzamel waarden uit 1 rij
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
}

// ---- agenda export ----
function buildAgendaFromLessen(lessen) {
  // Verrijk met namen (handig voor dashboard/agenda)
  return (lessen || []).map(l => {
    const loc = l.locatieId != null ? mapLoc.get(String(l.locatieId)) : null;
    const trn = l.trainerId != null ? mapTrainer.get(String(l.trainerId)) : null;

    return {
      id: l.id,
      type: "les",
      naam: l.naam || (l.reeksId != null ? (mapReeks.get(String(l.reeksId))?.naam || "Onbekende reeks") : "Onbekende les"),
      datum: (l.datum || "1970-01-01") + "T" + (l.start || "00:00"),
      locatie: loc?.naam || "",
      trainer: trn ? trainerName(trn) : ""
    };
  });
}

/* events */
tbody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const tr = btn.closest("tr");
  const id = tr.dataset.id;

  if (btn.dataset.act === "save") {
    const payload = collect(tr);

    // minimale validatie
    if (!payload.datum || !payload.start) {
      alert("Datum en starttijd zijn verplicht.");
      return;
    }
    const saved = await saveLes(payload);
    tr.dataset.id = saved.id; // nieuwe id invullen
  }

  if (btn.dataset.act === "del") {
    if (!id) { tr.remove(); return; }
    if (!confirm("Les verwijderen?")) return;
    await deleteLes(id);
    tr.remove();
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

btnAgenda.addEventListener("click", () => {
  const agenda = buildAgendaFromLessen(state.lessen);
  exportJSON(agenda, "agenda.json");
});

fileImport.addEventListener("change", async () => {
  const f = fileImport.files[0];
  if (!f) return;
  const text = await f.text();
  const data = JSON.parse(text);
  state.lessen = await importJSON(data);
  render();
});

// init
(async function init(){
  try {
    state = await loadAll(); // {lessen, reeksen, locaties, trainers}
    mapLoc    = mapById(state.locaties);
    mapTrainer= mapById(state.trainers);
    mapReeks  = mapById(state.reeksen);
    render();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="9" class="error">⚠️ Kon lessen niet laden: ${S(e.message)}</td></tr>`;
  }
})();
