// /honden/detail.js
import { ensureData, getHonden, getKlanten } from "/js/store.js";

const S = v => String(v ?? "");
const T = v => S(v).trim();

const params = new URLSearchParams(location.search);
const id = params.get("id");

const loader = document.getElementById("loader");
const error  = document.getElementById("error");
const box    = document.getElementById("hond");

// velden
const fNaam   = document.getElementById("d-naam");
const fRas    = document.getElementById("d-ras");
const fGeb    = document.getElementById("d-geboortedatum");
const fChip   = document.getElementById("d-chip");
const fOwner  = document.getElementById("d-eigenaar");

// owner helpers
const getEigenaarId = h => h?.eigenaarId ?? h?.ownerId ?? h?.klantId ?? h?.eigenaar ?? h?.owner ?? null;

function fmtDate(isoLike){
  const v = T(isoLike);
  if (!v) return "—";
  // accepteer YYYY-MM-DD of alles wat Date begrijpt
  const d = v.match(/^\d{4}-\d{2}-\d{2}$/) ? new Date(v + "T00:00:00") : new Date(v);
  if (isNaN(d)) return v; // toon zoals is als parse niet lukt
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function klantNaam(k){
  if (!k) return "—";
  const comb = [T(k.voornaam), T(k.achternaam)].filter(Boolean).join(" ");
  if (comb) return comb;
  if (T(k.naam)) return T(k.naam);
  const local = S(k.email).split("@")[0] || "";
  return local.split(/[._-]+/).map(s => s ? s[0].toUpperCase()+s.slice(1) : "").join(" ").trim() || `Klant #${k.id}`;
}

async function init(){
  try{
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title: "Hond detail", icon: "🐶", back: "/honden/" });
    }

    if (!id) throw new Error("Geen id opgegeven in de URL.");

    await ensureData();
    const honden  = getHonden()  || [];
    const klanten = getKlanten() || [];

    const hond = honden.find(h => String(h?.id) === String(id));
    if (!hond) throw new Error(`Hond met id=${id} niet gevonden.`);

    // velden invullen
    fNaam.textContent = T(hond.naam) || `Hond #${id}`;
    fRas.textContent  = T(hond.ras) || "—";
    fGeb.textContent  = fmtDate(hond.geboortedatum);
    fChip.textContent = T(hond.chip) || "—";

    const ownerId = getEigenaarId(hond);
    const eigenaar = (klanten || []).find(k => String(k?.id) === String(ownerId));
    if (eigenaar) {
      const nm = klantNaam(eigenaar);
      fOwner.innerHTML = `<a href="/klanten/detail.html?id=${encodeURIComponent(eigenaar.id)}">${nm}</a>`;
    } else {
      fOwner.textContent = "—";
    }

    loader.style.display = "none";
    error.style.display  = "none";
    box.style.display    = "";
  }catch(e){
    loader.style.display = "none";
    error.style.display  = "block";
    error.textContent    = "⚠️ " + (e.message || e);
    box.style.display    = "none";
    console.error(e);
  }
}

document.addEventListener("DOMContentLoaded", init);
