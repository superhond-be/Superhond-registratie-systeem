/* v0.21.1 – Hondenlijst via Google Apps Script API (stabiel + config support) */
(async () => {
  // === 🔗 Google Apps Script Web-App URL ===
  // Probeer eerst een centrale config (config.js met window.SUPERHOND_DATA.API_BASE)
  // Val anders terug op jouw vaste web-app URL.
  const API_BASE =
    (window.SUPERHOND_DATA && window.SUPERHOND_DATA.API_BASE) ||
    "https://script.google.com/macros/s/AKfycbzprHaU1ukJT03YLQ6I5EzR1LOq_45tzWNLo-d92rJuwtRat6Qf_b8Ydt-0qoZBIctVNA/exec";

  // === 🧩 DOM-elementen ===
  const els = {
    body:   document.querySelector("#honden-tbody"),
    meta:   document.querySelector("#honden-meta"),
    loader: document.querySelector("#honden-loader"),
    error:  document.querySelector("#honden-error")
  };

  // === 💬 UI helpers ===
  function showLoader(on = true) {
    if (els.loader) els.loader.hidden = !on;
  }
  function showError(msg = "") {
    if (els.error) {
      els.error.textContent = msg;
      els.error.hidden = !msg;
    }
  }

  // === 🌐 API helper ===
  async function apiGet(mode, params = {}) {
    if (!API_BASE) throw new Error("API_BASE ontbreekt (config.js niet geladen?)");
    const usp = new URLSearchParams({ mode, t: Date.now(), ...params });

    let res;
    try {
      res = await fetch(`${API_BASE}?${usp.toString()}`, { method: "GET", cache: "no-store" });
    } catch {
      throw new Error("Geen verbinding met de API");
    }

    const txt = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let j;
    try { j = JSON.parse(txt); } catch { throw new Error("Ongeldige JSON van API"); }
    if (!j.ok) throw new Error(j.error || "Onbekende API-fout");
    return j.data;
  }

  // === 🧠 Normalisatie (Sheet → UI-model) ===
  function normKlant(k) {
    const full = String(k.naam || "").trim();
    const [voornaam, ...rest] = full.split(/\s+/);
    const achternaam = rest.join(" ");
    let plaats = "";
    if (k.adres) {
      const parts = String(k.adres).split(",");
      plaats = (parts[1] || parts[0] || "").trim();
    }
    return { id: k.id || "", voornaam, achternaam, plaats };
  }

  function normHond(h) {
    return {
      id: h.id || "",
      eigenaarId: h.eigenaar_id || h.eigenaarId || "",
      naam: h.naam || "",
      ras: h.ras || "",
      geboortedatum: h.geboortedatum || "",
    };
  }

  // === 🚀 Main ===
  try {
    showLoader(true);
    showError("");

    // Haal data rechtstreeks uit Apps Script (in parallel)
    const [dogsRaw, klantenRaw] = await Promise.all([
      apiGet("honden"),
      apiGet("klanten")
    ]);

    const honden = dogsRaw.map(normHond);
    const klanten = klantenRaw.map(normKlant);
    const kById = Object.fromEntries(klanten.map(k => [k.id, k]));

    // === 🧾 Tabelrendering ===
    els.body.innerHTML = honden.map(h => {
      const e = kById[h.eigenaarId];
      const eigenaarNaam = e ? `${e.voornaam || ""} ${e.achternaam || ""}`.trim() : "—";
      const plaats = e?.plaats || "";
      return `
        <tr>
          <td><a href="/honden/detail.html?id=${h.id}"><strong>${h.naam || "—"}</strong></a></td>
          <td>${h.ras || "—"}</td>
          <td>${h.geboortedatum || "—"}</td>
          <td>${
            e
              ? `<a href="/klanten/detail.html?id=${e.id}">${eigenaarNaam || "(naam onbekend)"}</a> <small class="muted">${plaats}</small>`
              : "—"
          }</td>
        </tr>`;
    }).join("");

    if (els.meta) els.meta.textContent = `✅ Geladen: ${honden.length} honden`;
    showLoader(false);
  } catch (err) {
    console.error("❌ Fout bij laden van honden:", err);
    showLoader(false);
    showError("Fout bij laden van honden: " + err.message);
  }
})();
