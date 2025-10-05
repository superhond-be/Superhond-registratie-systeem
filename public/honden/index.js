/* v0.20.0 – Hondenpagina (Apps Script API) */
(() => {
  // 👇 jouw Apps Script Web-App URL (/exec)
  const API_BASE = "https://script.google.com/macros/s/AKfycbzZP5jnYyjzOzrXaZfg1KL5UMqBFXVfIyyC14YYsyCaVbREPdAQPm_cxVvagM-0nP3cWg/exec";

  // ----- DOM -----
  const els = {
    loader: document.getElementById("loader"),
    error: document.getElementById("error"),
    wrap: document.getElementById("wrap"),
    tabel: document.getElementById("tabel"),
    tbody: document.querySelector("#tabel tbody"),
    zoek: document.getElementById("zoek"),
    ownerFilter: document.getElementById("ownerFilter"),
    btnNieuw: document.getElementById("btn-nieuw"),
    modal: document.getElementById("modal"),
    form: document.getElementById("form"),
    btnCancel: document.getElementById("btn-cancel"),
    btnSave: document.getElementById("btn-save"),
    selEigenaar: document.getElementById("sel-eigenaar")
  };

  const state = {
    honden: [],
    klanten: [],
    kById: {},
    filterOwner: "",
    q: ""
  };

  // ----- API helpers -----
  async function apiGet(mode, params = {}) {
    const usp = new URLSearchParams({ mode, t: Date.now(), ...params });
    const res = await fetch(`${API_BASE}?${usp.toString()}`, { method: "GET" });
    const txt = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let j; try { j = JSON.parse(txt); } catch { throw new Error("Geen geldige JSON (check ?mode)"); }
    if (!j.ok) throw new Error(j.error || "Onbekende fout");
    return j.data;
  }
  async function apiPost(mode, payload) {
    const res = await fetch(`${API_BASE}?mode=${encodeURIComponent(mode)}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" }, // geen preflight
      body: JSON.stringify(payload ?? {})
    });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || "Onbekende fout");
    return j.data;
  }

  // ----- Normalisatie (Sheet → UI) -----
  function normKlant(k) {
    const full = String(k.naam || "").trim();
    const [voornaam, ...rest] = full.split(/\s+/);
    const achternaam = rest.join(" ");
    return { id: k.id || "", naam: full || "(naam onbekend)", voornaam, achternaam };
  }
  function normHond(h) {
    return {
      id: h.id || "",
      eigenaarId: h.eigenaar_id || h.eigenaarId || "",
      naam: h.naam || "",
      ras: h.ras || "",
      geboortedatum: h.geboortedatum || "",
      chip: h.chip || ""
    };
  }

  // ----- UI helpers -----
  function showLoader(on) {
    if (els.loader) els.loader.style.display = on ? "" : "none";
    if (els.wrap) els.wrap.style.display = on ? "none" : "";
  }
  function showError(msg) {
    if (!els.error) return;
    els.error.textContent = msg || "";
    els.error.style.display = msg ? "" : "none";
  }

  // ----- Data laden -----
  async function loadAll() {
    showError("");
    showLoader(true);
    try {
      const [hRaw, kRaw] = await Promise.all([apiGet("honden"), apiGet("klanten")]);
      state.honden = hRaw.map(normHond);
      state.klanten = kRaw.map(normKlant);
      state.kById = Object.fromEntries(state.klanten.map(k => [k.id, k]));
      fillOwnerFilter();
      fillOwnerSelect();
      render();
    } catch (e) {
      console.error(e);
      showError("Fout bij laden van honden/klanten. " + e.message);
    } finally {
      showLoader(false);
    }
  }

  // ----- Filters -----
  function applyFilters(rows) {
    const q = state.q.toLowerCase();
    const owner = state.filterOwner;
    return rows.filter(h => {
      const matchOwner = !owner || h.eigenaarId === owner;
      const matchQ = !q || [h.naam, h.ras, h.geboortedatum]
        .concat(state.kById[h.eigenaarId]?.naam || "")
        .join(" ")
        .toLowerCase()
        .includes(q);
      return matchOwner && matchQ;
    });
  }

  // ----- Render -----
  function render() {
    const rows = applyFilters([...state.honden]);
    els.tbody.innerHTML = rows.map(h => {
      const e = state.kById[h.eigenaarId];
      const ownerName = e?.naam || "—";
      return `
        <tr data-id="${h.id}">
          <td><a href="./detail.html?id=${h.id}"><strong>${h.naam || "—"}</strong></a></td>
          <td>${h.ras || "—"}</td>
          <td>${h.geboortedatum || "—"}</td>
          <td>${
            e
              ? `<a href="../klanten/detail.html?id=${e.id}">${ownerName}</a>`
              : "—"
          }</td>
          <td class="right">
            <button class="btn btn-xs" data-action="edit" title="Bewerken">✏️</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  // ----- Owner filter dropdown (boven de tabel) -----
  function fillOwnerFilter() {
    if (!els.ownerFilter) return;
    const opts = ['<option value="">— Filter op eigenaar —</option>']
      .concat(state.klanten.map(k => `<option value="${k.id}">${k.naam}</option>`));
    els.ownerFilter.innerHTML = opts.join("");
    els.ownerFilter.value = state.filterOwner || "";
  }

  // ----- Owner select in modal (bij aanmaken/bewerken) -----
  function fillOwnerSelect() {
    if (!els.selEigenaar) return;
    const opts = ['<option value="">— Kies eigenaar —</option>']
      .concat(state.klanten.map(k => `<option value="${k.id}">${k.naam}</option>`));
    els.selEigenaar.innerHTML = opts.join("");
  }

  // ----- Modal open/close -----
  function openModal(data = null) {
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
    else els.modal.setAttribute("open", "open");
  }
  function closeModal() {
    if (typeof els.modal.close === "function") els.modal.close();
    els.modal.removeAttribute("open");
  }

  // ----- Opslaan -----
  async function onSave() {
    try {
      els.btnSave.disabled = true;
      showError("");

      const payload = {
        // id laat je weg voor create (API maakt Hxxxx)
        eigenaar_id: els.selEigenaar.value.trim(),
        naam: els.form.elements["naam"].value.trim(),
        ras: els.form.elements["ras"].value.trim(),
        chip: els.form.elements["chip"].value.trim(),
        geboortedatum: els.form.elements["geboortedatum"].value
      };

      if (!payload.eigenaar_id) throw new Error("Kies een eigenaar.");
      if (!payload.naam) throw new Error("Naam is verplicht.");

      await apiPost("saveHond", payload);
      await loadAll();
      closeModal();
    } catch (e) {
      console.error(e);
      showError("Bewaren mislukt: " + e.message);
    } finally {
      els.btnSave.disabled = false;
    }
  }

  // ----- Events -----
  els.zoek?.addEventListener("input", (e) => {
    state.q = e.target.value || "";
    render();
  });
  els.ownerFilter?.addEventListener("change", (e) => {
    state.filterOwner = e.target.value || "";
    render();
  });
  els.btnNieuw?.addEventListener("click", () => openModal());
  els.btnCancel?.addEventListener("click", () => closeModal());
  els.btnSave?.addEventListener("click", onSave);

  els.tbody.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-action]");
    if (!btn) return;
    const tr = btn.closest("tr");
    const id = tr?.dataset.id;
    if (!id) return;
    const h = state.honden.find(x => x.id === id);
    if (!h) return;
    if (btn.dataset.action === "edit") openModal(h);
  });

  // ----- Go! -----
  loadAll();
})();
