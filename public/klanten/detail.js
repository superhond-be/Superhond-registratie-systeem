// /klanten/detail.js
import { ensureMigrated, getKlanten, getHonden } from "../js/store.js";

const params = new URLSearchParams(location.search);
const id     = params.get("id");

const loader = document.getElementById("loader");
const error  = document.getElementById("error");
const sec    = document.getElementById("klant");

const S = v => String(v ?? "");
const T = v => S(v).trim();
const esc = s => S(s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#39;");

function guessNameFromEmail(email){
  const local = T(email).split("@")[0];
  return local.split(/[._-]+/)
    .map(x => x ? x[0].toUpperCase() + x.slice(1) : "")
    .join(" ").trim();
}

function ensureNaam(k){
  const n = T(k.naam);
  if (n) return n;
  const comb = [T(k.voornaam), T(k.achternaam)].filter(Boolean).join(" ").trim();
  return comb || guessNameFromEmail(k.email) || `Klant #${k.id ?? ""}`.trim();
}

function fmtAdres(k = {}){
  // bouw adres uit losse velden; val terug op k.adres als die ooit bestaat
  const p1 = [T(k.straat), [T(k.huisnr), T(k.bus)].filter(Boolean).join("")].filter(Boolean).join(" ");
  const p2 = [T(k.postcode), T(k.gemeente)].filter(Boolean).join(" ");
  const composed = [p1, p2].filter(Boolean).join(", ");
  return composed || T(k.adres) || "—";
}

const bust = () => "?t=" + Date.now();

async function fetchJson(tryUrls) {
  for (const u of tryUrls) {
    try {
      const r = await fetch(u + bust(), { cache: "no-store" });
      if (r.ok) return r.json();
    } catch (_) {}
  }
  return null;
}

function hondenVanKlant(honden, klantId){
  return (honden || [])
    .filter(h => String(h.eigenaarId ?? h.ownerId ?? h.klantId) === String(klantId))
    .sort((a,b) => T(a.naam).localeCompare(T(b.naam)));
}

async function init() {
  if (!id) {
    loader.style.display = "none";
    error.style.display = "block";
    error.textContent = "⚠️ Geen id meegegeven in de URL.";
    return;
  }

  try {
    // 1) snelle weg: buckets
    ensureMigrated();
    let klanten = getKlanten() || [];
    let honden  = getHonden()  || [];

    // 2) fallback naar API/JSON als buckets leeg zijn
    if (!klanten.length) {
      const js = await fetchJson(["../api/klanten","../data/klanten.json"]);
      if (Array.isArray(js)) klanten = js;
      else if (Array.isArray(js?.items)) klanten = js.items;
    }
    if (!honden.length) {
      const jh = await fetchJson(["../api/honden","../data/honden.json"]);
      if (Array.isArray(jh)) honden = jh;
      else if (Array.isArray(jh?.items)) honden = jh.items;
    }

    const k = (klanten || []).find(x => String(x?.id) === String(id));
    if (!k) throw new Error(`Klant met id=${id} niet gevonden`);

    // Vul velden (textContent = veilig)
    document.getElementById("d-naam").textContent       = ensureNaam(k);
    document.getElementById("d-voornaam").textContent   = T(k.voornaam);
    document.getElementById("d-achternaam").textContent = T(k.achternaam);
    document.getElementById("d-email").textContent      = T(k.email);
    document.getElementById("d-telefoon").textContent   = T(k.telefoon);
    document.getElementById("d-adres").textContent      = fmtAdres(k);
    document.getElementById("d-land").textContent       = T(k.land);

    // Honden-chips (bouw DOM i.p.v. innerHTML-concat)
    const list = hondenVanKlant(honden, k.id);
    const wrap = document.getElementById("honden");
    wrap.innerHTML = ""; // clear

    if (list.length) {
      for (const h of list){
        const chip = document.createElement("span");
        chip.className = "chip";
        const a = document.createElement("a");
        a.href = `../honden/detail.html?id=${encodeURIComponent(h.id)}`;
        a.textContent = T(h.naam) || "Hond";
        chip.appendChild(a);
        wrap.appendChild(chip);
      }
    } else {
      const chip = document.createElement("span");
      chip.className = "chip more";
      chip.textContent = "Geen honden";
      wrap.appendChild(chip);
    }

    loader.style.display = "none";
    sec.style.display = "";
  } catch (e) {
    loader.style.display = "none";
    error.style.display = "block";
    error.textContent = "⚠️ " + (e.message || e);
  }
}

init();
