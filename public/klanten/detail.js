import { ensureData, getKlanten, getHonden, setKlanten, byId } from "/js/store.js";

const params = new URLSearchParams(location.search);
const id = params.get("id");

const loader = document.getElementById("loader");
const error  = document.getElementById("error");
const secKlant = document.getElementById("klant");
const secHonden = document.getElementById("honden");

const dNaam = document.getElementById("d-naam");
const dEmail = document.getElementById("d-email");
const dTel = document.getElementById("d-telefoon");
const dAdres = document.getElementById("d-adres");
const dLand = document.getElementById("d-land");
const hondenBody = document.getElementById("honden-body");
const btnEdit = document.getElementById("btn-edit");
const btnNieuweHond = document.getElementById("btn-nieuwe-hond");

let klant;
let honden;

async function init() {
  try {
    await ensureData();
    const klanten = getKlanten();
    honden = getHonden();
    klant = byId(klanten, id);
    if (!klant) throw new Error(`Klant met id=${id} niet gevonden`);

    dNaam.textContent = klant.naam || "";
    dEmail.textContent = klant.email || "";
    dTel.textContent = klant.telefoon || "";
    dAdres.textContent = klant.adres || "";
    dLand.textContent = klant.land || "";

    const list = honden.filter(h => String(h.eigenaarId) === String(id));
    hondenBody.innerHTML = list.map(h => `
      <tr>
        <td><a href="/honden/detail.html?id=${h.id}">${h.naam}</a></td>
        <td>${h.ras || ""}</td>
        <td>${h.geboortedatum || ""}</td>
        <td style="text-align:right"><a href="/honden/index.html?owner=${id}">✏️ Wijzig in Honden</a></td>
      </tr>
    `).join("");

    btnNieuweHond.href = `/honden/index.html?owner=${id}`;
    loader.style.display = "none";
    secKlant.style.display = "";
    secHonden.style.display = "";
  } catch (e) {
    loader.style.display = "none";
    error.style.display = "block";
    error.textContent = "⚠️ " + e.message;
  }
}

btnEdit?.addEventListener("click", async () => {
  const naam = prompt("Naam:", klant.naam || "");
  if (!naam) return;
  const email = prompt("E-mail:", klant.email || "");
  const telefoon = prompt("Telefoon:", klant.telefoon || "");
  const adres = prompt("Adres:", klant.adres || "");
  const land = prompt("Land (BE/NL):", klant.land || "BE");

  const klanten = getKlanten();
  const i = klanten.findIndex(k => String(k.id) === String(klant.id));
  if (i >= 0) {
    klanten[i] = { ...klanten[i], naam, email, telefoon, adres, land };
    setKlanten(klanten);
    location.reload();
  }
});

init();
