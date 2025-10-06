/* v0.22.2 – Klantenpagina (rechtstreeks endpoints, met fallback & nette errors) */
(() => {
  // === 1) API BASE ===
  const API_BASE =
    (window?.SuperhondConfig?.apiBase) ||
    "https://script.google.com/macros/s/AKfycbzprHaU1ukJT03YLQ6I5EzR1LOq_45tzWNLo-d92rJuwtRat6Qf_b8Ydt-0qoZBIctVNA/exec";

  // === 2) Endpoints (rechtstreeks) ===
  const URL_KLANTEN     = `${API_BASE}?mode=klanten`;
  const URL_HONDEN      = `${API_BASE}?mode=honden`;
  const URL_SAVE_KLANT  = `${API_BASE}?mode=saveKlant`;

  // === 3) DOM ===
  const els = {
    loader:   document.querySelector("#loader"),
    error:    document.querySelector("#error"),
    wrap:     document.querySelector("#wrap"),
    tbody:    document.querySelector("#tabel tbody"),
    // modal + form zijn optioneel; code checkt of ze bestaan
    btnNieuw: document.querySelector("#btn-nieuw"),
    modal:    document.querySelector("#modal"),
    form:     document.querySelector("#form"),
    btnCancel:document.querySelector("#btn-cancel"),
    btnSave:  document.querySelector("#btn-save"),
  };

  // === 4) State ===
  const state = {
    klanten: [],
    hondenByOwner: new Map(),
  };

  // === 5) UI helpers ===
  const showLoader = (on = true) => {
    if (els.loader) els.loader.hidden = !on;
    if (els.wrap)   els.wrap.hidden   = on;
  };
  const showError = (msg = "") => {
    if (!els.error) return;
    els.error.textContent = msg;
    els.error.style.display = msg ? "" : "none";
  };

  // === 6) Fetch helpers ===
  async function getJson(url) {
    let res;
    try {
      res = await fetch(url, { cache: "no-store" });
    } catch {
      throw new Error("Geen verbinding met de API");
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let j; try { j = await res.json(); } catch { throw new Error("Ongeldige JSON van API"); }
    if (!j.ok) throw new Error(j.error || "Onbekende API-fout");
    return j.data;
  }

  async function postJson(url, payload = {}) {
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch {
      throw new Error("Geen verbinding met de API");
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let j; try { j = await res.json(); } catch { throw new Error("Ongeldige JSON van API"); }
    if (!j.ok) throw new Error(j.error || "Onbekende API-fout");
    return j.data;
  }

  // === 7) Normalisatie ===
  function normKlant(k) {
    const full = String(k.naam || "").trim();
    const [voornaam, ...rest] = full.split(/\s+/);
    const achternaam = rest.join(" ");

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
      plaats
    };
  }

  const normHond = h => ({
    id: h.id || "",
    eigenaarId: h.eigenaar_id || h.eigenaarId || "",
    naam: h.naam || ""
  });

  // === 8) Data laden ===
  async function loadAll() {
    showLoader(true);
    showError("");
    try {
      const [klRaw, hoRaw] = await Promise.all([
        getJson(URL_KLANTEN),
        getJson(URL_HONDEN)
      ]);
      const klanten = klRaw.map(normKlant);
      const honden  = hoRaw.map(normHond);

      // eigenaarId → [honden[]]
      const map = new Map();
      honden.forEach(h => {
        if (!map.has(h.eigenaarId)) map.set(h.eigenaarId, []);
        map.get(h.eigenaarId).push(h);
      });

      state.klanten      = klanten;
      state.hondenByOwner = map;

      render();
    } catch (e) {
      console.error("Fout bij laden:", e);
      showError("⚠️ " + e.message);
    } finally {
      showLoader(false);
    }
  }

  // === 9) Render ===
  function render() {
    if (!els.tbody) return;
    els.tbody.innerHTML = state.klanten.map(k => {
      const dogs = state.hondenByOwner.get(k.id) || [];
      const chips = dogs.length
        ? dogs.map(d => `<a class="chip btn btn-xs" href="../honden/detail.html?id=${d.id}" title="Bekijk ${d.naam}">${d.naam}</a>`).join(" ")
        : '<span class="muted">0</span>';
      return `
        <tr data-id="${k.id}">
          <td><a href="./detail.html?id=${k.id}"><strong>${k.naam}</strong></a></td>
          <td>${k.email ? `<a href="mailto:${k.email}">${k.email}</a>` : "—"}</td>
          <td>${k.telefoon || "—"}</td>
          <td>${chips}</td>
          <td class="right">
            ${els.modal ? `<button class="btn btn-xs" data-action="edit" title="Bewerken">✏️</button>` : ""}
          </td>
        </tr>`;
    }).join("");
  }

  // === 10) Opslaan (optioneel; alleen als modal+form bestaan) ===
  async function onSave() {
    if (!els.form) return;
    try {
      els.btnSave && (els.btnSave.disabled = true);
      showError("");

      const naam = (
        els.form.elements["naam"]?.value ||
        `${els.form.elements["voornaam"]?.value || ""} ${els.form.elements["achternaam"]?.value || ""}`
      ).trim();
      const email     = (els.form.elements["email"]?.value || "").trim();
      const telefoon  = (els.form.elements["telefoon"]?.value || "").trim();
      const straat    = (els.form.elements["straat"]?.value || "").trim();
      const nr        = (els.form.elements["huisnr"]?.value || "").trim();
      const bus       = (els.form.elements["bus"]?.value || "").trim();
      const postcode  = (els.form.elements["postcode"]?.value || "").trim();
      const gemeente  = (els.form.elements["gemeente"]?.value || "").trim();
      const land      = (els.form.elements["land"]?.value || "").trim();

      if (!naam || !email) throw new Error("Naam en e-mail zijn verplicht.");

      const adres = [
        `${straat} ${nr}${bus ? " bus " + bus : ""}`.trim(),
        `${postcode} ${gemeente}`.trim(),
        land
      ].filter(Boolean).join(", ");

      await postJson(URL_SAVE_KLANT, { naam, email, telefoon, adres, status: "actief" });
      await loadAll();
      closeModal();
    } catch (e) {
      console.error("Bewaren mislukt:", e);
      showError("❌ Bewaren mislukt: " + e.message);
    } finally {
      els.btnSave && (els.btnSave.disabled = false);
    }
  }

  // === 11) Modal open/close (optioneel) ===
  function openModal(data = null) {
    if (!els.modal || !els.form) return;
    els.form.reset();
    if (data) {
      els.form.elements["id"] && (els.form.elements["id"].value = data.id || "");
      els.form.elements["naam"] && (els.form.elements["naam"].value = data.naam || "");
      els.form.elements["voornaam"] && (els.form.elements["voornaam"].value = data.voornaam || "");
      els.form.elements["achternaam"] && (els.form.elements["achternaam"].value = data.achternaam || "");
      els.form.elements["email"] && (els.form.elements["email"].value = data.email || "");
      els.form.elements["telefoon"] && (els.form.elements["telefoon"].value = data.telefoon || "");
    }
    els.modal.showModal?.();
  }
  function closeModal() {
    if (!els.modal) return;
    els.modal.close?.();
  }

  // === 12) Events (alleen gebonden als de elementen bestaan) ===
  els.btnNieuw   && els.btnNieuw  .addEventListener("click", () => openModal());
  els.btnCancel  && els.btnCancel .addEventListener("click", () => closeModal());
  els.btnSave    && els.btnSave   .addEventListener("click", onSave);

  els.tbody && els.tbody.addEventListener("click", ev => {
    const btn = ev.target.closest("button[data-action='edit']");
    if (!btn || !els.modal) return;
    const id = btn.closest("tr")?.dataset.id;
    const klant = state.klanten.find(x => x.id === id);
    if (klant) openModal(klant);
  });

  // === 13) Go! ===
  showError(""); // clear
  loadAll();

  // === 14) (Optioneel) Debug-pane: voeg <pre id="api-debug"> toe en roep ?mode=klanten|honden aan ===
  (async () => {
    const debugPre = document.getElementById("api-debug");
    const forcedMode = new URLSearchParams(location.search).get("mode");
    if (!debugPre || !forcedMode) return;
    debugPre.style.display = "";
    try {
      const url = `${API_BASE}?mode=${encodeURIComponent(forcedMode)}&t=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      debugPre.textContent = JSON.stringify(json, null, 2);
    } catch (e) {
      debugPre.textContent = "❌ " + e.message;
    }
  })();
})();
