/* v0.21.1 – Klantenpagina (rechtstreeks Apps Script API, robuust) */
(() => {
  // 1) PLAATS HIER JE EIGEN /exec URL (zonder query parameters!)
  const API_BASE = "https://script.google.com/macros/s/AKfycbzprHaU1ukJT03YLQ6I5EzR1LOq_45tzWNLo-d92rJuwtRat6Qf_b8Ydt-0qoZBIctVNA/exec";

  // 2) DOM
  const els = {
    loader: document.querySelector("#loader"),
    error: document.querySelector("#error"),
    wrap: document.querySelector("#wrap"),
    tbody: document.querySelector("#tabel tbody"),
    btnNieuw: document.querySelector("#btn-nieuw"),
    modal: document.querySelector("#modal"),
    form: document.querySelector("#form"),
    btnCancel: document.querySelector("#btn-cancel"),
    btnSave: document.querySelector("#btn-save"),
  };

  // 3) State
  const state = {
    klanten: [],
    hondenByOwner: new Map(),
  };

  // 4) Eén harde fetch helper (GET) – leest text() en parse’t zelf → betere foutmeldingen
  async function apiGet(mode, params = {}) {
    const qs = new URLSearchParams({ mode, t: Date.now(), ...params }).toString();
    let res;
    try {
      res = await fetch(`${API_BASE}?${qs}`, { cache: "no-store" });
    } catch {
      throw new Error("Geen verbinding met de API");
    }
    const txt = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let json;
    try { json = JSON.parse(txt); } catch { throw new Error("Ongeldige JSON van API"); }
    if (!json.ok) throw new Error(json.error || "Onbekende API-fout");
    return json.data;
  }

  // 5) Normalisatie
  function normKlant(k) {
    const full = String(k.naam || "").trim();
    const [voornaam, ...r] = full.split(/\s+/);
    const achternaam = r.join(" ");
    let plaats = "";
    if (k.adres) {
      const parts = String(k.adres).split(",");
      plaats = (parts[1] || parts[0] || "").trim();
    }
    return {
      id: k.id || "",
      naam: full || "(naam onbekend)",
      voornaam,
      achternaam,
      email: k.email || "",
      telefoon: k.telefoon || "",
      plaats,
    };
  }
  const normHond = h => ({
    id: h.id || "",
    eigenaarId: h.eigenaar_id || h.eigenaarId || "",
    naam: h.naam || "",
    ras: h.ras || "",
    geboortedatum: h.geboortedatum || "",
  });

  // 6) UI helpers
  function showLoader(on = true) {
    if (els.loader) els.loader.style.display = on ? "" : "none";
    if (els.wrap) els.wrap.style.display = on ? "none" : "";
  }
  function showError(msg = "") {
    if (!els.error) return;
    els.error.textContent = msg;
    els.error.style.display = msg ? "" : "none";
  }

  // 7) Data laden
  async function loadAll() {
    showError("");
    showLoader(true);
    try {
      const [klRaw, hoRaw] = await Promise.all([
        apiGet("klanten"),
        apiGet("honden"),
      ]);
      const klanten = klRaw.map(normKlant);
      const honden  = hoRaw.map(normHond);

      const map = new Map();
      honden.forEach(h => {
        if (!map.has(h.eigenaarId)) map.set(h.eigenaarId, []);
        map.get(h.eigenaarId).push(h);
      });

      state.klanten = klanten;
      state.hondenByOwner = map;
      render();
    } catch (e) {
      console.error(e);
      showError("⚠️ " + e.message);
    } finally {
      showLoader(false);
    }
  }

  // 8) Render
  function render() {
    if (!els.tbody) return;
    els.tbody.innerHTML = state.klanten.map(k => {
      const dogs = state.hondenByOwner.get(k.id) || [];
      const dogChips = dogs.length
        ? dogs.map(d => `<a class="chip btn btn-xs" href="../honden/detail.html?id=${d.id}" title="Bekijk ${d.naam}">${d.naam}</a>`).join(" ")
        : '<span class="muted">0</span>';
      return `
        <tr data-id="${k.id}">
          <td><a href="./detail.html?id=${k.id}"><strong>${k.naam}</strong></a></td>
          <td>${k.email ? `<a href="mailto:${k.email}">${k.email}</a>` : "—"}</td>
          <td>${k.telefoon || "—"}</td>
          <td>${dogChips}</td>
          <td class="right">
            <button class="btn btn-xs" data-action="edit" title="Bewerken">✏️</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  // 9) Events (alleen modal knoppen; bewerken bewaren volgt later)
  els.btnNieuw?.addEventListener("click", () => els.modal?.showModal?.());
  els.btnCancel?.addEventListener("click", () => els.modal?.close?.());

  // 10) Go
  loadAll();
})();
