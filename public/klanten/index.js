import {
  ensureData, getKlanten, setKlanten, getHonden, debounce
} from "../js/store.js";

const loader = document.getElementById("loader");
const error  = document.getElementById("error");
const tabel  = document.getElementById("tabel");
const tbody  = tabel.querySelector("tbody");
const wrap   = document.getElementById("wrap");
const zoek   = document.getElementById("zoek");
const btnNieuw = document.getElementById("btn-nieuw");

const modal = document.getElementById("modal");
const form  = document.getElementById("form");
const btnCancel = document.getElementById("btn-cancel");
const btnSave   = document.getElementById("btn-save");

let klantCache = [];
let hondCache  = [];

/* ---------- helpers ---------- */
const S = v => String(v ?? "");
const cmpBy = key => (a,b) => S(a?.[key]).localeCompare(S(b?.[key]));
const byId = (list, id) => (list || []).find(x => String(x?.id) === String(id));

function guessNameFromEmail(email){
  const local = S(email).split("@")[0];
  return local.split(/[._-]+/).map(s=>s? s[0].toUpperCase()+s.slice(1):"").join(" ").trim();
}
function ensureNaam(k){
  const n = S(k.naam).trim();
  if (n) return n;
  const comb = [k.voornaam, k.achternaam].filter(Boolean).join(" ").trim();
  return comb || guessNameFromEmail(k.email) || `Klant #${k.id}`;
}
function dogsOf(klantId){
  return (hondCache || []).filter(h => String(h?.eigenaarId ?? h?.ownerId ?? h?.klantId) === String(klantId));
}

/* ---------- render ---------- */
function rowHtml(k) {
  const naam = ensureNaam(k);
  const dogs = dogsOf(k.id);
  const maxChips = 3;

  const chips = dogs.slice(0, maxChips).map(h => `
    <span class="chip"><a href="../honden/detail.html?id=${h.id}" title="Open ${S(h.naam)}">${S(h.naam)}</a></span>
  `).join("");

  const more = dogs.length > maxChips
    ? `<span class="chip more" title="${dogs.slice(maxChips).map(h=>S(h.naam)).join(', ')}">+${dogs.length - maxChips}</span>`
    : (dogs.length === 0 ? `<a class="chip more" href="../honden/index.html?owner=${k.id}" title="Nieuwe hond">+ Hond</a>` : "");

  return `
    <tr>
      <td><a href="./detail.html?id=${k.id}">${naam}</a></td>
      <td>${S(k.email)}</td>
      <td>${S(k.telefoon)}</td>
      <td><div class="chips">${chips}${more}</div></td>
      <td class="right nowrap">
        <button data-act="edit" data-id="${k.id}" title="Wijzig">✏️</button>
        <button data-act="del"  data-id="${k.id}" title="Verwijder">🗑️</button>
      </td>
    </tr>`;
}

function render(filter="") {
  const f = S(filter).trim().toLowerCase();
  const lijst = (klantCache || [])
    .filter(Boolean)
    .map(k => ({ ...k, naam: ensureNaam(k) }))
    .filter(k => !f || S(k.naam).toLowerCase().includes(f) || S(k.email).toLowerCase().includes(f))
    .sort(cmpBy("naam"));

  tbody.innerHTML = lijst.map(rowHtml).join("");
  loader.style.display = "none";
  wrap.style.display = "";
}

/* ---------- init ---------- */
async function init() {
  try {
    await ensureData();
    klantCache = getKlanten() || [];
    hondCache  = getHonden()  || [];

    // MIGRATIE: sla ontbrekende naam direct op zodat het blijvend is
    let changed = false;
    klantCache = klantCache.map(k => {
      const n = ensureNaam(k);
      if (n !== S(k.naam)) { changed = true; return { ...k, naam: n }; }
      return k;
    });
    if (changed) setKlanten(klantCache);

    render();
  } catch (e) {
    loader.style.display = "none";
    error.style.display = "block";
    error.textContent = "⚠️ " + e.message;
  }
}

/* ---------- events ---------- */
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
  const k = isNew
    ? { id:"", naam:"", voornaam:"", achternaam:"", email:"", telefoon:"", adres:"", land:"BE" }
    : klantCache.find(x => String(x?.id) === String(id)) || {};

  form.reset();
  form.id.value = k.id || "";
  form.naam.value = S(k.naam);
  form.voornaam.value = S(k.voornaam);
  form.achternaam.value = S(k.achternaam);
  form.email.value = S(k.email);
  form.telefoon.value = S(k.telefoon);
  form.adres.value = S(k.adres);
  form.land.value = S(k.land || "BE");

  document.getElementById("modal-title").textContent = isNew ? "Nieuwe klant" : "Klant wijzigen";
  modal.showModal();
}

// iPad/Safari-proof: expliciete knoppen
btnCancel.addEventListener("click", () => modal.close('cancel'));
btnSave.addEventListener("click", () => {
  const data = Object.fromEntries(new FormData(form).entries());

  // naam invullen indien leeg
  data.naam = S(data.naam).trim() ||
              [data.voornaam, data.achternaam].filter(Boolean).join(" ").trim() ||
              guessNameFromEmail(data.email);

  if (!data.naam) {
    alert("Vul minstens een naam (of voornaam/achternaam of e-mail) in.");
    return;
  }

  if (!data.id) {
    const max = (klantCache || []).reduce((m,x)=>Math.max(m, Number(x?.id)||0), 0);
    data.id = max + 1;
    klantCache.push(data);
  } else {
    const i = klantCache.findIndex(k => String(k?.id) === String(data.id));
    if (i >= 0) klantCache[i] = { ...klantCache[i], ...data };
  }

  setKlanten(klantCache);
  render(zoek.value);
  modal.close('ok');
});

function tryDelete(id) {
  const dogs = dogsOf(id).length;
  if (dogs > 0) {
    alert(`Klant heeft nog ${dogs} hond(en). Verwijder of herwijs eerst de honden.`);
    return;
  }
  if (!confirm("Deze klant definitief verwijderen?")) return;
  klantCache = (klantCache || []).filter(k => String(k?.id) !== String(id));
  setKlanten(klantCache);
  render(zoek.value);
}

init();
