import { ensureData, getHonden, getKlanten, byId } from "/js/store.js";

const id = new URLSearchParams(location.search).get("id");
const loader = document.getElementById("loader");
const error  = document.getElementById("error");
const sec    = document.getElementById("hond");

async function init() {
  try {
    await ensureData();
    const honden = getHonden();
    const klanten = getKlanten();
    const h = byId(honden, id);
    if (!h) throw new Error(`Hond met id=${id} niet gevonden`);
    const eigenaar = byId(klanten, h.eigenaarId);

    document.getElementById("d-naam").textContent = h.naam || "";
    document.getElementById("d-ras").textContent  = h.ras || "";
    document.getElementById("d-dob").textContent  = h.geboortedatum || "";
    document.getElementById("d-chip").textContent = h.chip || "";
    document.getElementById("d-owner").innerHTML  = eigenaar
      ? `<a href="/klanten/detail.html?id=${eigenaar.id}">${eigenaar.naam}</a>`
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
