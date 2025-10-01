import { loadCatalog, savePakket, deletePakket, lists, S } from "/js/catalog.store.js";

const tbody = document.querySelector("#tbl tbody");
const btnAdd = document.getElementById("btn-add");
const total  = document.getElementById("total");

let state = { pakketten:[], klassen:[] };

function row(p = {}) {
  const tr = document.createElement("tr");
  tr.dataset.id = p.id ?? "";
  tr.innerHTML = `
    <td class="min">${lists.klasSelect(state.klassen, p.klas_id)}</td>
    <td><input class="input" value="${S(p.naam)}" placeholder="Naam"></td>
    <td>${lists.typeSelect(p.type||"")}</td>
    <td><input class="input" value="${S(p.thema)}" placeholder="Thema"></td>
    <td><input class="input input-nr" type="number" min="1" value="${S(p.aantal_strippen ?? 8)}"></td>
    <td><input class="input input-nr" type="number" min="1" value="${S(p.max_deelnemers ?? 8)}"></td>
    <td><input class="input input-nr" type="number" min="1" value="${S(p.lesduur_minuten ?? 60)}"></td>
    <td><input class="input input-nr" type="number" min="1" value="${S(p.geldigheidsduur_weken ?? 12)}"></td>
    <td><input class="input input-nr" type="number" step="0.01" value="${p.prijs_excl ?? ""}" placeholder="—"></td>
    <td>${lists.statusSelect(p.status || "actief")}</td>
    <td class="right nowrap">
      <button class="btn btn-xs" data-act="save">💾</button>
      <button class="btn btn-xs" data-act="del">🗑️</button>
    </td>
  `;
  return tr;
}
function collect(tr) {
  const [selKlas, inpNaam, selType, inpThema, inpStrip, inpMax, inpDuur, inpWkn, inpPrijs, selStatus] =
    tr.querySelectorAll("select, input");
  return {
    id: tr.dataset.id || undefined,
    klas_id: selKlas.value || null,
    naam: inpNaam.value.trim(),
    type: selType.value || "",
    thema: inpThema.value.trim(),
    aantal_strippen: Number(inpStrip.value)||1,
    max_deelnemers: Number(inpMax.value)||1,
    lesduur_minuten: Number(inpDuur.value)||1,
    geldigheidsduur_weken: Number(inpWkn.value)||0,
    prijs_excl: inpPrijs.value === "" ? null : Number(inpPrijs.value),
    status: selStatus.value || "actief"
  };
}
function render(){
  tbody.innerHTML = "";
  state.pakketten.forEach(p => tbody.appendChild(row(p)));
  total.textContent = `${state.pakketten.length} pakketten`;
}
tbody.addEventListener("click", async (e)=>{
  const btn = e.target.closest("button[data-act]"); if(!btn) return;
  const tr = btn.closest("tr"); const id = tr.dataset.id;

  if (btn.dataset.act==="save"){
    const payload = collect(tr);
    if(!payload.naam){ alert("Naam is verplicht."); return; }
    if(!payload.klas_id){ alert("Klas is verplicht."); return; }
    const saved = await savePakket(payload);
    tr.dataset.id = saved.id;
  }
  if (btn.dataset.act==="del"){
    if(!id){ tr.remove(); return; }
    if(!confirm("Pakket verwijderen?")) return;
    await deletePakket(id); tr.remove();
  }
});
btnAdd.addEventListener("click", ()=>{
  const tr = row({ status:"actief", aantal_strippen:8, max_deelnemers:8, lesduur_minuten:60, geldigheidsduur_weken:12 });
  tbody.prepend(tr);
  tr.querySelector("input,select")?.focus();
});

(async function init(){
  const all = await loadCatalog();
  state.klassen   = all.klassen || [];
  state.pakketten = all.pakketten || [];
  render();
})();
