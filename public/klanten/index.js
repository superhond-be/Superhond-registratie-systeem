// /klanten/index.js
import { ensureMigrated, getKlanten, setKlanten, getHonden } from "../js/store.js";

/* ---------------- kleine helpers ---------------- */
const S  = v => String(v ?? "");
const T  = v => S(v).trim();
const esc = s => S(s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#39;");

const debounce = (fn, ms=300) => {
  let t; return (...args) => { clearTimeout(t); t=setTimeout(() => fn(...args), ms); };
};

const cmpBy = key => (a,b) => T(a?.[key]).localeCompare(T(b?.[key]));
const byId  = (list, id) => (list || []).find(x => String(x?.id) === String(id));

function guessNameFromEmail(email){
  const local = T(email).split("@")[0];
  return local.split(/[._-]+/).map(s => s ? s[0].toUpperCase()+s.slice(1) : "").join(" ").trim();
}
function buildFullName(vn, an, fallbackEmail){
  const full = T(`${T(vn)} ${T(an)}`.replace(/\s+/g, " "));
  if (full) return full;
  const fromMail = guessNameFromEmail(fallbackEmail);
  return fromMail || "";
}
function ensureNaam(k){
  const n = T(k.naam);
  if (n) return n;
  const built = buildFullName(k.voornaam, k.achternaam, k.email);
  return built || `Klant #${k.id || ""}`.trim();
}
function dogsOf(klantId, honden){
  return (honden || []).filter(h => String(h?.eigenaarId ?? h?.ownerId ?? h?.klantId) === String(klantId));
}
function validatePostcode(val, land) {
  const v = T(val);
  if (!v) return true;
  if (land === "BE") return /^[0-9]{4}$/.test(v);                // 1000
  if (land === "NL") return /^[0-9]{4}\s?[A-Za-z]{2}$/.test(v);  // 1234 AB
  return true;
}

/* ---------------- DOM refs ---------------- */
const loader   = document.getElementById("loader");
const error    = document.getElementById("error");
const tabel    = document.getElementById("tabel");
const tbody    = tabel?.querySelector("tbody");
const wrap     = document.getElementById("wrap");
const zoek     = document.getElementById("zoek");
const btnNieuw = document.getElementById("btn-nieuw");

// Modal & knoppen/velden
const modal     = document.getElementById("modal");
const form      = document.getElementById("form");
const btnCancel = document.getElementById("btn-cancel");
const btnSave   = document.getElementById("btn-save");
const fldLand   = document.getElementById("fld-land");

const fldVoornaam   = form?.elements?.voornaam;
const fldAchternaam = form?.elements?.achternaam;
const fldNaam       = form?.elements?.naam;
const fldEmail      = form?.elements?.email;
const fldTelefoon   = form?.elements?.telefoon;
const fldStraat     = document.getElementById("fld-straat")   || form?.elements?.straat;
const fldHuisnr     = document.getElementById("fld-huisnr")   || form?.elements?.huisnr;
const fldBus        = document.getElementById("fld-bus")      || form?.elements?.bus;
const fldPostcode   = document.getElementById("fld-postcode") || form?.elements?.postcode;
const fldGemeente   = document.getElementById("fld-gemeente") || form?.elements?.gemeente;

let klantCache = [];
let hondCache  = [];

/* ---------------- UI helpers ---------------- */
function updateAddressLabels(){
  const land = fldLand?.value || "BE";
  const lblGemeente = document.getElementById("lbl-gemeente");
  const lblPostcode = document.getElementById("lbl-postcode");
  if (lblGemeente) lblGemeente.textContent = land === "NL" ? "Plaats" : "Gemeente";
  if (fldPostcode) fldPostcode.placeholder = land === "NL" ? "1234 AB" : "1000";
  if (lblPostcode) lblPostcode.textContent = land === "NL" ? "Postcode (NL)" : "Postcode";
}

/* ---------------- render ---------------- */
function rowHtml(k) {
  const naam = ensureNaam(k);
  const dogs = dogsOf(k.id, hondCache);
  const maxChips = 3;

  const chips = dogs.slice(0, maxChips).map(h => `
    <span class="chip"><a href="../honden/detail.html?id=${encodeURIComponent(h.id)}" title="Open ${esc(T(h.naam))}">${esc(T(h.naam))}</a></span>
  `).join("");

  const more = dogs.length > maxChips
    ? `<span class="chip more" title="${esc(dogs.slice(maxChips).map(h=>T(h.naam)).join(', '))}">+${dogs.length - maxChips}</span>`
    : (dogs.length === 0 ? `<a class="chip more" href="../honden/index.html?owner=${encodeURIComponent(k.id)}" title="Nieuwe hond">+ Hond</a>` : "");

  return `
    <tr data-id="${esc(k.id ?? '')}">
      <td><a href="./detail.html?id=${encodeURIComponent(k.id)}">${esc(naam)}</a></td>
      <td>${esc(T(k.email)) || "—"}</td>
      <td>${esc(T(k.telefoon)) || "—"}</td>
      <td><div class="chips">${chips}${more}</div></td>
      <td class="right nowrap">
        <button class="btn btn-xs" data-act="edit" data-id="${esc(k.id)}" title="Wijzig">Bewerken</button>
        <button class="btn btn-xs" data-act="del"  data-id="${esc(k.id)}" title="Verwijder">Verwijderen</button>
      </td>
    </tr>`;
}

function render(filter="") {
  if (!tbody || !loader || !wrap) return;

  const f = T(filter).toLowerCase();
  const lijst = (klantCache || [])
    .filter(Boolean)
    .map(k => ({ ...k, naam: ensureNaam(k) }))
    .filter(k =>
      !f ||
      T(k.naam).toLowerCase().includes(f) ||
      T(k.email).toLowerCase().includes(f) ||
      T(k.telefoon).toLowerCase().includes(f)
    )
    .sort(cmpBy("naam"));

  tbody.innerHTML = lijst.map(rowHtml).join("") || `<tr><td colspan="5" class="muted">Geen klanten gevonden.</td></tr>`;
  loader.style.display = "none";
  wrap.style.display = "";
}

/* ---------------- init ---------------- */
async function init() {
  try {
    if (loader) loader.style.display = "";
    if (wrap)   wrap.style.display = "none";
    if (error)  error.style.display = "none";

    // migratie (legacy -> buckets)
    ensureMigrated();

    // laad uit buckets
    klantCache = getKlanten() || [];
    hondCache  = getHonden()  || [];

    // MIGRATIE: zorg dat k.naam gevuld is
    let changed = false;
    klantCache = klantCache.map(k => {
      const n = ensureNaam(k);
      if (n !== T(k.naam)) { changed = true; return { ...k, naam: n }; }
      return k;
    });
    if (changed) setKlanten(klantCache);

    updateAddressLabels();
    render();

  } catch (e) {
    if (loader) loader.style.display = "none";
    if (error){
      error.style.display = "block";
      error.textContent = "⚠️ " + (e.message || e);
    }
  }
}

/* ---------------- modal helpers ---------------- */
function openEdit(id) {
  if (!modal || !form) return;

  const isNew = !id;
  const k = isNew
    ? { id:"", naam:"", voornaam:"", achternaam:"", email:"", telefoon:"", land:"BE",
        straat:"", huisnr:"", bus:"", postcode:"", gemeente:"" }
    : (byId(klantCache, id) || {});

  form.reset();

  form.id.value         = k.id || "";
  if (fldVoornaam)   fldVoornaam.value   = T(k.voornaam);
  if (fldAchternaam) fldAchternaam.value = T(k.achternaam);
  if (fldEmail)      fldEmail.value      = T(k.email);
  if (fldTelefoon)   fldTelefoon.value   = T(k.telefoon);
  if (fldLand)       fldLand.value       = T(k.land || "BE");
  if (fldStraat)     fldStraat.value     = T(k.straat);
  if (fldHuisnr)     fldHuisnr.value     = T(k.huisnr);
  if (fldBus)        fldBus.value        = T(k.bus);
  if (fldPostcode)   fldPostcode.value   = T(k.postcode);
  if (fldGemeente)   fldGemeente.value   = T(k.gemeente);

  if (fldNaam) fldNaam.value = buildFullName(fldVoornaam?.value, fldAchternaam?.value, fldEmail?.value);

  const title = document.getElementById("modal-title");
  if (title) title.textContent = isNew ? "Nieuwe klant" : "Klant bewerken";

  updateAddressLabels();
  modal.showModal();
}

function closeEdit() {
  modal?.close();
}

function collectFormData() {
  if (!form) return {};
  const obj = Object.fromEntries(new FormData(form).entries());
  obj.naam = buildFullName(obj.voornaam, obj.achternaam, obj.email) || obj.naam || "";
  if (!T(obj.id)) obj.id = "kl" + Math.random().toString(36).slice(2, 8);
  return obj;
}

function tryDelete(id) {
  const rec = byId(klantCache, id);
  if (!rec) return;
  if (!confirm(`Klant “${ensureNaam(rec)}” verwijderen?`)) return;

  klantCache = klantCache.filter(k => String(k.id) !== String(id));
  setKlanten(klantCache);
  render(zoek?.value);
}

/* ---------------- events ---------------- */
tbody?.addEventListener("click", e => {
  const btn = e.target.closest?.("button[data-act]");
  if (!btn) return;
  const id = btn.getAttribute("data-id");
  if (btn.dataset.act === "edit") openEdit(id);
  if (btn.dataset.act === "del")  tryDelete(id);
});

btnNieuw?.addEventListener("click", () => openEdit(null));
zoek?.addEventListener("input", debounce(() => render(zoek.value), 300));
fldLand?.addEventListener("change", updateAddressLabels);

// Bewaren
btnSave?.addEventListener("click", () => {
  if (!form) return;
  if (btnSave.type !== "submit") {
    form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", {cancelable:true}));
  }
});
btnCancel?.addEventListener("click", closeEdit);

[fldVoornaam, fldAchternaam, fldEmail].forEach(el => {
  el?.addEventListener("input", () => {
    if (fldNaam) fldNaam.value = buildFullName(fldVoornaam?.value, fldAchternaam?.value, fldEmail?.value);
  });
});

form?.addEventListener("submit", (e) => {
  e.preventDefault();
  const land = fldLand?.value || "BE";
  if (fldPostcode && !validatePostcode(fldPostcode.value, land)) {
    alert(land === "NL" ? "Postcode (NL) ongeldig. Voorbeeld: 1234 AB" : "Postcode (BE) ongeldig. Voorbeeld: 1000");
    fldPostcode.focus();
    return;
  }
  const obj = collectFormData();

  // upsert
  const idx = klantCache.findIndex(x => String(x.id) === String(obj.id));
  if (idx >= 0) klantCache[idx] = { ...klantCache[idx], ...obj };
  else klantCache.push(obj);

  setKlanten(klantCache);
  closeEdit();
  render(zoek?.value);
});

/* ---------------- go ---------------- */
init();
