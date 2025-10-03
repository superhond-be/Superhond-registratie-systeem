import { loadCatalog, saveKlas, deleteKlas, lists, S } from "/js/catalog.store.js";

const tbody = document.querySelector("#tbl tbody");
const btnAdd = document.getElementById("btn-add");
const total  = document.getElementById("total");

let state = { klassen:[] };
import { getKlassen, setKlassen, ensureMigrated } from '../js/store.js';

document.addEventListener('DOMContentLoaded', ensureMigrated);

// ...bij opslaan:
const items = getKlassen();
const i = items.findIndex(x => String(x.id) === String(klas.id));
if (i >= 0) items[i] = klas; else items.push(klas);
setKlassen(items);   // <-- alleen deze bucket
function row(k={}) {
  const tr = document.createElement("tr");
  tr.dataset.id = k.id ?? "";
  tr.innerHTML = `
    <td><input class="input" value="${S(k.naam)}" placeholder="Naam"></td>
    <td>${lists.typeSelect(k.type||"")}</td>
    <td><input class="input" value="${S(k.thema)}" placeholder="Thema"></td>
    <td><input class="input" value="${S(k.afbeelding)}" placeholder="/img/..."></td>
    <td><input class="input" value="${S(k.beschrijving)}" placeholder="Beschrijving"></td>
    <td><input class="input" value="${S(k.mailblue_tag)}" placeholder="MailBlue tag"></td>
    <td>${lists.statusSelect(k.status||"actief")}</td>
    <td class="right nowrap">
      <button class="btn btn-xs" data-act="save">💾</button>
      <button class="btn btn-xs" data-act="del">🗑️</button>
    </td>
  `;
  return tr;
}
function collect(tr){
  const [inpNaam, selType, inpThema, inpImg, inpDesc, inpMB, selStatus] = tr.querySelectorAll("input, select");
  return {
    id: tr.dataset.id || undefined,
    naam: inpNaam.value.trim(),
    type: selType.value || "",
    thema: inpThema.value.trim(),
    afbeelding: inpImg.value.trim(),
    beschrijving: inpDesc.value.trim(),
    mailblue_tag: inpMB.value.trim(),
    status: selStatus.value || "actief"
  };
}
function render(){
  tbody.innerHTML = "";
  state.klassen.forEach(k => tbody.appendChild(row(k)));
  total.textContent = `${state.klassen.length} klassen`;
}
tbody.addEventListener("click", async (e)=>{
  const btn = e.target.closest("button[data-act]"); if(!btn) return;
  const tr = btn.closest("tr"); const id = tr.dataset.id;
  if (btn.dataset.act==="save"){
    const payload = collect(tr);
    if(!payload.naam){ alert("Naam is verplicht."); return; }
    const saved = await saveKlas(payload);
    tr.dataset.id = saved.id;
  }
  if (btn.dataset.act==="del"){
    if(!id){ tr.remove(); return; }
    if(!confirm("Klas verwijderen?")) return;
    await deleteKlas(id); tr.remove();
  }
});
btnAdd.addEventListener("click", ()=>{
  const tr = row({ status:"actief" });
  tbody.prepend(tr);
  tr.querySelector("input,select")?.focus();
});

(async function init(){
  const all = await loadCatalog();
  state.klassen = all.klassen || [];
  render();
})();
