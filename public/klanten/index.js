/* v0.21.4 – Klantenpagina (Apps Script API met auto-fallback & timeout) */
(() => {
  // === 1) BASIS-
  const GAS_BASE =
  (window.SuperhondConfig?.apiBase) ||
  "https://script.google.com/macros/s/AKfycbwt_2IjbE68Nw01xnxeConxcNO0fNMwxZBW5DPDnGYYCFs9y00xOV69IA9aYFb9QRra/exec";

  const PROXY_BASE = "/api/sheets";  // eigen server-proxy (same-origin)
  const USE_PROXY_SERVER = false;    // zet op true wanneer je proxy live is

  const TIMEOUT_MS = 8000;

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

  // === 4) Helpers ===
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function withTimeout(promise, ms = TIMEOUT_MS) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort("timeout"), ms);
    return Promise.race([
      promise(ctrl.signal).finally(() => clearTimeout(t)),
      (async () => { await sleep(ms + 10); throw new Error("timeout"); })()
    ]);
  }

  function buildDirectUrl(mode, params={}) {
    const qs = new URLSearchParams({ mode, t: Date.now(), ...params }).toString();
    return `${GAS_BASE}?${qs}`;
  }
  function buildServerProxyUrl(mode, params={}) {
    const qs = new URLSearchParams({ mode, t: Date.now(), ...params }).toString();
    return `${PROXY_BASE}?${qs}`;
  }
  function buildAllOriginsRawUrl(mode, params={}) {
    return `https://api.allorigins.win/raw?url=${encodeURIComponent(buildDirectUrl(mode, params))}`;
  }
  function buildAllOriginsGetUrl(mode, params={}) {
    return `https://api.allorigins.win/get?url=${encodeURIComponent(buildDirectUrl(mode, params))}`;
  }

  // === 5) robuuste GET (direct → server-proxy → publieke proxy) ===
  async function apiGet(mode, params = {}) {
    // a) direct naar GAS
    try {
      return await fetchJson(buildDirectUrl(mode, params));
    } catch (e1) {
      console.warn("[API] Direct faalde:", e1?.message || e1);
    }

    // b) eigen server proxy (indien geactiveerd)
    if (USE_PROXY_SERVER) {
      try {
        return await fetchJson(buildServerProxyUrl(mode, params));
      } catch (e2) {
        console.warn("[API] Server-proxy faalde:", e2?.message || e2);
      }
    }

    // c) publieke proxy (AllOrigins) – probeer raw, en zo nodig get->contents
    try {
      return await fetchJson(buildAllOriginsRawUrl(mode, params));
    } catch (e3) {
      console.warn("[API] AllOrigins /raw faalde:", e3?.message || e3);
      // /get-variant geeft {contents:"<string>"} terug
      const j = await fetchJson(buildAllOriginsGetUrl(mode, params), {expectWrapped: true});
      return j;
    }
  }

  // === 6) fetchJson met betere JSON-detectie ===
  async function fetchJson(url, opts = {}) {
    const { expectWrapped = false } = opts;
    const doFetch = (signal) => fetch(url, { cache: "no-store", signal });

    let res, text;
    try {
      res = await withTimeout(doFetch);
    } catch (e) {
      throw new Error(e?.message === "timeout" ? "Time-out bij API" : "Geen netwerkverbinding");
    }
    try {
      text = await res.text();
    } catch {
      throw new Error("Kon API-antwoord niet lezen");
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // AllOrigins /get geeft {"contents":"..."} – probeer dat eerst indien verwacht
    if (expectWrapped) {
      let wrapper;
      try { wrapper = JSON.parse(text); } catch { throw new Error("Ongeldige JSON van proxy"); }
      if (!wrapper || typeof wrapper.contents !== "string") throw new Error("Proxy-antwoord onjuist");
      text = wrapper.contents;
    }

    let json;
    try { json = JSON.parse(text); }
    catch { throw new Error("Ongeldige JSON van API"); }

    if (!json || json.ok !== true) throw new Error(json?.error || "Onbekende API-fout");
    return json.data;
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

  // === 8) UI helpers ===
  function showLoader(on = true) {
    if (els.loader) els.loader.style.display = on ? "" : "none";
    if (els.wrap)   els.wrap.style.display   = on ? "none" : "";
  }
  function showError(msg = "") {
    if (!els.error) return;
    els.error.textContent = msg;
    els.error.style.display = msg ? "" : "none";
  }

  // === 9) Data laden ===
  async function loadAll() {
    showError("");
    showLoader(true);
    try {
      console.info("[Klanten] Laden…");
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
      console.info(`[Klanten] OK – ${klanten.length} klanten, ${honden.length} honden`);
    } catch (e) {
      console.error("[Klanten] Fout:", e);
      showError("⚠️ " + e.message);
    } finally {
      showLoader(false);
    }
  }

  // === 10) Render ===
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

  // === 11) Events ===
  els.btnNieuw?.addEventListener("click", () => els.modal?.showModal?.());
  els.btnCancel?.addEventListener("click", () => els.modal?.close?.());

  // === 12) Debug (optioneel): toon raw JSON met ?mode=klanten of ?mode=honden ===
  (async () => {
    const pre = document.getElementById("api-debug");
    const m = new URLSearchParams(location.search).get("mode");
    if (!pre || !m) return;
    pre.style.display = "";
    try { pre.textContent = JSON.stringify({ ok:true, data: await apiGet(m) }, null, 2); }
    catch (e) { pre.textContent = "❌ " + e.message; }
  })();

  // === 13) Start ===
  loadAll();
})();
