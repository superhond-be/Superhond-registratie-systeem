/* v0.21.5 – Klantenpagina (Apps Script API met auto-fallback, timeout & robuuste JSON) */
(() => {
  // === 1) BASIS ===
  // Zet HIER je eigen GAS /exec-URL (zonder query’s):
  const GAS_BASE =
    (window.SuperhondConfig?.apiBase) ||
    "https://script.google.com/macros/s/AKfycbwt_2IjbE68Nw01xnxeConxcNO0fNMwxZBW5DPDnGYYCFs9y00xOV69IA9aYFb9QRra/exec";

  // (optioneel) eigen server-proxy (same-origin), later aanzetten:
  const PROXY_BASE = "/api/sheets";
  const USE_PROXY_SERVER = false; // op true zetten als je proxy live is

  // algemene instellingen
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
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function qs(mode, params = {}) {
    return new URLSearchParams({ mode, t: Date.now(), ...params }).toString();
  }
  const buildDirectUrl      = (mode, p) => `${GAS_BASE}?${qs(mode, p)}`;
  const buildServerProxyUrl = (mode, p) => `${PROXY_BASE}?${qs(mode, p)}`;
  const buildAllOriginsRaw  = (mode, p) => `https://api.allorigins.win/raw?url=${encodeURIComponent(buildDirectUrl(mode, p))}`;
  const buildAllOriginsGet  = (mode, p) => `https://api.allorigins.win/get?url=${encodeURIComponent(buildDirectUrl(mode, p))}`;

  // Timeout wrapper (AbortController)
  async function fetchWithTimeout(url, ms = TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort("timeout"), ms);
    try {
      return await fetch(url, { cache: "no-store", signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  // Strip BOM of leading junk (soms bij proxies)
  function cleanJsonText(txt = "") {
    return txt.replace(/^\uFEFF/, "").trim();
  }

  // Eén parser die zowel plain JSON als AllOrigins /get {contents:"…"} begrijpt
  function parseMaybeWrappedJson(txt, expectWrapped = false) {
    const cleaned = cleanJsonText(txt);
    if (expectWrapped) {
      const wrap = JSON.parse(cleaned);
      if (!wrap || typeof wrap.contents !== "string") {
        throw new Error("Proxy-antwoord onjuist");
      }
      return JSON.parse(cleanJsonText(wrap.contents));
    }
    return JSON.parse(cleaned);
  }

  // === 5) robuuste GET (direct → proxy → publieke proxy raw → publieke proxy get) ===
  async function apiGet(mode, params = {}) {
    // a) rechtstreeks naar GAS (kan door CORS in Safari blokkeren)
    try {
      const res = await fetchWithTimeout(buildDirectUrl(mode, params));
      const txt = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = parseMaybeWrappedJson(txt);
      if (!json.ok) throw new Error(json.error || "Onbekende API-fout");
      return json.data;
    } catch (e1) {
      console.warn("[API] Direct faalde:", e1?.message || e1);
    }

    // b) eigen server-proxy (same-origin)
    if (USE_PROXY_SERVER) {
      try {
        const res = await fetchWithTimeout(buildServerProxyUrl(mode, params));
        const txt = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = parseMaybeWrappedJson(txt);
        if (!json.ok) throw new Error(json.error || "Onbekende API-fout");
        return json.data;
      } catch (e2) {
        console.warn("[API] Server-proxy faalde:", e2?.message || e2);
      }
    }

    // c) publieke proxy (AllOrigins) – eerst /raw, dan /get (wrapped)
    try {
      const res = await fetchWithTimeout(buildAllOriginsRaw(mode, params));
      const txt = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = parseMaybeWrappedJson(txt);
      if (!json.ok) throw new Error(json.error || "Onbekende API-fout");
      return json.data;
    } catch (e3) {
      console.warn("[API] AllOrigins /raw faalde:", e3?.message || e3);
      // /get → { contents: "…actual json…" }
      const res = await fetchWithTimeout(buildAllOriginsGet(mode, params));
      const txt = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = parseMaybeWrappedJson(txt, true);
      if (!json.ok) throw new Error(json.error || "Onbekende API-fout");
      return json.data;
    }
  }

  // === 6) Normalisatie ===
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

  const normHond = (h) => ({
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
    showError("");
    showLoader(true);
    try {
      console.info("[Klanten] Laden…");
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
      console.error("[Klanten] F
