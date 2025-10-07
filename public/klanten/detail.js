/public/klanten/detail.js
```js
// v0.23.0 — Klant detail (buckets + centrale API + proxy + demo JSON fallbacks)
// - Gebruikt SuperhondConfig.getApiBaseSync() als primaire API
// - mailto/tel voor #d-email / #d-telefoon als anchors

import { ensureMigrated, getKlanten, getReeksen, getKlassen, getLessen } from "../js/store.js";
// getHonden is niet altijd aanwezig in oudere store.js versies; we vangen dat op:
import * as Store from "../js/store.js";

/* ========== utils ========== */
const S = v => String(v ?? "");
const T = v => S(v).trim();

const byId   = id => document.getElementById(id) || null;
const show   = (el, on = true) => { if (el) el.style.display = on ? "" : "none"; };
const setTxt = (id, val) => { const el = byId(id); if (el) el.textContent = S(val); };

function guessNameFromEmail(email){
  const local = T(email).split("@")[0];
  return local
    .split(/[._-]+/)
    .map(x => x ? x[0].toUpperCase() + x.slice(1) : "")
    .join(" ").trim();
}
function ensureNaam(k){
  const n = T(k.naam);
  if (n) return n;
  const comb = [T(k.voornaam), T(k.achternaam)].filter(Boolean).join(" ").trim();
  return comb || guessNameFromEmail(k.email) || `Klant #${T(k.id) || "?"}`;
}
function fmtAdres(k = {}){
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
    return `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
  }
}

/* ========== centrale fetch helper (API → proxy → data) ========== */
function isHTML(txt){ return /^\s*</.test(String(txt || "").trim()); }

async function fetchJson(candidates, { timeout = 9000 } = {}) {
  let lastErr = null;
  for (const base of candidates.filter(Boolean)) {
    const url = cacheBust(base);
    const ac  = ("AbortController" in window) ? new AbortController() : null;
    const to  = ac ? setTimeout(() => ac.abort(), timeout) : null;
    try {
      const r = await fetch(url, { cache: "no-store", signal: ac?.signal });
      const text = await r.text();
      if (!r.ok) { lastErr = new Error(`HTTP ${r.status} bij ${url}`); continue; }
      if (isHTML(text)) { lastErr = new Error(`Ontvangen HTML i.p.v. JSON bij ${url}`); continue; }
      try {
        return JSON.parse(text);
      } catch {
        lastErr = new Error(`Ongeldige JSON bij ${url}`);
      }
    } catch (e) {
      lastErr = e;
      // probeer volgende kandidaat
    } finally { if (to) clearTimeout(to); }
  }
  if (lastErr) throw lastErr;
  return null;
}

/* ========== data helpers ========== */
function hondenVanKlant(honden, klantId){
  const idStr = String(klantId);
  return (honden || [])
    .map(h => ({
      ...h,
      eigenaarId: h.eigenaarId ?? h.eigenaar_id ?? h.ownerId ?? h.klantId ?? h.klant_id ?? ""
    }))
    .filter(h => String(h.eigenaarId) === idStr)
    .sort((a,b) => T(a.naam).localeCompare(T(b.naam)));
}

/* ========== anchors/helpers voor mail/tel ========== */
const isEmailLike = v => !!T(v) && T(v).includes("@");
const mailtoHref  = v => isEmailLike(v) ? `mailto:${T(v)}` : "";

function normalizePhoneForHref(v){
  let s = T(v);
  if (!s) return "";
  s = s.replace(/[^\d+]/g, "");   // houd cijfers en '+' over
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  return s;
}
const telHref = v => {
  const n = normalizePhoneForHref(v);
  return n ? `tel:${n}` : "";
};

/** Zet tekst of (indien <a>) ook href. */
function setTextOrLink(id, val, kind /* 'email' | 'tel' */) {
  const el = byId(id);
  if (!el) return;
  const text = T(val);
  const isAnchor = el.tagName === "A";

  if (kind === "email") {
    if (isAnchor) {
      el.removeAttribute("href");
      const href = mailtoHref(text);
      if (href) el.setAttribute("href", href);
    }
    el.textContent = text || "—";
    return;
  }
  if (kind === "tel") {
    if (isAnchor) {
      el.removeAttribute("href");
      const href = telHref(text);
      if (href) el.setAttribute("href", href);
    }
    el.textContent = text || "—";
    return;
  }
  el.textContent = text || "—";
}

/* ========== main ========== */
const params = new URLSearchParams(location.search);
const id     = params.get("id");

const loader = byId("loader");
const error  = byId("error");
const sec    = byId("klant");

async function init(){
  if (!id) {
    show(loader, false);
    show(error,  true);
    if (error) error.textContent = "⚠️ Geen id meegegeven in de URL.";
    return;
  }

  try {
    // 0) UI buckets (snel)
    await ensureMigrated();
    // Sommige oudere store.js versies hebben geen getHonden(); gebruik dan lege array
    const safeGetHonden  = typeof Store.getHonden  === 'function' ? Store.getHonden  : () => [];
    const safeGetKlanten = typeof getKlanten       === 'function' ? getKlanten       : () => [];

    let klanten = safeGetKlanten() || [];
    let honden  = safeGetHonden()  || [];

    // 1) Centrale API-base + proxy + demo JSON: kandidaten opbouwen
    //    (SuperhondConfig komt uit /js/layout.js)
    const apiBase = (window.SuperhondConfig?.getApiBaseSync?.() || "").trim();

    // Voor klanten
    if (!klanten.length) {
      const candsK = [];
      if (apiBase) candsK.push(`${apiBase}?mode=klanten`);
      candsK.push("/api/sheets?mode=klanten");                       // Node proxy (indien aanwezig)
      candsK.push("../data/klanten.json", "/data/klanten.json");     // statische demo
      const js = await fetchJson(candsK);
      if (Array.isArray(js)) klanten = js;
      else if (Array.isArray(js?.items)) klanten = js.items;
      else if (Array.isArray(js?.data))  klanten = js.data;
    }

    // Voor honden
    if (!honden.length) {
      const candsH = [];
      if (apiBase) candsH.push(`${apiBase}?mode=honden`);
      candsH.push("/api/sheets?mode=honden");
      candsH.push("../data/honden.json", "/data/honden.json");
      const jh = await fetchJson(candsH);
      if (Array.isArray(jh)) honden = jh;
      else if (Array.isArray(jh?.items)) honden = jh.items;
      else if (Array.isArray(jh?.data))  honden = jh.data;
    }

    const k = (klanten || []).find(x => String(x?.id) === String(id));
    if (!k) throw new Error(`Klant met id=${id} niet gevonden`);

    // --- Velden invullen ---
    const naam = ensureNaam(k);
    setTxt("d-voornaam",    T(k.voornaam));
    setTxt("d-achternaam",  T(k.achternaam));
    setTextOrLink("d-email",    T(k.email),    "email");
    setTextOrLink("d-telefoon", T(k.telefoon), "tel");
    setTxt("d-adres",       fmtAdres(k));
    setTxt("d-land",        T(k.land));

    // Optioneel: als er een #d-naam element bestaat, toon samengevoegde naam
    const naamEl = byId("d-naam");
    if (naamEl) naamEl.textContent = naam;

    // --- Honden chips ---
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
    show(sec,    true);
    show(error,  false);

  } catch (e) {
    console.error("[klanten/detail] fout:", e);
    show(loader, false);
    show(error,  true);
    if (error) error.textContent = "⚠️ " + (e?.message || e);
  }
}

init();
