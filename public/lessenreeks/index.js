import { debounce } from "../js/store.js";

const loader = document.getElementById("loader");
const error  = document.getElementById("error");
const tbody  = document.querySelector("#tabel tbody");
const zoek   = document.getElementById("zoek");

const S = v => String(v ?? "");
let reeksenCache = [];

function rowHtml(r) {
  return `
    <tr>
      <td><a href="./detail.html?id=${r.id}">${S(r.naam)}</a></td>
      <td>${S(r.thema)}</td>
      <td>${S(r.aantalLessen || r.aantal || "")}</td>
      <td>${r.prijs ? `€ ${r.prijs}` : "—"}</td>
    </tr>`;
}

function render(filter="") {
  const f = S(filter).trim().toLowerCase();
  const lijst = (reeksenCache || [])
    .filter(r => !f || S(r.naam).toLowerCase().includes(f) || S(r.thema).toLowerCase().includes(f))
    .sort((a,b) => S(a.naam).localeCompare(S(b.naam)));

  tbody.innerHTML = lijst.map(rowHtml).join("");
  loader.style.display = "none";
  document.getElementById("wrap").style.display = lijst.length ? "" : "none";
}

async function init() {
  try {
    const r = await fetch("../data/lessenreeksen.json");
    reeksenCache = await r.json();
    render();
  } catch (e) {
    loader.style.display = "none";
    error.style.display = "block";
    error.textContent = "⚠️ " + e.message;
  }
}

zoek.addEventListener("input", debounce(() => render(zoek.value), 300));

init();
