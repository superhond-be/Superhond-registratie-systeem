import { ensureData, getKlanten, setKlanten, getHonden, debounce } from "../js/store.js";

const loader = document.getElementById("loader");
const error  = document.getElementById("error");
const tabel  = document.getElementById("tabel");
const tbody  = tabel.querySelector("tbody");
const wrap   = document.getElementById("wrap");
const zoek   = document.getElementById("zoek");
const btnNieuw = document.getElementById("btn-nieuw");

// Modal & knoppen
const modal = document.getElementById("modal");
const form  = document.getElementById("form");
const btnCancel = document.getElementById("btn-cancel");
const btnSave   = document.getElementById("btn-save");
const fldLand   = document.getElementById("fld-land");

let klantCache = [];
let hondCache  = [];

/* ---------------- helpers ---------------- */
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
function formatAdres(obj = {}) {
  const p1 = [obj.straat, [obj.huisnr, obj.bus].filter(Boolean).join("")].filter(Boolean).join(" ");
  const p2 = [obj.postcode, obj.gemeente].filter(Boolean).join(" ");
  return [p1, p2].filter(Boolean).join(", ");
}
function validatePostcode(val, land) {
  if (!val) return true;
  if (land === "BE") return /^[0-9]{4}$/.test(val);           // 1000
  if (land === "NL") return /^[0-9]{4}\s?[A-Za-z]{2}$/.test(val); // 1234 AB
  return true;
}
function updateAddressLabels(){
  const land = fldLand.value || "BE";
  document.getElementById("lbl-gemeente").textContent = land === "NL" ? "Plaats" : "Gemeente";
  document.getElementById("fld-postcode").placeholder = land === "NL" ? "1234 AB" : "1000";
}

/* ---------------- render ---------------- */
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

/* ---------------- init ---------------- */
async function init() {
  try {
    await ensureData();
    klantCache = getKlanten() || [];
    hondCache  = getHonden()  || [];

    // MIGRATIE: zorg dat k.naam gevuld is en bewaar terug
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

/* ---------------- events ---------------- */
tbody.addEventListener("click", e => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.getAttribute("data-id");
  if (btn.dataset.act === "edit") openEdit(id);
  if (btn.dataset.act === "del")  tryDelete(id);
});

btnNieuw.addEventListener("click", () => openEdit(null));
zoek.addEventListener("input", debounce(() => render(zoek.value), 300));
fldLand.addEventListener("change", updateAddressLabels);

/* ---------------- modal open ---------------- */
function openEdit(id) {
  const isNew = !id;
  const k = isNew
    ? { id:"", naam:"", voornaam:"", achternaam:"", email:"", telefoon:"", land:"BE",
        straat:"", huisnr:"", bus:"", postcode:"", gemeente:"" }
    : klantCache.find(x => String(x?.id) === String(id)) || {};

  form.reset();
  form.id.value         = k.id || "";
  form.naam.value       = S(k.naam);
  form.voornaam.value   = S(k.voornaam);
  form.achternaam.value = S(k.achternaam);
  form.email.value      = S
