import { ensureData, getHonden } from "../js/store.js";

const id = new URLSearchParams(location.search).get("id");

const loader = document.getElementById("loader");
const error  = document.getElementById("error");
const sec    = document.getElementById("les");

const S = v => String(v ?? "");
const byId = (list, _id) => (list || []).find(x => String(x?.id) === String(_id));

async function init() {
  try {
    await ensureData();
    const honden = getHonden() || [];

    // lessen uit JSON
    const r = await fetch("../data/lessen.json");
    const lessen = await r.json();

    const l = byId(lessen, id);
    if (!l) throw new Error(`Les met id=${id} niet gevonden`);

    document.getElementById("d-naam").textContent    = S(l.naam);
    document.getElementById("d-datum").textContent   = S(l.datum);
    document.getElementById("d-locatie").textContent = S(l.locatie);
    document.getElementById("d-trainer").textContent = S(l.trainer);

    // toon hond als link
    const hond = byId(honden, l.hondId);
    document.getElementById("d-hond").innerHTML = hond
      ? `<a href="../honden/detail.html?id=${hond.id}">${S(hond.naam)}</a>`
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
