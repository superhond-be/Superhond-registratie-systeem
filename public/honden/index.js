/* v0.20.1 – Hondenpagina (Apps Script API, opgeschoond & robuuster) */
(() => {

  // === 🔗 Google Apps Script Web App URL ===
  const API_BASE = "https://script.google.com/macros/s/AKfycbzZP5jnYyjzOzrXaZfg1KL5UMqBFXVfIyyC14YYsyCaVbREPdAQPm_cxVvagM-0nP3cWg/exec";

  // === 🧩 DOM-elementen ===
  const els = {
    loader: document.querySelector("#loader"),
    error: document.querySelector("#error"),
    wrap: document.querySelector("#wrap"),
    tbody: document.querySelector("#tabel tbody"),
    zoek: document.querySelector("#zoek"),
    ownerFilter: document.querySelector("#ownerFilter"),
    btnNieuw: document.querySelector("#btn-nieuw"),
    modal: document.querySelector("#modal"),
    form: document.querySelector("#form"),
    btnCancel: document.querySelector("#btn-cancel"),
    btnSave: document.querySelector("#btn-save"),
    selEigenaar: document.querySelector("#sel-eigenaar")
  };

  // === 🔧 State ===
  const state = {
    honden: [],
    klanten: [],
    kById: {},
    q: "",
    filterOwner: ""
  };

  // === 🌐 API helpers ===
  async function apiGet(mode, params = {}) {
    const usp = new URLSearchParams({ mode, t: Date.now(), ...params });
    const res = await fetch(`${API_BASE}?${usp}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json().catch(() => { throw new Error("Geen geldige JSON van API"); });
    if (!data.ok) throw new Error(data.error || "Onbekende API-fout");
    return data.data;
  }

  async function apiPost(mode, payload) {
    const res = await fetch(`${API_BASE}?mode=${encodeURIComponent(mode)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    });
    const data = await res.json().catch(() => { throw new Error("Geen geldige JSON van API"); });
    if (!data.ok) throw new Error(data.error || "Onbekende API-fout");
    return data.data;
  }

  // === 🧠 Normalisatie ===
  const normKlant = k => ({
    id: k.id || "",
    naam: k.naam?.trim() || "(naam onbekend)"
  });

  const normHond = h => ({
    id: h.id || "",
    eigenaarId: h.eigenaar_id || h.eigenaarId || "",
    naam: h.naam || "",
    ras: h.ras || "",
    geboortedatum: h.geboortedatum || "",
    chip: h.chip || ""
  });

  // === 🎛️ UI helpers ===
  function showLoader(show = true) {
    if (els.loader) els.loader.style.display = show ? "" : "none";
    if (els.wrap) els.wrap.style.display = show ? "none" : "";
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
      const [honden, klanten] = await Promise.all([
        apiGet("honden"),
        apiGet("klanten")
      ]);
      state.honden = honden.map(normHond);
      state.klanten = klanten.map(normKlant);
      state.kById = Object.fromEntries(state.klanten.map(k => [k.id, k]));
      fillOwnerFilter();
      fillOwnerSelect();
      render();
    } catch (err) {
      console.error("Fout bij laden:", err);
      showError("Fout bij laden van honden/klanten: " + err.message);
    } finally {
      showLoader(false);
    }
  }

  // === 🔍 Filtering & rendering ===
  function applyFilters(rows) {
    const q = state.q.toLowerCase();
    const owner = state.filterOwner;
    return rows.filter(h => {
      const eigenaarNaam = state.kById[h.eigenaarId]?.naam?.toLowerCase() || "";
      return (
        (!owner || h.eigenaarId === owner) &&
        (!q || `${h.naam} ${h.ras} ${h.geboortedatum} ${eigenaarNaam}`.toLowerCase().includes(q))
      );
    });
  }

  function render() {
    const rows = applyFilters([...state.honden]);
    els.tbody.innerHTML = rows.map(h => {
      const e = state.kById[h.eigenaarId];
      return `
        <tr data-id="${h.id}">
          <td><a href="./detail.html?id=${h.id}"><strong>${h.naam || "—"}</strong></a></td>
          <td>${h.ras || "—"}</td>
          <td>${h.geboortedatum || "—"}</td>
          <td>${e ? `<a href="../klanten/detail.html?id=${e.id}">${e.naam}</a>` : "—"}</td>
          <td class="right">
            <button class="btn btn-xs" data-action="edit" title="Bewerken">✏️</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  // === 🧾 Dropdowns ===
  function fillOwnerFilter() {
    els.ownerFilter.innerHTML = [
      '<option value="">— Filter op eigenaar —</option>',
      ...state.klanten.map(k => `<option value="${k.id}">${k.naam}</option>`)
    ].join("");
  }

  function fillOwnerSelect() {
    els.selEigenaar.innerHTML = [
      '<option value="">— Kies eigenaar —</option>',
      ...state.klanten.map(k => `<option value="${k.id}">${k.naam}</option>`)
    ].join("");
  }

  // === 💾 Opslaan ===
  async function onSave() {
    try {
      els.btnSave.disabled = true;
      const payload = {
        eigenaar_id: els.selEigenaar.value.trim(),
        naam: els.form.elements["naam"].value.trim(),
        ras: els.form.elements["ras"].value.trim(),
        chip: els.form.elements["chip"].value.trim(),
        geboortedatum: els.form.elements["geboortedatum"].value
      };
      if (!payload.eigenaar_id) throw new Error("Kies een eigenaar");
      if (!payload.naam) throw new Error("Naam is verplicht");
      await apiPost("saveHond", payload);
      await loadAll();
      closeModal();
    } catch (err) {
      console.error("Bewaren mislukt:", err);
      showError("Bewaren mislukt: " + err.message);
    } finally {
      els.btnSave.disabled = false;
    }
  }

  // === 🪟 Modal ===
  function openModal(data = null) {
    els.form.reset();
    if (data) {
      els.form.elements["id"].value = data.id || "";
      els.form.elements["naam"].value = data.naam || "";
      els.form.elements["ras"].value = data.ras || "";
      els.form.elements["geboortedatum"].value = data.geboortedatum || "";
      els.form.elements["chip"].value = data.chip || "";
      els.selEigenaar.value = data.eigenaarId || "";
    }
    els.modal?.showModal?.();
  }
  function closeModal() {
    els.modal?.close?.();
  }

  // === ⚡ Events ===
  els.zoek?.addEventListener("input", e => { state.q = e.target.value; render(); });
  els.ownerFilter?.addEventListener("change", e => { state.filterOwner = e.target.value; render(); });
  els.btnNieuw?.addEventListener("click", () => openModal());
  els.btnCancel?.addEventListener("click", () => closeModal());
  els.btnSave?.addEventListener("click", onSave);
  els.tbody.addEventListener("click", ev => {
    const btn = ev.target.closest("[data-action='edit']");
    if (!btn) return;
    const id = btn.closest("tr")?.dataset.id;
    const hond = state.honden.find(h => h.id === id);
    if (hond) openModal(hond);
  });

  // === 🚀 Start ===
  loadAll();

})();
