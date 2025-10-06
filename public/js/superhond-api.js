<script>
;(() => {
  async function apiGet(mode, params = {}) {
    const API_BASE = window.SuperhondConfig?.getApiBase() || "";
    if (!API_BASE) throw new Error("API_BASE ontbreekt (stel die in via config).");

    const usp = new URLSearchParams({ mode, t: Date.now(), ...params });
    let res;
    try {
      res = await fetch(`${API_BASE}?${usp.toString()}`, { method: "GET", cache: "no-store" });
    } catch {
      throw new Error("Geen verbinding met de API");
    }

    const txt = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let j; try { j = JSON.parse(txt); } catch { throw new Error("Ongeldige JSON van API"); }
    if (!j.ok) throw new Error(j.error || "Onbekende API-fout");
    return j.data;
  }

  async function apiPost(mode, payload = {}) {
    const API_BASE = window.SuperhondConfig?.getApiBase() || "";
    if (!API_BASE) throw new Error("API_BASE ontbreekt (stel die in via config).");

    let res;
    try {
      res = await fetch(`${API_BASE}?mode=${encodeURIComponent(mode)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch {
      throw new Error("Geen verbinding met de API");
    }

    const txt = await res.text();
    let j; try { j = JSON.parse(txt); } catch { throw new Error("Ongeldige JSON van API"); }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!j.ok) throw new Error(j.error || "Onbekende API-fout");
    return j.data;
  }

  window.SuperhondAPI = { get: apiGet, post: apiPost };
})();
</script>
