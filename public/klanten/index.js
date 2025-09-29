import {
  ensureData, getKlanten, setKlanten, getHonden, newKlantId, debounce
} from "../js/store.js";

const loader = document.getElementById("loader");
const error  = document.getElementById("error");
const tabel  = document.getElementById("tabel");
const tbody  = tabel.querySelector("tbody");
const zoek   = document.getElementById("zoek");
const btnNieuw = document.getElementById("btn-nieuw");
const modal = document.getElementById("modal");
const form  = document.getElementById("form");
const confirmDel = document.getElementById("confirmDel");
const confirmMsg = document.getElementById("confirm-msg");

let klantCache = [];
let hondCache  = [];

// --- helpers (defensief) ---
const S = v => String(v ?? "");
const cmpBy = key => (a,b) => S(a?.[key]).localeCompare(S(b?.[key]));

function countDogs(klantId) {
  return (hondCache || []).filter(h => String(h?.eigenaarId) === String(klantId)).length;
}

function rowHtml(k) {
  const dogs = countDogs(k.id);
  const linkDogs = `<a href="../honden/index.html?owner=${k.id}" title="Toon honden van ${S(k.naam)}">${dogs}</a>`;
  return `
    <tr>
      <td><a href="./detail.html?id=${k.id}">${S(k.naam)}</a></td>
      <td>${S(k.email)}</td>
      <td>${S(k.telefoon)}</td>
      <td style="text-align:center">${linkDogs}</td>
      <td class="actions" style="text-align:right;white-space:nowrap">
        <button data-act="edit" data-id="${k.id}" title="Wijzig">✏️</button>
        <button data-act="del"  data-id="${k.id}" title="Verwijder">🗑️</button>
      </td>
    </tr>`;
}

function render(filter="") {
  const f = S(filter).trim().toLowerCase();
  const lijst = (klantCache || [])
    .filter(Boolean)
    .filter(k => !f || S(k.naam).toLowerCase().includes(f) || S(k.email).toLowerCase().includes(f))
    .sort(cmpBy("naam"));

  tbody.innerHTML = lijst.map(rowHtml).join("");
  loader.style.display = "none";
  tabel.style.display = "";
}

async function init() {
  try {
    await ensureData();
    klantCache = getKlanten() || [];
    hondCache  = getHonden() || [];
    render();
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
zoek.addEventListener("input", debounce(() => render(zoek.value), 300));

function openEdit(id) {
  const isNew = !id;
  const k = isNew ? { id:"", naam:"", email:"", telefoon:"", adres:"", land:"BE" }
                  : klantCache.find(x => String(x?.id) === String(id));
  form.reset();
  form.id.value = k?.id || "";
  form.naam.value = S(k?.naam);
  form.email.value = S(k?.email);
  form.telefoon.value = S(k?.telefoon);
  form.adres.value = S(k?.adres);
  form.land.value = S(k?.land || "BE");
  document.getElementById("modal-title").textContent = isNew ? "Nieuwe klant" : "Klant wijzigen";
  modal.showModal();
}

form.addEventListener("submit", e => e.preventDefault());
modal.addEventListener("close", () => {
  if (modal.returnValue !== "ok") return;
  const data = Object.fromEntries(new FormData(form).entries());
  if (!S(data.naam).trim()) return;

  if (!data.id) {
    // nieuw
    const max = (klantCache || []).reduce((m,x)=>Math.max(m, Number(x?.id)||0), 0);
    data.id = max + 1;
    klantCache.push(data);
  } else {
    const i = klantCache.findIndex(k => String(k?.id) === String(data.id));
    if (i >= 0) klantCache[i] = { ...klantCache[i], ...data };
  }
  setKlanten(klantCache);
  render(zoek.value);
});

function tryDelete(id) {
  const dogs = countDogs(id);
  if (dogs > 0) {
    confirmMsg.textContent = `Klant heeft nog ${dogs} hond(en). Verwijder of herwijs eerst de honden.`;
    confirmDel.showModal();
    return;
  }
  if (!confirm("Deze klant definitief verwijderen?")) return;
  klantCache = (klantCache || []).filter(k => String(k?.id) !== String(id));
  setKlanten(klantCache);
  render(zoek.value);
}

init();
