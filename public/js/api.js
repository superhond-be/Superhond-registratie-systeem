// /public/js/api.js
// v0.22.3 — Superhond API Helper
// Centrale fetch-functies voor Apps Script Web App
// - gebruikt SuperhondConfig._resolved als primaire API-base
// - automatische JSON-validatie + HTML-fallbackdetectie
// - eenvoudige GET/POST helpers

/* global SuperhondConfig */

(() => {
  const DEFAULT_BASE =
    "https://script.google.com/macros/s/AKfycbzprHaU1ukJT03YLQ6I5EzR1LOq_45tzWNLo-d92rJuwtRat6Qf_b8Ydt-0qoZBIctVNA/exec";

  const TIMEOUT_MS = 10000;

  // ===== Intern =====
  const strip = s => String(s || "").replace(/^\uFEFF/, "").trim();
  const isHTML = t => /^\s*</.test(strip(t).slice(0, 150).toLowerCase());

  async function fetchWithTimeout(url, opts = {}, ms = TIMEOUT_MS) {
    const ac = "AbortController" in window ? new AbortController() : null;
    const t = ac ? setTimeout(() => ac.abort("timeout"), ms) : null;
    try {
      const r = await fetch(url, { cache: "no-store", ...opts, signal: ac?.signal });
      return r;
    } finally {
      if (t) clearTimeout(t);
    }
  }

  function getBase() {
    return (
      window.SuperhondConfig?._resolved ||
      (typeof localStorage !== "undefined" && localStorage.getItem("superhond_api_base")) ||
      DEFAULT_BASE
    );
  }

  async function handleResponse(r) {
    const txt = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    if (isHTML(txt)) throw new Error("HTML/login ontvangen – controleer je Web App URL");
    let j;
    try {
      j = JSON.parse(strip(txt));
    } catch {
      throw new Error("Geen geldig JSON-antwoord ontvangen");
    }
    if (j?.ok === false) throw new Error(j?.error || "API-fout");
    return j?.data ?? j;
  }

  // ===== GET =====
  async function apiGet(mode, params = {}) {
    const base = getBase();
    const usp = new URLSearchParams({ mode, t: Date.now(), ...params });
    const url = `${base}?${usp.toString()}`;
    const r = await fetchWithTimeout(url, { method: "GET" });
    return handleResponse(r);
  }

  // ===== POST =====
  async function apiPost(mode, payload = {}) {
    const base = getBase();
    const url = `${base}?mode=${encodeURIComponent(mode)}`;
    // text/plain voorkomt CORS preflight bij Apps Script
    const r = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload)
    });
    return handleResponse(r);
  }

  // ===== Exporteer globaal of als module =====
  const api = {
    getKlanten: () => apiGet("klanten"),
    getHonden:  () => apiGet("honden"),
    getKlassen: () => apiGet("klassen"),
    getReeksen: () => apiGet("reeksen"),
    getLessen:  () => apiGet("lessen"),
    saveKlant:  k => apiPost("saveKlant", k),
    saveHond:   h => apiPost("saveHond", h),
    apiGet,
    apiPost
  };

  // Compatibel met zowel <script> als ES-modules
  if (typeof window !== "undefined") window.SuperhondAPI = api;
  if (typeof export !== "undefined" || typeof exports !== "undefined") {
    try { export default api; } catch {}
  }
})();
