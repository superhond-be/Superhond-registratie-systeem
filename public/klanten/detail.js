// /public/klanten/detail.js
// v0.22.4 — Klant detail (store.js buckets + fallback naar /api/* of /data/*)

import { ensureMigrated, getKlanten, getHonden } from "../js/store.js";

// ---------- kleine utils ----------
const S  = (v) => String(v ?? "");
const T  = (v) => S(v).trim();

function byId(id) { return document.getElementById(id) || null; }
function setText(id, val) { const el = byId(id); if (el) el.textContent = S(val); }
function show(el, on = true) { if (el) el.style.display = on ? "" : "none"; }

function guessNameFromEmail(email) {
  const local = T(email).split("@")[0];
  return local
    .split(/[._-]+/)
    .map(x => (x ? x[0].toUpperCase() + x.slice(1) : ""))
    .join(" ")
    .trim();
}

function ensureNaam(k) {
  const n = T(k.naam);
  if (n) return n;
  const comb = [T(k.voornaam), T(k.achternaam)].filter(Boolean).join(" ").trim();
  return comb || guessNameFromEmail(k.email) || `Klant #${k.id ?? ""}`.trim();
}

function fmtAdres(k = {}) {
  // bouw adres uit losse velden; val terug op k.adres als die ooit bestaat
  const p1 = [T(k.straat), [T(k.huisnr), T(k.bus)].filter(Boolean).join("")].filter(Boolean).join(" ");
  const p2 = [T(k.postcode), T(k.gemeente)].filter(Boolean).join(" ");
  const composed = [p1, p2].filter(Boolean).join(", ");
  return composed || T(k.adres) || "—";
}

function cacheBust(url) {
  try {
    const u = new URL(url, location.origin);
    u.searchParams.set("t", Date.now());
    return u.toString();
  } catch {
    // fallback voor relatieve strings
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}t=${Date.now()}`;
  }
}

async function fetchJson(candidates, { timeout = 9000 } = {}) {
  for (const base of candidates) {
    const url = cacheBust(base);
    const ac = ("AbortController" in window) ? new AbortController() : null;
    const to = ac ? setTimeout(() => ac.abort(), timeout) : null;
    try {
      const r = await fetch(url, { cache: "no-store", signal: ac?.signal });
      if (r.ok) {
        const j = await r.json().catch(() => null);
        if (j) return j;
      }
    } catch (_) {
      // volgende kandidaat proberen
    } finally {
      if (to) clearTimeout(to);
    }
  }
  return null;
}

function hondenVanKlant(honden, klantId) {
  const idStr = String(klantId);
  return (honden || [])
    .map(h => ({
      ...h,
      // normaliseer eigenaar-id velden
      eigenaarId:
        h.eigenaarId ??
        h.eigenaar_id ??
        h.ownerId ??
        h.klantId ??
        h.klant_id ??
        ""
    }))
    .filter(h => String(h.eigenaarId) === idStr)
    .sort((a, b) => T(a.naam).localeCompare(T(b.naam)));
}

// ---------- main ----------
const params = new URLSearchParams(location.search);
const id = params.get("id");

const loader = byId("loader");
const error  = byId("error");
const sec    = byId("klant");

async function init() {
  if (!id) {
    show(loader, false);
    show(error, true);
    if (error) error.textContent = "⚠️ Geen id meegegeven in de URL.";
    return;
  }

  try {
    // 1) snelle weg: buckets
    await ensureMigrated();
    let klanten = getKlanten() || [];
    let honden  = getHonden()  || [];

    // 2) fallback naar API/JSON als buckets leeg zijn
    if (!klanten.length) {
      const js = await fetchJson(["../api/klanten", "../data/klanten.json"]);
      if (Array.isArray(js)) klanten = js;
      else if (Array.isArray(js?.items)) klanten = js.items;
      else if (Array.isArray(js?.data))  klanten = js.data;
    }
    if (!honden.length) {
      const jh = await fetchJson(["../api/honden", "../data/honden.json"]);
      if (Array.isArray(jh)) honden = jh;
      else if (Array.isArray(jh?.items)) honden = jh.items;
      else if (Array.isArray(jh?.data))  honden = jh.data;
    }

    const k = (klanten || []).find(x => String(x?.id) === String(id));
    if (!k) throw new Error(`Klant met id=${id} niet gevonden`);

    // Vul velden (textContent = veilig)
    setText("d-naam",        ensureNaam(k));
    setText("d-voornaam",    T(k.voornaam));
    setText("d-achternaam",  T(k.achternaam));
    setText("d-email",       T(k.email));
    setText("d-telefoon",    T(k.telefoon));
    setText("d-adres",       fmtAdres(k));
    setText("d-land",        T(k.land));

    // Honden-chips
    const list = hondenVanKlant(honden, k.id);
    const wrap = byId("honden");
    if (wrap) {
      wrap.innerHTML = "";
      if (list.length) {
        for (const h of list) {
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
    }

    show(loader, false);
    show(sec, true);
    show(error, false);
  } catch (e) {
    console.error("[klanten/detail] fout:", e);
    show(loader, false);
    show(error, true);
    if (error) error.textContent = "⚠️ " + (e?.message || e);
  }
}

init();
