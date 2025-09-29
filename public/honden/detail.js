import { ensureData, getHonden, getKlanten } from "../js/store.js";

const id = new URLSearchParams(location.search).get("id");

const loader = document.getElementById("loader");
const error  = document.getElementById("error");
const sec    = document.getElementById("hond");

const S = v => String(v ?? "");
const byId = (list, _id) => (list || []).find(x => String(x?.id) === String(_id));

// tolerant voor verschillende keys
const getEigenaarId = h => h?.eigenaarId ?? h?.ownerId ?? h?.klantId ?? h?.eigenaar ?? h?.owner ?? null;

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

async function init() {
  try {
    await ensureData();
    const honden = getHonden() || [];
    const klanten = getKlanten() || [];

    const h = byId(honden, id);
    if (!h) throw new Error(`Hond met id=${id} niet gevonden`);

    const eigId = getEigenaarId(h);
    const eigenaar = byId(klanten, eigId);

    document.getElementById("d-naam").textContent = S(h.naam);
    document.getElementById("d-ras").textContent  = S(h.ras);
    document.getElementById("d-dob").textContent  = S(h.geboortedatum);
    document.getElementById("d-chip").textContent = S(h.chip);
    document.getElementById("d-owner").innerHTML  = eigenaar
      ? `<a href="../klanten/detail.html?id=${eigenaar.id}">${ensureNaam(eigenaar)}</a>`
      : "—";

    loader.style.display = "none";
    sec.style.display = "";
  } catch (e) {
    loader.style.display = "none";
    error.style.display = "block";
    error.textContent = "⚠️ " + e.message;
  }
}

init();
