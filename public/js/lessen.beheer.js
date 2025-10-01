// Superhond — Lessenbeheer (inline edit)
// Werkt met /js/lessen.store.js (API → /data → LocalStorage)

import {
  loadAll, saveLes, deleteLes,
  exportJSON, importJSON, lists
} from "/js/lessen.store.js";

const tbody      = document.querySelector("#tbl-lessen tbody");
const btnAdd     = document.getElementById("btn-add");
const btnExport  = document.getElementById("btn-export");
const fileImport = document.getElementById("file-import");
const totalEl    = document.getElementById("total");

let state = { lessen:[], reeksen:[], locaties:[], trainers:[] };

const S = v => String(v ?? "");

// helpers
function trainerName(t){ return [t?.voornaam, t?.achternaam].filter(Boolean).join(" "); }
function sortByDate(a,b){
  return S(a.datum+a.start).localeCompare(S(b.datum+b.start));
}

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
    naam: lists.textFromReeks(selReeks),          // toont gekozen reeksnaam
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
  // focus eerste input
  const firstEditable = tr.querySelector("select, input");
  firstEditable?.focus();
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

// init
(async function init(){
  try {
    state = await loadAll(); // {lessen, reeksen, locaties, trainers}
    render();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="9" class="error">⚠️ Kon lessen niet laden: ${S(e.message)}</td></tr>`;
  }
})();
