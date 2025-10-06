/* v0.21.7 – Klantenpagina (GAS API met compatibele timeout + meerdere fallbacks + duidelijke errors) */
(() => {
  // === 1) BASIS ===
  const GAS_BASE =
    (window.SuperhondConfig?.apiBase) ||
    "https://script.google.com/macros/s/AKfycbwt_2IjbE68Nw01xnxeConxcNO0fNMwxZBW5DPDnGYYCFs9y00xOV69IA9aYFb9QRra/exec";

  // Optioneel: eigen same-origin proxy op je Render site (Node/Express)
  const PROXY_BASE = "/api/sheets";
  const USE_PROXY_SERVER = false;

  const TIMEOUT_MS = 12000; // iets ruimer

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
    debug:     document.getElementById("api-debug")
  };

  // === 3) STATE ===
  const state = { klanten: [], hondenByOwner: new Map() };

  // === 4) URL helpers ===
  const query = (mode, p={}) => new URLSearchParams({ mode, t: Date.now(), ...p }).toString();
  const directUrl = (m,p) => `${GAS_BASE}?${query(m,p)}`;
  const proxyUrl  = (m,p) => `${PROXY_BASE}?${query(m,p)}`;
  const aoRawUrl  = (m,p) => `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl(m,p))}`;
  const aoGetUrl  = (m,p) => `https://api.allorigins.win/get?url=${encodeURIComponent(directUrl(m,p))}`;
  // Jina “r” proxy (nog een publiek CORS-omzeiler). Verwacht JSON als tekst.
  const jinaUrl   = (m,p) => `https://r.jina.ai/http://${directUrl(m,p).replace(/^https?:\/\//,'')}`;

  const stripBOM = s => String(s||'').replace(/^\uFEFF/, '').trim();

  // === 5) fetch + timeout die óók op oudere Safari werkt ===
  async function fetchWithTimeout(url, ms = TIMEOUT_MS) {
    if (typeof AbortController !== "undefined") {
      const ac = new AbortController();
      const t  = setTimeout(() => ac.abort("timeout"), ms);
      try {
        return await fetch(url, { cache: "no-store", signal: ac.signal });
      } finally { clearTimeout(t); }
    }
    // fallback zonder AbortController
    return Promise.race([
      fetch(url, { cache: "no-store" }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))
    ]);
  }

  function parseMaybeWrapped(text, expectWrapped=false) {
    const cleaned = stripBOM(text);
    if (expectWrapped) {
      const wrap = JSON.parse(cleaned);
      if (!wrap || typeof wrap.contents !== "string") throw new Error("Proxy-antwoord onjuist");
      return JSON.parse(stripBOM(wrap.contents));
    }
    return JSON.parse(cleaned);
  }

  async function tryJson(url, expectWrapped=false) {
    const res = await fetchWithTimeout(url);
    const txt = await res.text().catch(() => { throw new Error("Kon API-antwoord niet lezen"); });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = parseMaybeWrapped(txt, expectWrapped);
    if (!j || j.ok !== true) throw new Error(j?.error || "Onbekende API-fout");
    return j.data;
  }

  // === 6) GET met fallbacks ===
  async function apiGet(mode, params={}) {
    const attempts = [
      { name: "direct",   url: directUrl(mode, params) },
      ...(USE_PROXY_SERVER ? [{ name:"proxy", url: proxyUrl(mode, params) }] : []),
      { name: "allorigins-raw", url: aoRawUrl(mode, params) },
      { name: "allorigins-get", url: aoGetUrl(mode, params), wrapped: true },
      { name: "jina", url: jinaUrl(mode, params) }
    ];

    const errors = [];
    for (const a of attempts) {
      try {
        console.info(`[API] Probeer: ${a.name}`, a.url);
        return await tryJson(a.url, !!a.wrapped);
      } catch (e) {
        errors.push(`${a.name}: ${e.message}`);
        console.warn(`[API] Fout (${a.name}):`, e);
      }
    }
    throw new Error(`Load failed – ${errors.join(" | ")}`);
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
    return { id: k.id || "", naam: full || "(naam onbekend)", voornaam, achternaam, email: k.email || "", telefoon: k.telefoon || "", plaats };
  }
  const normHond = h => ({ id: h.id || "", eigenaarId: h.eigenaar_id || h.eigenaarId || "", naam: h.naam || "", ras: h.ras || "", geboortedatum: h.geboortedatum || "" });

  // === 8) UI helpers ===
  function showLoader(on=true){ if(els.loader) els.loader.style.display = on ? "" : "none"; if(els.wrap) els.wrap.style.display = on ? "none" : ""; }
  function showError(msg=""){ if(!els.error) return; els.error.textContent = msg; els.error.style.display = msg ? "" : "none"; }

  // === 9) Data laden ===
  async function loadAll(){
    showError(""); showLoader(true);
    try{
      const [klRaw, hoRaw] = await Promise.all([ apiGet("klanten"), apiGet("honden") ]);
      const klanten = klRaw.map(normKlant);
      const honden  = hoRaw.map(normHond);

      const map = new Map();
      honden.forEach(h => { if(!map.has(h.eigenaarId)) map.set(h.eigenaarId, []); map.get(h.eigenaarId).push(h); });

      state.klanten = klanten;
      state.hondenByOwner = map;
      render();
    }catch(e){
      console.error("[Klanten] Fout:", e);
      showError(e.message || "Load failed");
    }finally{
      showLoader(false);
    }
  }

  // === 10) Render ===
  function render(){
    if(!els.tbody) return;
    els.tbody.innerHTML = state.klanten.map(k=>{
      const dogs = state.hondenByOwner.get(k.id) || [];
      const dogChips = dogs.length
        ? dogs.map(d=>`<a class="chip btn btn-xs" href="../honden/detail.html?id=${d.id}" title="Bekijk ${d.naam}">${d.naam}</a>`).join(" ")
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

  // === 12) Debugblok (open /klanten/?mode=klanten of ?mode=honden) ===
  (async () => {
    const m = new URLSearchParams(location.search).get("mode");
    if (!els.debug || !m) return;
    els.debug.style.display = "";
    try { els.debug.textContent = JSON.stringify({ ok:true, data: await apiGet(m) }, null, 2); }
    catch (e) { els.debug.textContent = "❌ " + (e?.message || String(e)); }
  })();

  // === 13) Start ===
  loadAll();
})();
