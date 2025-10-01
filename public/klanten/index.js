// /klanten/index.js
import {
  ensureData, getKlanten, setKlanten, getHonden, debounce
} from "/js/store.js";

/* ---------------- DOM ---------------- */
const loader   = document.getElementById("loader");
const error    = document.getElementById("error");
const tabel    = document.getElementById("tabel");
const tbody    = tabel.querySelector("tbody");
const wrap     = document.getElementById("wrap");
const zoek     = document.getElementById("zoek");
const btnNieuw = document.getElementById("btn-nieuw");

// Modal & knoppen
const modal    = document.getElementById("modal");
const form     = document.getElementById("form");
const btnCancel= document.getElementById("btn-cancel");
const btnSave  = document.getElementById("btn-save");
const fldLand  = document.getElementById("fld-land");

let klantCache = [];
let hondCache  = [];

/* ---------------- helpers ---------------- */
const S = v => String(v ?? "");
const cmpBy = key => (a,b) => S(a?.[key]).localeCompare(S(b?.[key]));

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
  if (land === "BE") return /^[0-9]{4}$/.test(val);              // 1000
  if (land === "NL") return /^[0-9]{4}\s?[A-Za-z]{2}$/.test(val); // 1234 AB
  return true;
}
function updateAddressLabels(){
  const land = fldLand?.value || "BE";
  const lblGemeente = document.getElementById("lbl-gemeente");
  const fldPostcode = document.getElementById("fld-postcode");
  if (lblGemeente) lblGemeente.textContent = land === "NL" ? "Plaats" : "Gemeente";
  if (fldPostcode) fldPostcode.placeholder = land === "NL" ? "1234 AB" : "1000";
}

/* ---------------- render ---------------- */
function rowHtml(k) {
  const naam = ensureNaam(k);
  const dogs = dogsOf(k.id);
  const maxChips = 3;

  const chips = dogs.slice(0, maxChips).map(h => `
    <span class="chip"><a href="/honden/detail.html?id=${h.id}" title="Open ${S(h.naam)}">${S(h.naam)}</a></span>
  `).join("");

  const more = dogs.length > maxChips
    ? `<span class="chip more" title="${dogs.slice(maxChips).map(h=>S(h.naam)).join(', ')}">+${dogs.length - maxChips}</span>`
    : (dogs.length === 0 ? `<a class="chip more" href="/honden/index.html?owner=${k.id}" title="Nieuwe hond">+ Hond</a>` : "");

  return `
    <tr>
      <td><a href="/klanten/detail.html?id=${k.id}">${naam}</a><div class="muted">${formatAdres(k)}</div></td>
      <td>${S(k.email)}</td>
      <td>${S(k.telefoon)}</td>
      <td><div class="chips">${chips}${more}</div></td>
      <td class="right nowrap">
        <button class="btn btn-xs" data-act="edit" data-id="${k.id}" title="Wijzig">✏️</button>
        <button class="btn btn-xs" data-act="del"  data-id="${k.id}" title="Verwijder">🗑️</button>
      </td>
    </tr>`;
}

function render(filter="") {
  const f = S(filter).trim().toLowerCase();
  const lijst = (klantCache || [])
    .filter(Boolean)
    .map(k => ({ ...k, naam: ensureNaam(k) }))
    .filter(k =>
      !f ||
      S(k.naam).toLowerCase().includes(f) ||
      S(k.email).toLowerCase().includes(f)
    )
    .sort(cmpBy("naam"));

  tbody.innerHTML = lijst.map(rowHtml).join("") ||
    `<tr><td colspan="5"><em>Geen klanten gevonden.</em></td></tr>`;

  loader.style.display = "none";
  error.style.display = "none";
  wrap.style.display = "";
}

/* ---------------- init ---------------- */
async function init() {
  try {
    loader.style.display = "block";
    wrap.style.display = "none";
    error.style.display = "none";

    await ensureData();            // haalt demo-data of API
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

    // iPad UX
    updateAddressLabels();
  } catch (e) {
    console.error(e);
    loader.style.display = "none";
    error.style.display = "block";
    error.textContent = "⚠️ Kon klanten niet laden: " + e.message;
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
fldLand?.addEventListener("change", updateAddressLabels);

/* ---------------- modal open/save ---------------- */
function openEdit(id) {
  const isNew = !id;
  const k = isNew
    ? { id:"", naam:"", voornaam:"", achternaam:"", email:"", telefoon:"", land:"BE",
        straat:"", huisnr:"", bus:"", postcode:"", gemeente:"" }
    : (klantCache.find(x => String(x?.id) === String(id)) || {});

  form.reset();
  form.id.value          = k.id || "";
  form.naam.value        = S(k.naam);
  form.voornaam.value    = S(k.voornaam);
  form.achternaam.value  = S(k.achternaam);
  form.email.value       = S(k.email);
  form.telefoon.value    = S(k.telefoon);
  form.land.value        = S(k.land || "BE");
  form.straat.value      = S(k.straat);
  form.huisnr.value      = S(k.huisnr);
  form.bus.value         = S(k.bus);
  form.postcode.value    = S(k.postcode);
  form.gemeente.value    = S(k.gemeente);

  updateAddressLabels();
  document.getElementById("modal-title").textContent = isNew ? "Nieuwe klant" : "Klant wijzigen";
  modal.showModal();
}

btnCancel.addEventListener("click", () => modal.close());

btnSave.addEventListener("click", () => {
  const data = Object.fromEntries(new FormData(form).entries());
  data.id = data.id || String(Date.now()); // simpele ID voor demo
  data.land = data.land || "BE";

  if (!validatePostcode(data.postcode, data.land)) {
    alert("Postcode-formaat klopt niet voor " + data.land + ".");
    return;
  }
  if (!data.email) {
    alert("E-mail is verplicht.");
    return;
  }

  // naam aanmaken indien leeg
  data.naam = S(data.naam).trim() || [data.voornaam, data.achternaam].filter(Boolean).join(" ").trim() || guessNameFromEmail(data.email);

  const idx = klantCache.findIndex(k => String(k.id) === String(data.id));
  if (idx >= 0) klantCache[idx] = { ...klantCache[idx], ...data };
  else klantCache.push(data);

  setKlanten(klantCache);
  modal.close();
  render(zoek.value);
});

/* ---------------- delete (demo) ---------------- */
function tryDelete(id){
  if (!confirm("Klant verwijderen?")) return;
  klantCache = klantCache.filter(k => String(k.id) !== String(id));
  setKlanten(klantCache);
  render(zoek.value);
}

/* ---------------- start ---------------- */
document.addEventListener("DOMContentLoaded", init);

// Watchdog: als er na 3s nog steeds loader staat, toon hint
setTimeout(() => {
  if (loader && loader.style.display !== "none" && wrap.style.display !== "") {
    error.style.display = "block";
    error.textContent = "⚠️ Blijft laden. Controleer of /js/store.js laadt en /data/klanten.json / /data/honden.json bereikbaar zijn.";
    loader.style.display = "none";
  }
}, 3000);
