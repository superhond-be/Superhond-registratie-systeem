// public/js/api.js  (nieuw of vervang je huidige helper)
const API_BASE = "https://script.google.com/macros/s/AKfycbzZP5jnYyjzOzrXaZfg1KL5UMqBFXVfIyyC14YYsyCaVbREPdAQPm_cxVvagM-0nP3cWg/exec";

async function apiGet(mode, params = {}) {
  const usp = new URLSearchParams({ mode, t: Date.now(), ...params });
  const r = await fetch(`${API_BASE}?${usp.toString()}`, { method: "GET" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Onbekende fout");
  return j.data;
}

async function apiPost(mode, payload) {
  // text/plain voorkomt CORS preflight bij Apps Script
  const r = await fetch(`${API_BASE}?mode=${encodeURIComponent(mode)}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(payload ?? {})
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Onbekende fout");
  return j.data;
}

// Convenience
export const getKlanten = () => apiGet("klanten");
export const getHonden  = () => apiGet("honden");
export const saveKlant  = (k) => apiPost("saveKlant", k);
export const saveHond   = (h) => apiPost("saveHond", h);
