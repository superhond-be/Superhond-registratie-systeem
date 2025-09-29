const id = new URLSearchParams(location.search).get("id");

const loader = document.getElementById("loader");
const error  = document.getElementById("error");
const sec    = document.getElementById("reeks");

const S = v => String(v ?? "");
const byId = (list, _id) => (list || []).find(x => String(x?.id) === String(_id));

async function init() {
  try {
    const r = await fetch("../data/lessenreeksen.json");
    const reeksen = await r.json();
    const reeks = byId(reeksen, id);
    if (!reeks) throw new Error(`Reeks met id=${id} niet gevonden`);

    document.getElementById("d-naam").textContent   = S(reeks.naam);
    document.getElementById("d-thema").textContent  = S(reeks.thema);
    document.getElementById("d-aantal").textContent = S(reeks.aantalLessen || reeks.aantal || "");
    document.getElementById("d-prijs").textContent  = reeks.prijs ? `€ ${reeks.prijs}` : "—";

    loader.style.display = "none";
    sec.style.display = "";
  } catch (e) {
    loader.style.display = "none";
    error.style.display = "block";
    error.textContent = "⚠️ " + e.message;
  }
}

init();
