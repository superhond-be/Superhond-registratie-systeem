import {
  ensureData, getHonden, setHonden, getKlanten, debounce
} from "../js/store.js";

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

// --- helpers (defensief) ---
const S = v => String(v ?? "");
const cmpBy = key => (a,b) => S(a?.[key]).localeCompare(S(b?.[key]));
const byId = (list, id) => (list || []).find(x => String(x?.id) === String(id));

function ownerName(id) { return byId(klantCache, id)?.naam || "—"; }

function rowHtml(h) {
  const eigenaarNaam = ownerName(h.eigenaarId);
  return `
    <tr>
      <td><a href="./detail.html?id=${h.id}">${S(h.naam)}</a></td>
      <td>${S(h.ras)}</td>
      <td>${S(h.geboortedatum)}</td>
      <td><a href="../klanten/detail.html?id=${h.eigenaarId}">${S(eigenaarNaam)}</a></td>
      <td style="text-align:right;white-space:nowrap">
        <button data-act="edit" data-id="${h.id}" title="Wijzig">✏️</button>
        <button data-act="del"  data-id="${h.id}" title="Verwijder">🗑️</button>
      </td>
    </tr>`;
}

function render(filterTxt="", owner="") {
  const f = S(filterTxt).trim().toLowerCase();
  const lijst = (hondCache || [])
    .filter(Boolean)
    .filter(h =>
      (!f || S(h.naam).toLowerCase().includes(f) || S(h.ras).toLowerCase().includes(f)) &&
      (!owner || String(h.eigenaarId) === String(owner))
    )
    .sort(cmpBy("naam"));

  tbody.innerHTML = lijst.map(rowHtml).join("");
  loader.style.display = "none";
  tabel.style.display = "";
}

function populateOwnerSelects(selectedId="") {
  const sorted = (klantCache || []).slice().sort(cmpBy("naam"));
  selEigenaar.innerHTML =
    `<option value="" disabled ${selectedId?"":"selected"}>— Kies eigenaar —</option>` +
    sorted.map(k => `<option value="${k.id}" ${String(k.id)===String(selectedId)?"selected":""}>${S(k.naam)}</option>`).join("");

  ownerFilter.innerHTML =
    `<option value="">— Filter op eigenaar —</option>` +
    sorted.map(k => `<option value="${k.id}">${S(k.naam)}</option>`).join("");
}

async function init() {
  try {
    await ensureData();
    hondCache = getHonden() || [];
    klantCache = getKlanten() || [];

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
  const h = isNew
    ? { id:"", naam:"", ras:"", geboortedatum:"", chip:"", eigenaarId:"" }
    : (hondCache || []).find(x => String(x?.id) === String(id)) || {};

  form.reset();
  form.id.value = h.id || "";
  form.naam.value = S(h.naam);
  form.ras.value = S(h.ras);
  form.geboortedatum.value = S(h.geboortedatum);
  form.chip.value = S(h.chip);

  const preselect = h.eigenaarId || new URLSearchParams(location.search).get("owner") || "";
  populateOwnerSelects(preselect);

  document.getElementById("modal-title").textContent = isNew ? "Nieuwe hond" : "Hond wijzigen";
  modal.showModal();
}

form.addEventListener("submit", e => e.preventDefault());
modal.addEventListener("close", () => {
  if (modal.returnValue !== "ok") return;
  const data = Object.fromEntries(new FormData(form).entries());
  if (!S(data.naam).trim() || !data.eigenaarId) return;
  data.eigenaarId = Number(data.eigenaarId);

  if (!data.id) {
    const max = (hondCache || []).reduce((m,x)=>Math.max(m, Number(x?.id)||0), 0);
    data.id = max + 1;
    hondCache.push(data);
  } else {
    const i = (hondCache || []).findIndex(h => String(h?.id) === String(data.id));
    if (i >= 0) hondCache[i] = { ...hondCache[i], ...data };
  }
  setHonden(hondCache);
  render(zoek.value, ownerFilter.value);
});

function tryDelete(id) {
  if (!confirm("Deze hond definitief verwijderen?")) return;
  hondCache = (hondCache || []).filter(h => String(h?.id) !== String(id));
  setHonden(hondCache);
  render(zoek.value, ownerFilter.value);
}

init();
