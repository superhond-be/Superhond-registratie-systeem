/* superhond-api.js – gedeelde API-helpers */
(() => {
  const BASE = window.SuperhondConfig?.apiBase;
  if (!BASE) {
    console.error("❌ Geen API-URL gevonden in SuperhondConfig!");
  }

  async function apiGet(mode, params = {}) {
    const usp = new URLSearchParams({ mode, t: Date.now(), ...params });
    const res = await fetch(`${BASE}?${usp}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json().catch(() => {
      throw new Error("Ongeldige JSON van API");
    });
    if (!data.ok) throw new Error(data.error || "Onbekende API-fout");
    return data.data;
  }

  async function apiPost(mode, payload = {}) {
    const res = await fetch(`${BASE}?mode=${encodeURIComponent(mode)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => {
      throw new Error("Ongeldige JSON van API");
    });
    if (!data.ok) throw new Error(data.error || "Onbekende API-fout");
    return data.data;
  }

  window.SuperhondAPI = { get: apiGet, post: apiPost };
})();
