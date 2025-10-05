/* v0.21.0 – Hondenpagina (Apps Script API, stabiele release) */
(() => {

  // === 🔗 Google Apps Script Web App URL ===
  
const API_BASE = "https://script.google.com/macros/s/AKfycbzprHaU1ukJT03YLQ6I5EzR1LOq_45tzWNLo-d92rJuwtRat6Qf_b8Ydt-0qoZBIctVNA/exec";
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

  // === ⚙️ State ===
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
  const normKlant = k => ({
    id: k.id || "",
    naam: String(k.naam || "").trim() || "(naam onbekend)"
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
      showError("⚠️ " + err.message);
    } finally {
      showLoader(false);
    }
  }

  // === 🔍 Filtering ===
  function applyFilters(rows) {
    const q = state.q.toLowerCase();
    const owner = state.filterOwner;
    return rows.filter(h => {
      const eigenaarNaam = state.kById[h.eigenaarId]?.naam?.toLowerCase() || "";
      const text = `${h.naam} ${h.ras} ${h.geboortedatum} ${eigenaarNaam}`.toLowerCase();
      return (!owner || h.eigenaarId === owner) && (!q || text.includes(q));
    });
  }

  // === 🧾 Render tabel ===
  function render() {
    if (!els.tbody) return;
    const rows = applyFilters([...state.honden]);
    els.tbody.innerHTML = rows.map(h => {
      const e = state.kById[h.eigenaarId];
      const eigenaarCell = e
        ? `<a href="../klanten/detail.html?id=${e.id}">${e.naam}</a>`
        : "—";
      return `
        <tr data-id="${h.id}">
          <td><a href="./detail.html?id=${h.id}"><strong>${h.naam || "—"}</strong></a></td>
          <td>${h.ras || "—"}</td>
          <td>${h.geboortedatum || "—"}</td>
          <td>${eigenaarCell}</td>
          <td class="right">
            <button class="btn btn-xs" data-action="edit" title="Bewerken">✏️</button>
          </td>
        </tr>`;
    }).join("");
  }

  // === 🧾 Dropdowns ===
  function fillOwnerFilter() {
    if (!els.ownerFilter) return;
    els.ownerFilter.innerHTML =
      ['<option value="">— Filter op eigenaar —</option>']
        .concat(state.klanten.map(k => `<option value="${k.id}">${k.naam}</option>`))
        .join("");
  }

  function fillOwnerSelect() {
    if (!els.selEigenaar) return;
    els.selEigenaar.innerHTML =
      ['<option value="">— Kies eigenaar —</option>']
        .concat(state.klanten.map(k => `<option value="${k.id}">${k.naam}</option>`))
        .join("");
  }

  // === 💾 Opslaan ===
  async function onSave() {
    try {
      els.btnSave.disabled = true;
      showError("");
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
      els.form.elements["ras"].value = data.ras || "";
      els.form.elements["geboortedatum"].value = data.geboortedatum || "";
      els.form.elements["chip"].value = data.chip || "";
      els.selEigenaar.value = data.eigenaarId || "";
    } else {
      els.selEigenaar.value = state.filterOwner || "";
    }
    if (typeof els.modal.showModal === "function") els.modal.showModal();
    else els.modal.setAttribute("open", "true");
  }

  function closeModal() {
    if (typeof els.modal.close === "function") els.modal.close();
    els.modal.removeAttribute("open");
  }

  // === ⚡ Events ===
  els.zoek?.addEventListener("input", e => {
    state.q = e.target.value;
    render();
  });
  els.ownerFilter?.addEventListener("change", e => {
    state.filterOwner = e.target.value;
    render();
  });
  els.btnNieuw?.addEventListener("click", () => openModal());
  els.btnCancel?.addEventListener("click", closeModal);
  els.btnSave?.addEventListener("click", onSave);
  els.tbody?.addEventListener("click", ev => {
    const btn = ev.target.closest("[data-action='edit']");
    if (!btn) return;
    const id = btn.closest("tr")?.dataset.id;
    const hond = state.honden.find(h => h.id === id);
    if (hond) openModal(hond);
  });

  // === 🚀 Init ===
  loadAll();

})();
