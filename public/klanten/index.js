/* v0.21.3 – Klantenpagina (Apps Script API met CORS-fallback) */
(() => {
  // === 1) BASIS-URLS ===
  // Zet HIER je eigen GAS /exec-URL ZONDER query's:
  const GAS_BASE =
    (window.SuperhondConfig?.apiBase) || // optionele centrale config
    "https://script.google.com/macros/s/AKfycbzprHaU1ukJT03YLQ6I5EzR1LOq_45tzWNLo-d92rJuwtRat6Qf_b8Ydt-0qoZBIctVNA/exec";

  // Als je later een eigen proxy op je server maakt, zet PROXY_BASE = "/api/sheets" en USE_PROXY_SERVER = true
  const PROXY_BASE = "/api/sheets";         // jouw server-proxy (same-origin)
  const USE_PROXY_SERVER = false;           // zodra je proxy live is: true
  const USE_PUBLIC_PROXY = true; // forceer de AllOrigins-proxy

  // === 2) DOM ===
  const els = {
    loader: document.querySelector("#loader"),
    error:  document.querySelector("#error"),
    wrap:   document.querySelector("#wrap"),
    tbody:  document.querySelector("#tabel tbody"),
    btnNieuw:  document.querySelector("#btn-nieuw"),
    modal:     document.querySelector("#modal"),
    form:      document.querySelector("#form"),
    btnCancel: document.querySelector("#btn-cancel"),
  };

  // === 3) STATE ===
  const state = { klanten: [], hondenByOwner: new Map() };

  // === 4) URL-bouwers ===
  function buildDirectUrl(mode, params = {}) {
    const qs = new URLSearchParams({ mode, t: Date.now(), ...params }).toString();
    return `${GAS_BASE}?${qs}`;
  }
  function buildServerProxyUrl(mode, params = {}) {
    const qs = new URLSearchParams({ mode, t: Date.now(), ...params }).toString();
    return `${PROXY_BASE}?${qs}`;
  }
  function buildAllOriginsUrl(mode, params = {}) {
    const direct = buildDirectUrl(mode, params);
    return `https://api.allorigins.win/raw?url=${encodeURIComponent(direct)}`;
  }

  function buildUrl(mode, params = {}) {
    if (USE_PROXY_SERVER) return buildServerProxyUrl(mode, params);  // jouw server-proxy
    if (USE_PUBLIC_PROXY) return buildAllOriginsUrl(mode, params);   // tijdelijke publieke proxy
    return buildDirectUrl(mode, params);                              // direct (meestal CORS-blokkade)
  }

  // === 5) API (GET) met robuuste foutafhandeling ===
  async function apiGet(mode, params = {}) {
    let res;
    const url = buildUrl(mode, params);
    try {
      res = await fetch(url, { cache: "no-store" });
    } catch {
      throw new Error("Geen verbinding met de API (netwerk of CORS)");
    }
    const txt = await res.text();                 // eerst text voor betere debug
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let json;
    try { json = JSON.parse(txt); }
    catch { throw new Error("Ongeldige JSON van API"); }
    if (!json.ok) throw new Error(json.error || "Onbekende API-fout");
    return json.data;
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
      console.info("[Klanten] Laden via:", USE_PROXY_SERVER ? "server-proxy" : (USE_PUBLIC_PROXY ? "AllOrigins" : "direct"));
      const [klRaw, hoRaw] = await Promise.all([ apiGet("klanten"), apiGet("honden") ]);
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

  // === 11) Debug: toon raw JSON met ?mode=klanten of ?mode=honden in de URL ===
  (async () => {
    const pre = document.getElementById("api-debug");
    const m = new URLSearchParams(location.search).get("mode");
    if (!pre || !m) return;
    pre.style.display = "";
    try {
      const data = await apiGet(m);
      pre.textContent = JSON.stringify({ ok:true, data }, null, 2);
    } catch (e) {
      pre.textContent = "❌ " + e.message;
    }
  })();

  // === 12) Start ===
  loadAll();
})();
