// /lessenreeks/nieuw.js
(() => {
  const $  = (s) => document.querySelector(s);
  const S  = (v) => String(v ?? "").trim();

  // --- Mount topbar ---------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title: "Nieuwe lessenreeks", icon: "📦", back: "./" });
    }
  });

  // --- Helpers --------------------------------------------------------------
  async function fetchJson(tryUrls) {
    for (const u of tryUrls) {
      try {
        const url = u + (u.includes("?") ? "&" : "?") + "t=" + Date.now();
        const r = await fetch(url, { cache: "no-store" });
        if (r.ok) return r.json();
      } catch (_) {}
    }
    return null;
  }

  function loadDB() {
    try {
      const raw = localStorage.getItem("superhond-db");
      const db  = raw ? JSON.parse(raw) : {};
      db.classes = Array.isArray(db.classes) ? db.classes : [];
      db.klassen = Array.isArray(db.klassen) ? db.klassen : [];
      return db;
    } catch {
      return { classes: [], klassen: [] };
    }
  }

  function normalizeClasses(raw) {
    const arr =
      Array.isArray(raw)           ? raw :
      Array.isArray(raw?.klassen)  ? raw.klassen :
      Array.isArray(raw?.classes)  ? raw.classes :
      Array.isArray(raw?.items)    ? raw.items :
      Array.isArray(raw?.data)     ? raw.data  : [];

    return arr.map((k) => ({
      id:   k.id ?? k.classId ?? k.klasId ?? null,
      naam: S(k.naam || k.name || ""),
      type: S(k.type || ""),
      thema: S(k.thema || k.theme || ""),
      strippen: Number(k.strippen ?? k.aantal_strips ?? 0) || 0,
      geldigheid_weken: Number(k.geldigheid_weken ?? k.geldigheid ?? 0) || 0,
      status: S(k.status || "actief").toLowerCase()
    })).filter(k => k.id || k.naam);
  }

  function mergeById(primary = [], secondary = []) {
    // secondary eerst (lokaal), primary overschrijft (extern)
    const key = (x) => S(x.id) || S(x.naam);
    const map = new Map(secondary.map((x) => [key(x), x]));
    for (const p of primary) map.set(key(p), p);
    return [...map.values()];
  }

  function setIfPresent(id, value, makeReadonly = false) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = String(value ?? "");
    if (makeReadonly) {
      // readOnly werkt op text/number; op select gebruiken we disabled
      if (el.tagName === "SELECT") el.disabled = true;
      else el.readOnly = true;
      el.classList.add("readonly");
    }
  }

  function setIfEmpty(id, value, makeReadonly = false) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!S(el.value)) {
      el.value = String(value ?? "");
      if (makeReadonly) {
        if (el.tagName === "SELECT") el.disabled = true;
        else el.readOnly = true;
        el.class
