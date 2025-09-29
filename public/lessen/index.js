import { ensureData, getHonden, debounce } from "../js/store.js";

const loader = document.getElementById("loader");
const error  = document.getElementById("error");
const tbody  = document.querySelector("#tabel tbody");
const zoek   = document.getElementById("zoek");

const S = v => String(v ?? "");
const byId = (list, id) => (list || []).find(x => String(x?.id) === String(id));

let lessenCache = [];
let hondenCache = [];

function rowHtml(l) {
  const hond = byId(hondenCache, l.hondId);
  const hondCell = hond
    ? `<a href="../honden/detail.html?id=${hond.id}">${S(hond.naam)}</a>`
    : "—";

  return `
    <tr>
      <td><a href="./detail.html?id=${l.id}">${S(l.naam)}</a></td>
      <td>${S(l.datum)}</td>
      <td>${S(l.locatie)}</td>
      <td>${S(l.trainer)}</td>
      <td>${hondCell}</td>
    </tr>`;
}

function render(filter="") {
  const f = S(filter).trim().toLowerCase();
  const lijst = (lessenCache || [])
    .filter(l => !f || S(l.naam).toLowerCase().includes(f) || S(l.locatie).toLowerCase().includes(f))
    .sort((a,b) => S(a.datum).localeCompare(S(b.datum)));

  tbody.innerHTML = lijst.map(rowHtml).join("");
  loader.style.display = "none";
  document.getElementById("wrap").style.display = lijst.length ? "" : "none";
}

async function init() {
  try {
    await ensureData();
    hondenCache = getHonden() || [];

    // lessen inladen
    const r = await fetch("../data/lessen.json");
    lessenCache = await r.json();

    render();
  } catch (e) {
    loader.style.display = "none";
    error.style.display = "block";
    error.textContent = "⚠️ " + e.message;
  }
}

zoek.addEventListener("input", debounce(() => render(zoek.value), 300));

init();
