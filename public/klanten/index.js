/* v0.21.8 – Klantenpagina
   - Ping-first (detecteert login/permissions meteen)
   - Flexibele API base (URL param -> SuperhondConfig -> localStorage -> default)
   - Meerdere fallbacks (direct, proxy, AllOrigins raw/get, Jina)
   - Betere HTML-detectie + duidelijke errors
   - Compatibele timeout + defensieve rendering
*/
(() => {
  // === 0) CONFIG-RESOLVER ===
  const qs = new URLSearchParams(location.search);
  const QS_API_BASE = qs.get('apiBase')?.trim();
  const LS_KEY = 'superhond_api_base';
  const LS_API_BASE = (typeof localStorage !== 'undefined' && localStorage.getItem(LS_KEY)) || '';

  const DEFAULT_BASE = "https://script.google.com/macros/s/AKfycbwt_2IjbE68Nw01xnxeConxcNO0fNMwxZBW5DPDnGYYCFs9y00xOV69IA9aYFb9QRra/exec";
  const GAS_BASE =
    QS_API_BASE ||
    (window.SuperhondConfig?.apiBase) ||
    LS_API_BASE ||
    DEFAULT_BASE;

  // Option: same-origin proxy on Render
  const PROXY_BASE = "/api/sheets";
  const USE_PROXY_SERVER = false;

  const TIMEOUT_MS = 12000; // iets ruimer

  // Persist apiBase if provided via query
  try { if (QS_API_BASE) localStorage.setItem(LS_KEY, QS_API_BASE); } catch {}

  // === 1) DOM ===
  const els = {
    loader:    document.querySelector("#loader"),
    error:     document.querySelector("#error"),
    wrap:      document.querySelector("#wrap"),
    tbody:     document.querySelector("#tabel tbody"),
    btnNieuw:  document.querySelector("#btn-nieuw"),
    modal:     document.querySelector("#modal"),
    form:      document.querySelector("#form"),
    btnCancel: document.querySelector("#btn-cancel"),
    debug:     document.getElementById("api-debug"),
  };

  // === 2) STATE ===
  const state = { klanten: [], hondenByOwner: new Map() };

  // === 3) URL helpers ===
  const query = (mode, p={}) => new URLSearchParams({ mode, t: Date.now(), ...p }).toString();
  const directUrl = (m,p) => `${GAS_BASE}?${query(m,p)}`;
  const proxyUrl  = (m,p) => `${PROXY_BASE}?${query(m,p)}`;
  const aoRawUrl  = (m,p) => `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl(m,p))}`;
  const aoGetUrl  = (m,p) => `https://api.allorigins.win/get?url=${encodeURIComponent(directUrl(m,p))}`;
  // Jina "r" proxy (retourneert body als tekst). Let op: verwacht JSON-tekst.
  const jinaUrl   = (m,p) => `https://r.jina.ai/http://${directUrl(m,p).replace(/^https?:\/\//,'')}`;

  // === 4) Utils ===
  const stripBOM = s => String(s||'').replace(/^\uFEFF/, '').trim();
  const isProbablyHTML = (txt) => {
    const t = stripBOM(txt).slice(0, 200).toLowerCase();
    return t.startsWith('<!doctype') || t.startsWith('<html') || t.includes('<title>');
  };
  const isValidUrl = (u) => {
    try { new URL(u); return true; } catch { return false; }
  };

  // === 5) fetch + timeout (ook voor oudere Safari) ===
  async function fetchWithTimeout(url, ms = TIMEOUT_MS) {
    if (typeof AbortController !== "undefined") {
      const ac = new AbortController();
      const t  = setTimeout(() => ac.abort("timeout"), ms);
      try {
        return await fetch(url, { cache: "no-store", signal: ac.signal });
      } finally { clearTimeout(t); }
    }
    // Fallback zonder AbortController
    return Promise.race([
      fetch(url, { cache: "no-store" }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))
    ]);
  }

  function parseMaybeWrapped(text, expectWrapped=false) {
    const cleaned = stripBOM(text);
    if (isProbablyHTML(cleaned)) {
      throw new Error("Ontving HTML (waarschijnlijk Google loginpagina) — zet Apps Script Web App op ‘Iedereen (zelfs anoniem)’ en publiceer opnieuw.");
    }
    if (expectWrapped) {
      const wrap = JSON.parse(cleaned);
      if (!wrap || typeof wrap.contents !== "string") throw new Error("Proxy-antwoord onjuist (AllOrigins/get).");
      const inner = stripBOM(wrap.contents);
      if (isProbablyHTML(inner)) {
        throw new Error("Proxy gaf HTML door (login) — Web App is niet publiek.");
      }
      return JSON.parse(inner);
    }
    return JSON.parse(cleaned);
  }

  async function tryJson(url, expectWrapped=false) {
    const res = await fetchWithTimeout(url);
    const txt = await res.text().catch(() => { throw new Error("Kon API-antwoord niet lezen"); });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = parseMaybeWrapped(txt, expectWrapped);
    // accepteer { ok:true, data:[...] } of { data:[...] } of direct []
    const data = Array.isArray(j) ? j : (j?.data ?? null);
    const okFlag = j?.ok;
    if (!data && okFlag !== true) {
      throw new Error(j?.error || "Onbekende API-structuur (geen data).");
    }
    return data || [];
  }

  // === 6) Ping-first ===
  async function ping(base=GAS_BASE) {
    if (!base || !isValidUrl(base)) {
      throw new Error("Geen geldige API URL ingesteld. Ga naar Admin ▸ Instellingen.");
    }
    const url = `${base}?${query('ping')}`;
    const res = await fetchWithTimeout(url, 6000);
    const txt = await res.text().catch(()=>'');
    if (!res.ok) throw new Error(`Ping HTTP ${res.status}`);
    if (isProbablyHTML(txt)) {
      throw new Error("Ping gaf HTML (login) — zet de Web App op ‘Iedereen (zelfs anoniem)’ en publiceer opnieuw.");
    }
    try {
      const j = JSON.parse(stripBOM(txt));
      const ok = j?.ok === true || String(j?.ping || '').toLowerCase() === 'ok';
      if (!ok) throw new Error("Ping antwoordde, maar zonder ok-indicator.");
    } catch {
      throw new Error("Ping gaf geen geldige JSON terug.");
    }
    return true;
  }

  // === 7) GET met fallbacks ===
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
        // console.info(`[API] Try: ${a.name}`, a.url);
        return await tryJson(a.url, !!a.wrapped);
      } catch (e) {
        errors.push(`${a.name}: ${e.message}`);
        // console.warn(`[API] Error (${a.name}):`, e);
      }
    }
    throw new Error(`Ophalen mislukt – ${errors.join(" | ")}`);
  }

  // === 8) Normalisatie (lichtgewicht, defensief) ===
  function toTitle(s){ return String(s||'').toLowerCase().replace(/\b([a-zà-ÿ])/g, m => m.toUpperCase()); }
  function normKlant(k) {
    // Ondersteun zowel {naam} als {voornaam, achternaam}
    const full = String(k.naam || [k.voornaam, k.achternaam].filter(Boolean).join(' ') || "").trim();
    const [voornaam, ...rest] = full.split(/\s+/);
    const achternaam = rest.join(" ").trim();
    let plaats = "";
    if (k.adres) {
      const parts = String(k.adres).split(",");
      plaats = (parts[1] || parts[0] || "").trim();
    }
    return {
      id: (k.id || k.KlantID || "").toString(),
      naam: full ? toTitle(full) : "(naam onbekend)",
      voornaam: toTitle(voornaam || ""),
      achternaam: toTitle(achternaam || ""),
      email: (k.email || "").toLowerCase().trim(),
      telefoon: String(k.telefoon || k.gsm || "").trim(),
      plaats
    };
  }
  const normHond = h => ({
    id: (h.id || h.HondID || "").toString(),
    eigenaarId: (h.eigenaar_id || h.eigenaarId || h.KlantID || "").toString(),
    naam: toTitle(h.naam || h.HondNaam || ""),
    ras: toTitle(h.ras || h.breed || ""),
    geboortedatum: String(h.geboortedatum || h.geboorte || h.dob || "").trim()
  });

  // === 9) UI helpers ===
  function showLoader(on=true){
    if (els.loader) els.loader.style.display = on ? "" : "none";
    if (els.wrap)   els.wrap.style.display   = on ? "none" : "";
  }
  function showError(msg=""){
    if(!els.error) return;
    els.error.textContent = msg;
    els.error.style.display = msg ? "" : "none";
  }

  // === 10) Data laden ===
  async function loadAll(){
    showError(""); showLoader(true);
    try{
      // 10a) Ping eerst (duidelijke fout bij verkeerde rechten/URL)
      await ping(GAS_BASE);

      // 10b) Data
      const [klRaw, hoRaw] = await Promise.all([ apiGet("klanten"), apiGet("honden") ]);
      const klanten = (klRaw || []).map(normKlant);
      const honden  = (hoRaw || []).map(normHond);

      const map = new Map();
      for (const h of honden) {
        if (!map.has(h.eigenaarId)) map.set(h.eigenaarId, []);
        map.get(h.eigenaarId).push(h);
      }

      state.klanten = klanten;
      state.hondenByOwner = map;
      render();
    }catch(e){
      console.error("[Klanten] Fout:", e);
      showError(e?.message || "Laden mislukt");
    }finally{
      showLoader(false);
    }
  }

  // === 11) Render ===
  function render(){
    if(!els.tbody) return;
    if(!Array.isArray(state.klanten)) {
      els.tbody.innerHTML = `<tr><td colspan="5">Geen gegevens.</td></tr>`;
      return;
    }
    els.tbody.innerHTML = state.klanten.map(k=>{
      const dogs = state.hondenByOwner.get(k.id) || [];
      const dogChips = dogs.length
        ? dogs.map(d=>`<a class="chip btn btn-xs" href="../honden/detail.html?id=${encodeURIComponent(d.id)}" title="Bekijk ${d.naam}">${d.naam}</a>`).join(" ")
        : '<span class="muted">0</span>';
      const emailCell = k.email
        ? `<a href="mailto:${k.email}">${k.email}</a>`
        : "—";
      return `
        <tr data-id="${k.id}">
          <td><a href="./detail.html?id=${encodeURIComponent(k.id)}"><strong>${k.naam}</strong></a></td>
          <td>${emailCell}</td>
          <td>${k.telefoon || "—"}</td>
          <td>${dogChips}</td>
          <td class="right"><button class="btn btn-xs" data-action="edit" title="Bewerken">✏️</button></td>
        </tr>`;
    }).join("");
  }

  // === 12) Events ===
  els.btnNieuw?.addEventListener("click", () => els.modal?.showModal?.());
  els.btnCancel?.addEventListener("click", () => els.modal?.close?.());

  // === 13) Debugblok (open /klanten/?mode=klanten of ?mode=honden) ===
  (async () => {
    const m = new URLSearchParams(location.search).get("mode");
    if (!els.debug || !m) return;
    els.debug.style.display = "";
    try {
      // ping zodat foutmelding duidelijker is als permissies niet kloppen
      await ping(GAS_BASE);
      const data = await apiGet(m);
      els.debug.textContent = JSON.stringify({ ok:true, data }, null, 2);
    } catch (e) {
      els.debug.textContent = "❌ " + (e?.message || String(e));
    }
  })();

  // === 14) Start ===
  loadAll();
})();
