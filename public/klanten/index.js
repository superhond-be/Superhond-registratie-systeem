/* v0.21.0 – Klantenpagina (Apps Script API, stabiele release) */
(() => {

  // === 🔗 Google Apps Script Web App URL ===
  const API_BASE =
    "https://script.google.com/macros/s/AKfycbzprHaU1ukJT03YLQ6I5EzR1LOq_45tzWNLo-d92rJuwtRat6Qf_b8Ydt-0qoZBIctVNA/exec";

  // === 🧩 DOM-elementen ===
  const els = {
    loader: document.querySelector("#loader"),
    error: document.querySelector("#error"),
    wrap: document.querySelector("#wrap"),
    tbody: document.querySelector("#tabel tbody"),
    btnNieuw: document.querySelector("#btn-nieuw"),
    modal: document.querySelector("#modal"),
    form: document.querySelector("#form"),
    btnCancel: document.querySelector("#btn-cancel"),
    btnSave: document.querySelector("#btn-save")
  };

  // === ⚙️ State ===
  const state = {
    klanten: [],
    hondenByOwner: new Map(),
    editId: null
  };

  // === 🌐 API helpers ===
  async function apiGet(mode, params = {}) {
    const usp = new URLSearchParams({ mode, t: Date.now(), ...params });
    let res;
    try {
      res = await fetch(`${API_BASE}?${usp.toString()}`, { cache: "no-store" });
    } catch {
      throw new Error("Geen verbinding met de API");
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error("Ongeldige JSON van API");
    }
    if (!data.ok) throw new Error(data.error || "Onbekende API-fout");
    return data.data;
  }

  async function apiPost(mode, payload) {
    let res;
    try {
      res = await fetch(`${API_BASE}?mode=${encodeURIComponent(mode)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {})
      });
    } catch {
      throw new Error("Geen verbinding met de API");
    }
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error("Ongeldige JSON van API");
    }
    if (!data.ok) throw new Error(data.error || "Onbekende API-fout");
    return data.data;
  }

  // === 🧠 Normalisatie ===
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
    naam: h.naam || "",
    ras: h.ras || "",
    geboortedatum: h.geboortedatum || ""
  });

  // === 🎛️ UI helpers ===
  function showLoader(show = true) {
    if (els.loader) els.loader.hidden = !show;
    if (els.wrap) els.wrap.hidden = show;
  }

  function showError(msg = "") {
    if (!els.error) return;
    els.error.textContent = msg;
    els.error.style.display = msg ? "" : "none";
  }

  // === 📦 Data laden ===
  async function loadAll() {
    showLoader(true);
    showError("");
    try {
      const [klanten, honden] = await Promise.all([
        apiGet("klanten"),
        apiGet("honden")
      ]);
      const kl = klanten.map(normKlant);
      const ho = honden.map(normHond);
      const map = new Map();
      ho.forEach(h => {
        if (!map.has(h.eigenaarId)) map.set(h.eigenaarId, []);
        map.get(h.eigenaarId).push(h);
      });
      state.klanten = kl;
      state.hondenByOwner = map;
      render();
    } catch (err) {
      console.error("Fout bij laden:", err);
      showError("⚠️ " + err.message);
    } finally {
      showLoader(false);
    }
  }

  // === 🧾 Render tabel ===
  function render() {
    if (!els.tbody) return;
    els.tbody.innerHTML = state.klanten.map(k => {
      const dogs = state.hondenByOwner.get(k.id) || [];
      const dogChips = dogs.length
        ? dogs
            .map(
              d =>
                `<a class="chip btn btn-xs" href="../honden/detail.html?id=${d.id}" title="Bekijk ${d.naam}">${d.naam}</a>`
            )
            .join(" ")
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
        </tr>`;
    }).join("");
  }

  // === 💾 Opslaan klant ===
  async function onSave() {
    try {
      els.btnSave.disabled = true;
      showError("");

      const naam = (
        els.form.elements["naam"].value ||
        `${els.form.elements["voornaam"].value} ${els.form.elements["achternaam"].value}`
      ).trim();
      const email = els.form.elements["email"].value.trim();
      const telefoon = els.form.elements["telefoon"].value.trim();
      const straat = els.form.elements["straat"]?.value.trim() || "";
      const nr = els.form.elements["huisnr"]?.value.trim() || "";
      const bus = els.form.elements["bus"]?.value.trim() || "";
      const postcode = els.form.elements["postcode"]?.value.trim() || "";
      const gemeente = els.form.elements["gemeente"]?.value.trim() || "";
      const land = els.form.elements["land"]?.value.trim() || "";

      if (!naam || !email) throw new Error("Naam en e-mail zijn verplicht.");

      const adres = [
        `${straat} ${nr}${bus ? " bus " + bus : ""}`.trim(),
        `${postcode} ${gemeente}`.trim(),
        land
      ]
        .filter(Boolean)
        .join(", ");

      const payload = { naam, email, telefoon, adres, status: "actief" };
      await apiPost("saveKlant", payload);
      await loadAll();
      closeModal();
    } catch (err) {
      console.error("Bewaren mislukt:", err);
      showError("❌ Bewaren mislukt: " + err.message);
    } finally {
      els.btnSave.disabled = false;
    }
  }

  // === 🪟 Modal ===
  function openModal(data = null) {
    if (!els.modal) return;
    els.form.reset();
    if (data) {
      els.form.elements["id"].value = data.id || "";
      els.form.elements["naam"].value = data.naam || "";
      els.form.elements["voornaam"].value = data.voornaam || "";
      els.form.elements["achternaam"].value = data.achternaam || "";
      els.form.elements["email"].value = data.email || "";
      els.form.elements["telefoon"].value = data.telefoon || "";
    }
    if (typeof els.modal.showModal === "function") els.modal.showModal();
    else els.modal.setAttribute("open", "true");
  }

  function closeModal() {
    if (typeof els.modal.close === "function") els.modal.close();
    els.modal.removeAttribute("open");
  }

  // === ⚡ Events ===
  els.btnNieuw?.addEventListener("click", () => openModal());
  els.btnCancel?.addEventListener("click", closeModal);
  els.btnSave?.addEventListener("click", onSave);

  els.tbody?.addEventListener("click", ev => {
    const btn = ev.target.closest("button[data-action='edit']");
    if (!btn) return;
    const id = btn.closest("tr")?.dataset.id;
    const klant = state.klanten.find(x => x.id === id);
    if (klant) openModal(klant);
  });

  // === 🚀 Init ===
  loadAll();

})();
