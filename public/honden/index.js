import {
  ensureData, getHonden, setHonden, getKlanten,
  newHondId, debounce, byId
} from "/js/store.js";

const loader = document.getElementById("loader");
const error  = document.getElementById("error");
const tabel  = document.getElementById("tabel");
const tbody  = tabel.querySelector("tbody");
const zoek   = document.getElementById("zoek");
const ownerFilter = document.getElementById("ownerFilter");
const btnNieuw = document.getElementById("btn-nieuw");
const modal = document.getElementById("modal");
const form  = document.getElementById("form");
const selEigenaar = document.getElementById("sel-eigenaar");

let hondCache = [];
let klantCache = [];

function ownerName(id) {
  return byId(klantCache, id)?.naam || "—";
}

function rowHtml(h) {
  const eigenaarNaam = ownerName(h.eigenaarId);
  return `
    <tr>
      <td><a href="/honden/detail.html?id=${h.id}">${h.naam}</a></td>
      <td>${h.ras || ""}</td>
      <td>${h.geboortedatum || ""}</td>
      <td><a href="/klanten/detail.html?id=${h.eigenaarId}">${eigenaarNaam}</a></td>
      <td style="text-align:right;white-space:nowrap">
        <button data-act="edit" data-id="${h.id}" title="Wijzig">✏️</button>
        <button data-act="del"  data-id="${h.id}" title="Verwijder">🗑️</button>
      </td>
    </tr>`;
}

function render(filterTxt="", owner="") {
  const f = filterTxt.trim().toLowerCase();
  let lijst = hondCache.filter(h =>
    (!f || h.naam?.toLowerCase().includes(f) || h.ras?.toLowerCase().includes(f)) &&
    (!owner || String(h.eigenaarId) === String(owner))
  ).sort((a,b) => a.naam.localeCompare(b.naam));
  tbody.innerHTML = lijst.map(rowHtml).join("");
  loader.style.display = "none";
  tabel.style.display = "";
}

function populateOwnerSelects(selectedId="") {
  const opts = [`<option value="" disabled ${selectedId?"":"selected"}>— Kies eigenaar —</option>`]
    .concat(klantCache
      .slice().sort((a,b)=>a.naam.localeCompare(b.naam))
      .map(k => `<option value="${k.id}" ${String(k.id)===String(selectedId)?"selected":""}>${k.naam}</option>`));
  selEigenaar.innerHTML = opts.join("");

  const filterOpts = [`<option value="">— Filter op eigenaar —</option>`]
    .concat(klantCache
      .slice().sort((a,b)=>a.naam.localeCompare(b.naam))
      .map(k => `<option value="${k.id}">${k.naam}</option>`));
  ownerFilter.innerHTML = filterOpts.join("");
}

async function init() {
  try {
    await ensureData();
    hondCache = getHonden();
    klantCache = getKlanten();

    // Preselect owner from URL ?owner=
    const urlOwner = new URLSearchParams(location.search).get("owner") || "";
    populateOwnerSelects(urlOwner);

    render("", urlOwner);
    ownerFilter.value = urlOwner;
  } catch (e) {
    loader.style.display = "none";
    error.style.display = "block";
    error.textContent = "⚠️ " + e.message;
  }
}

tbody.addEventListener("click", e => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.getAttribute("data-id");
  if (btn.dataset.act === "edit") openEdit(id);
  if (btn.dataset.act === "del")  tryDelete(id);
});

btnNieuw.addEventListener("click", () => openEdit(null));
zoek.addEventListener("input", debounce(() => render(zoek.value, ownerFilter.value), 300));
ownerFilter.addEventListener("change", () => render(zoek.value, ownerFilter.value));

function openEdit(id) {
  const isNew = !id;
  const h = isNew ? { id:"", naam:"", ras:"", geboortedatum:"", chip:"", eigenaarId:"" }
                  : hondCache.find(x => String(x.id) === String(id));
  form.reset();
  form.id.value = h.id || "";
  form.naam.value = h.naam || "";
  form.ras.value = h.ras || "";
  form.geboortedatum.value = h.geboortedatum || "";
  form.chip.value = h.chip || "";
  populateOwnerSelects(h.eigenaarId || new URLSearchParams(location.search).get("owner") || "");
  document.getElementById("modal-title").textContent = isNew ? "Nieuwe hond" : "Hond wijzigen";
  modal.showModal();
}

form.addEventListener("submit", e => e.preventDefault());

modal.addEventListener("close", () => {
  if (modal.returnValue !== "ok") return;
  const data = Object.fromEntries(new FormData(form).entries());
  if (!data.naam?.trim() || !data.eigenaarId) return;
  data.eigenaarId = Number(data.eigenaarId);

  if (!data.id) {
    data.id = newHondId();
    hondCache.push(data);
  } else {
    const i = hondCache.findIndex(h => String(h.id) === String(data.id));
    if (i >= 0) hondCache[i] = { ...hondCache[i], ...data };
  }
  setHonden(hondCache);
  render(zoek.value, ownerFilter.value);
});

function tryDelete(id) {
  const ok = confirm("Deze hond definitief verwijderen?");
  if (!ok) return;
  hondCache = hondCache.filter(h => String(h.id) !== String(id));
  setHonden(hondCache);
  render(zoek.value, ownerFilter.value);
}

init();
