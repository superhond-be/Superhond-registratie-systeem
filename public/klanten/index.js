/* v0.20.0 – Klantenpagina (fetch via Google Apps Script) */
(() => {
  // 👇 Vul hier je eigen /exec-URL in
  const API_BASE = "https://script.google.com/macros/s/AKfycbzZP5jnYyjzOzrXaZfg1KL5UMqBFXVfIyyC14YYsyCaVbREPdAQPm_cxVvagM-0nP3cWg/exec";

  // ---- DOM ----
  const els = {
    loader: document.getElementById("loader"),
    error: document.getElementById("error"),
    wrap: document.getElementById("wrap"),
    table: document.getElementById("tabel"),
    tbody: document.querySelector("#tabel tbody"),
    btnNieuw: document.getElementById("btn-nieuw"),
    modal: document.getElementById("modal"),
    form: document.getElementById("form"),
    btnCancel: document.getElementById("btn-cancel"),
    btnSave: document.getElementById("btn-save"),
  };

  const state = {
    klanten: [],
    hondenByOwner: new Map(), // id -> [hond]
    editId: null
  };

  // ---- API helpers ----
  async function apiGet(mode, params = {}) {
    const usp = new URLSearchParams({ mode, t: Date.now(), ...params });
    const res = await fetch(`${API_BASE}?${usp.toString()}`, { method: "GET" });
    const txt = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let j; try { j = JSON.parse(txt); } catch { throw new Error("Geen geldige JSON ontvangen (check ?mode)"); }
    if (!j.ok) throw new Error(j.error || "Onbekende fout");
    return j.data;
  }
  async function apiPost(mode, payload) {
    const res = await fetch(`${API_BASE}?mode=${encodeURIComponent(mode)}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" }, // voorkomt CORS preflight
      body: JSON.stringify(payload ?? {})
    });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || "Onbekende fout");
    return j.data;
  }

  // ---- Normalisatie (Sheet -> UI) ----
  function normKlant(k) {
    // Sheet heeft 1 veld 'naam' → splits naar voornaam/achternaam (best effort)
    const full = String(k.naam || "").trim();
    const [voornaam, ...rest] = full.split(/\s+/);
    const achternaam = rest.join(" ");

    // Plaats proberen uit adres te halen (alles na 1e komma), niet kritisch
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

  function normHond(h) {
    return {
      id: h.id || "",
      eigenaarId: h.eigenaar_id || h.eigenaarId || "",
      naam: h.naam || "",
      ras: h.ras || "",
      geboortedatum: h.geboortedatum || "",
    };
  }

  // ---- UI helpers ----
  function showLoader(on) {
    if (els.loader) els.loader.style.display = on ? "" : "none";
    if (els.wrap) els.wrap.style.display = on ? "none" : "";
  }
  function showError(msg) {
    if (!els.error) return;
    els.error.textContent = msg;
    els.error.style.display = msg ? "" : "none";
  }

  // ---- Data laden ----
  async function loadAll() {
    showError("");
    showLoader(true);
    try {
      const [klRaw, hoRaw] = await Promise.all([apiGet("klanten"), apiGet("honden")]);
      const klanten = klRaw.map(normKlant);
      const honden = hoRaw.map(normHond);

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
      showError("Fout bij laden van klanten/honden. " + e.message);
    } finally {
      showLoader(false);
    }
  }

  // ---- Render ----
  function render() {
    els.tbody.innerHTML = state.klanten.map(k => {
      const dogs = state.hondenByOwner.get(k.id) || [];
      const dogChips = dogs.length
        ? dogs.map(d => `<a class="chip btn btn-xs" href="/honden/detail.html?id=${d.id}" title="Bekijk ${d.naam}">${d.naam}</a>`).join(" ")
        : '<span class="muted">0</span>';

      return `
        <tr data-id="${k.id}">
          <td><a href="/klanten/detail.html?id=${k.id}"><strong>${k.naam}</strong></a></td>
          <td>${k.email ? `<a href="mailto:${k.email}">${k.email}</a>` : ""}</td>
          <td>${k.telefoon || ""}</td>
          <td>${dogChips}</td>
          <td class="right">
            <button class="btn btn-xs" data-action="edit" title="Bewerken">✏️</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  // ---- Modal helpers ----
  function openModal(data = null) {
    state.editId = data?.id || null;
    els.form.reset();

    // Prefill als bewerken
    if (data) {
      els.form.elements["id"].value = data.id || "";
      els.form.elements["naam"].value = data.naam || "";
      els.form.elements["voornaam"].value = data.voornaam || "";
      els.form.elements["achternaam"].value = data.achternaam || "";
      els.form.elements["email"].value = data.email || "";
      els.form.elements["telefoon"].value = data.telefoon || "";
      // adres velden laten leeg tenzij je parsing wil toevoegen
    }

    if (typeof els.modal.showModal === "function") els.modal.showModal();
    else els.modal.setAttribute("open", "open"); // simpele fallback
  }
  function closeModal() {
    if (typeof els.modal.close === "function") els.modal.close();
    els.modal.removeAttribute("open");
  }

  // ---- Opslaan (create-only via saveKlant) ----
  async function onSave() {
    try {
      els.btnSave.disabled = true;
      showError("");

      // ‘naam’ heeft prioriteit; anders combineer voor+achternaam
      const naam = (els.form.elements["naam"].value || `${els.form.elements["voornaam"].value} ${els.form.elements["achternaam"].value}`).trim();
      const email = els.form.elements["email"].value.trim();
      const telefoon = els.form.elements["telefoon"].value.trim();
      const land = els.form.elements["land"].value.trim();
      const straat = els.form.elements["straat"].value.trim();
      const nr = els.form.elements["huisnr"].value.trim();
      const bus = els.form.elements["bus"].value.trim();
      const postcode = els.form.elements["postcode"].value.trim();
      const gemeente = els.form.elements["gemeente"].value.trim();

      if (!naam || !email) throw new Error("Naam en e-mail zijn verplicht.");

      // De Sheets backend kent één veld 'adres' → concateneren
      const adres = [ `${straat} ${nr}${bus ? ' bus ' + bus : ''}`.trim(), `${postcode} ${gemeente}`.trim(), land ].filter(Boolean).join(", ");

      const payload = {
        // id: niet meegeven → backend maakt nieuwe (Kxxxx)
        naam,
        email,
        telefoon,
        adres,
        status: "actief"
      };

      const row = await apiPost("saveKlant", payload);
      // Refresh lijst
      await loadAll();
      closeModal();
    } catch (e) {
      console.error(e);
      showError("Bewaren mislukt: " + e.message);
    } finally {
      els.btnSave.disabled = false;
    }
  }

  // ---- Events ----
  els.btnNieuw?.addEventListener("click", () => openModal());
  els.btnCancel?.addEventListener("click", () => closeModal());
  els.btnSave?.addEventListener("click", onSave);

  // Table actions (alleen edit voor nu)
  els.tbody.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-action]");
    if (!btn) return;
    const tr = btn.closest("tr");
    const id = tr?.dataset.id;
    if (!id) return;

    const k = state.klanten.find(x => x.id === id);
    if (!k) return;

    if (btn.dataset.action === "edit") openModal(k);
  });

  // ---- Go! ----
  loadAll();
})();
