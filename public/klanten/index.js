/* v0.21.6 – Klantenpagina (Apps Script API met compatibele timeout & fallbacks) */
(() => {
  // === 1) BASIS ===
  const GAS_BASE =
    (window.SuperhondConfig?.apiBase) ||
    "https://script.google.com/macros/s/AKfycbwt_2IjbE68Nw01xnxeConxcNO0fNMwxZBW5DPDnGYYCFs9y00xOV69IA9aYFb9QRra/exec";

  const PROXY_BASE = "/api/sheets";   // (optioneel) eigen same-origin proxy
  const USE_PROXY_SERVER = false;     // true zodra je proxy live is
  const TIMEOUT_MS = 8000;

  // === 2) DOM ===
  const els = {
    loader:    document.querySelector("#loader"),
    error:     document.querySelector("#error"),
    wrap:      document.querySelector("#wrap"),
    tbody:     document.querySelector("#tabel tbody"),
    btnNieuw:  document.querySelector("#btn-nieuw"),
    modal:     document.querySelector("#modal"),
    form:      document.querySelector("#form"),
    btnCancel: document.querySelector("#btn-cancel"),
  };

  // === 3) STATE ===
  const state = { klanten: [], hondenByOwner: new Map() };

  // === 4) Helpers ===
  const qs = (mode, p={}) => new URLSearchParams({ mode, t: Date.now(), ...p }).toString();
  const directUrl    = (m,p) => `${GAS_BASE}?${qs(m,p)}`;
  const proxyUrl     = (m,p) => `${PROXY_BASE}?${qs(m,p)}`;
  const aoRawUrl     = (m,p) => `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl(m,p))}`;
  const aoGetUrl     = (m,p) => `https://api.allorigins.win/get?url=${encodeURIComponent(directUrl(m,p))}`;
  const cleanJson    = (txt="") => txt.replace(/^\uFEFF/, "").trim();

  // Timeout helper that works even on old Safari (no hard dependency on AbortController)
  async function fetchWithTimeout(url, ms = TIMEOUT_MS) {
    if (typeof AbortController !== "undefined") {
      const ac = new AbortController();
      const t  = setTimeout(() => ac.abort("timeout"), ms);
      try {
        return await fetch(url, { cache: "no-store", signal: ac.signal });
      } finally { clearTimeout(t); }
    }
    // Fallback: race without abort (compatible)
    return Promise.race([
      fetch(url, { cache: "no-store" }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))
    ]);
  }

  function parseMaybeWrapped(txt, expectWrapped = false) {
    const c = cleanJson(txt);
    if (expectWrapped) {
      const wrap = JSON.parse(c);
      if (!wrap || typeof wrap.contents !== "string") throw new Error("Proxy-antwoord onjuist");
      return JSON.parse(cleanJson(wrap.contents));
    }
    return JSON.parse(c);
  }

  // === 5) robuuste GET (direct → proxy → AllOrigins /raw → AllOrigins /get) ===
  async function apiGet(mode, params = {}) {
    // a) direct naar GAS
    try {
      const r = await fetchWithTimeout(directUrl(mode, params));
      const t = await r.text();
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = parseMaybeWrapped(t);
      if (!j.ok) throw new Error(j.error || "Onbekende API-fout");
      return j.data;
    } catch (e1) {
      console.warn("[API] Direct faalde:", e1?.message || e1);
    }

    // b) eigen server-proxy
    if (USE_PROXY_SERVER) {
      try {
        const r = await fetchWithTimeout(proxyUrl(mode, params));
        const t = await r.text();
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = parseMaybeWrapped(t);
        if (!j.ok) throw new Error(j.error || "Onbekende API-fout");
        return j.data;
      } catch (e2) {
        console.warn("[API] Server-proxy faalde:", e2?.message || e2);
      }
    }

    // c) AllOrigins raw
    try {
      const r = await fetchWithTimeout(aoRawUrl(mode, params));
      const t = await r.text();
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = parseMaybeWrapped(t);
      if (!j.ok) throw new Error(j.error || "Onbekende API-fout");
      return j.data;
    } catch (e3) {
      console.warn("[API] AllOrigins /raw faalde:", e3?.message || e3);
      // d) AllOrigins get (wrapped)
      const r = await fetchWithTimeout(aoGetUrl(mode, params));
      const t = await r.text();
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = parseMaybeWrapped(t, true);
      if (!j.ok) throw new Error(j.error || "Onbekende API-fout");
      return j.data;
    }
  }

  // === 6) Normalisatie ===
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
      voornaam, achternaam,
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

  // === 7) UI helpers ===
  function showLoader(on = true) {
    if (els.loader) els.loader.style.display = on ? "" : "none";
    if (els.wrap)   els.wrap.style.display   = on ? "none" : "";
  }
  function showError(msg = "") {
    if (!els.error) return;
    els.error.textContent = msg;
    els.error.style.display = msg ? "" : "none";
  }

  // === 8) Data laden ===
  async function loadAll() {
    showError(""); showLoader(true);
    try {
      console.info("[Klanten] Laden… via GAS:", GAS_BASE);
      const [klRaw, hoRaw] = await Promise.all([apiGet("klanten"), apiGet("honden")]);
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
      console.info(`[Klanten] OK – ${klanten.length} klanten, ${honden.length} honden`);
    } catch (e) {
      console.error("[Klanten] Fout:", e);
      const m = e?.message || "Onbekende fout";
      showError(
        m.includes("timeout") ? "⏳ Time-out bij API" :
        m.includes("network") || m.includes("netwerk") ? "🚫 Geen netwerkverbinding" :
        m.includes("JSON") ? "⚠️ Ongeldige JSON van API" :
        "⚠️ " + m
      );
    } finally {
      showLoader(false);
    }
  }

  // === 9) Render ===
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
          <td class="right"><button class="btn btn-xs" data-action="edit" title="Bewerken">✏️</button></td>
        </tr>`;
    }).join("");
  }

  // === 10) Events ===
  els.btnNieuw?.addEventListener("click", () => els.modal?.showModal?.());
  els.btnCancel?.addEventListener("click", () => els.modal?.close?.());

  // === 11) Debug: raw JSON (open /klanten/?mode=klanten) ===
  (async () => {
    const pre = document.getElementById("api-debug");
    const m = new URLSearchParams(location.search).get("mode");
    if (!pre || !m) return;
    pre.style.display = "";
    try { pre.textContent = JSON.stringify({ ok:true, data: await apiGet(m) }, null, 2); }
    catch (e) { pre.textContent = "❌ " + (e?.message || String(e)); }
  })();

  // === 12) Start ===
  loadAll();
})();
