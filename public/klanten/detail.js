import { ensureData, getKlanten, getHonden } from "../js/store.js";

const id = new URLSearchParams(location.search).get("id");

const loader = document.getElementById("loader");
const error  = document.getElementById("error");
const sec    = document.getElementById("klant");

const S = v => String(v ?? "");

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
    const klanten = getKlanten() || [];
    const honden  = getHonden() || [];

    const k = klanten.find(x => String(x.id) === String(id));
    if (!k) throw new Error(`Klant met id=${id} niet gevonden`);

    document.getElementById("d-naam").textContent      = ensureNaam(k);
    document.getElementById("d-voornaam").textContent  = S(k.voornaam);
    document.getElementById("d-achternaam").textContent= S(k.achternaam);
    document.getElementById("d-email").textContent     = S(k.email);
    document.getElementById("d-telefoon").textContent  = S(k.telefoon);
    document.getElementById("d-adres").textContent     = S(k.adres);
    document.getElementById("d-land").textContent      = S(k.land);

    // honden chips
    const lijst = honden.filter(h => String(h.eigenaarId ?? h.ownerId ?? h.klantId) === String(k.id));
    const div = document.getElementById("honden");
    if (lijst.length) {
      div.innerHTML = lijst.map(h => `
        <span class="chip"><a href="../honden/detail.html?id=${h.id}">${S(h.naam)}</a></span>
      `).join("");
    } else {
      div.innerHTML = `<span class="chip more">Geen honden</span>`;
    }

    loader.style.display = "none";
    sec.style.display = "";
  } catch (e) {
    loader.style.display = "none";
    error.style.display = "block";
    error.textContent = "⚠️ " + e.message;
  }
}

init();
