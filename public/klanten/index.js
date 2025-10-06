/* v0.22.6 – Klantenpagina
   - Ping-first + GET (klanten/honden)
   - ✅ Nieuw: POST saveKlant (modal -> bewaren)
   - Duidelijke fouten + defensieve JSON parsing
*/
(() => {
  // === 0) CONFIG ===
  const qs = new URLSearchParams(location.search);
  const LS_KEY = 'superhond_api_base';
  const fromQS = (qs.get('apiBase') || '').trim();
  try { if (fromQS) localStorage.setItem(LS_KEY, fromQS); } catch {}

  const GAS_BASE =
    fromQS ||
    (window.SuperhondConfig?._resolved || '') ||
    (typeof localStorage !== 'undefined' ? (localStorage.getItem(LS_KEY) || '') : '');

  const PROXY_BASE = "/api/sheets";   // (optioneel) eigen proxy
  const USE_PROXY_SERVER = false;     // zet op true als je proxy gebruikt
  const TIMEOUT_MS = 12000;

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
    btnSave:   document.querySelector("#btn-save"),
    debug:     document.getElementById("api-debug"),
  };

  // Form velden
  const fld = (id) => els.form?.querySelector(`#${id}`);
  const F = {
    id:          () => fld('fld-id'),
    naam:        () => fld('fld-naam'),
    voornaam:    () => fld('fld-voornaam'),
    achternaam:  () => fld('fld-achternaam'),
    email:       () => fld('fld-email'),
    telefoon:    () => fld('fld-telefoon'),
    land:        () => fld('fld-land'),
    straat:      () => fld('fld-straat'),
    huisnr:      () => fld('fld-huisnr'),
    bus:         () => fld('fld-bus'),
    postcode:    () => fld('fld-postcode'),
    gemeente:    () => fld('fld-gemeente'),
  };

  // === 2) STATE ===
  const state = { klanten: [], hondenByOwner: new Map(), lastRoute: null };

  // === 3) URL helpers ===
  const stripBOM = s => String(s||'').replace(/^\uFEFF/, '').trim();
  const query = (mode, p={}) => new URLSearchParams({ mode, t: Date.now(), ...p }).toString();
  const directUrl = (m,p) => `${GAS_BASE}?${query(m,p)}`;
  const proxyUrl  = (m,p) => `${PROXY_BASE}?${query(m,p)}`;
  const aoRawUrl  = (m,p) => `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl(m,p))}`;
  const aoGetUrl  = (m,p) => `https://api.allorigins.win/get?url=${encodeURIComponent(directUrl(m,p))}`;
  const jinaUrl   = (m,p) => `https://r.jina.ai/http://${directUrl(m,p).replace(/^https?:\/\//,'')}`;

  const isProbablyHTML = (txt) => {
    const t = stripBOM(txt).slice(0, 200).toLowerCase();
    return t.startsWith('<!doctype') || t.startsWith('<html') || t.includes('<title>');
  };

  const isValidUrl = (u) => { try { new URL(u); return true; } catch { return false; } };

  // === 4) fetch helpers ===
  async function fetchWithTimeout(url, opts={}, ms = TIMEOUT_MS) {
    if (typeof AbortController !== "undefined") {
      const ac = new AbortController();
      const t  = setTimeout(() => ac.abort("timeout"), ms);
      try {
        return await fetch(url, { cache: "no-store", ...opts, signal: ac.signal });
      } finally { clearTimeout(t); }
    }
    return Promise.race([
      fetch(url, { cache: "no-store", ...opts }),
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
      if (isProbablyHTML(inner)) throw new Error("Proxy gaf HTML (login).");
      return JSON.parse(inner);
    }
    return JSON.parse(cleaned);
  }

  async function tryJson(url, expectWrapped=false, routeName='direct') {
    const res = await fetchWithTimeout(url);
    const txt = await res.text().catch(() => { throw new Error(`${routeName}: kon body niet lezen`); });
    if (!res.ok) throw new Error(`${routeName}: HTTP ${res.status}`);
    const j = parseMaybeWrapped(txt, expectWrapped);
    const data = Array.isArray(j) ? j : (j?.data ?? null);
    const okFlag = j?.ok;
    if (!data && okFlag !== true) throw new Error(`${routeName}: onbekende API-structuur (geen data)`);
    state.lastRoute = routeName;
    return data || [];
  }

  async function ping(base=GAS_BASE) {
    if (!base || !isValidUrl(base)) throw new Error("Geen geldige API URL ingesteld. Ga naar Admin ▸ Instellingen.");
    const direct = `${base}?${query('ping')}`;
    const steps = [
      { name: 'direct',         url: direct,               wrapped: false },
      { name: 'jina',           url: `https://r.jina.ai/http://${direct.replace(/^https?:\/\//,'')}`, wrapped: false },
      { name: 'allorigins-raw', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(direct)}`, wrapped: false },
      { name: 'allorigins-get', url: `https://api.allorigins.win/get?url=${encodeURIComponent(direct)}`, wrapped: true },
    ];
    for (const s of steps) {
      try {
        const r = await fetchWithTimeout(s.url, {}, 8000);
        const txt = await r.text();
        if (!r.ok) continue;
        const j = parseMaybeWrapped(txt, s.wrapped);
        const ok = j?.ok === true || String(j?.ping || '').toLowerCase() === 'ok' || j?.data?.ok === true;
        if (ok) { state.lastRoute = s.name; return true; }
      } catch {}
    }
    throw new Error("Ping faalde (permissions/URL?).");
  }

  async function apiGet(mode, params={}) {
    const attempts = [
      ...(USE_PROXY_SERVER ? [{ name:"proxy", url: proxyUrl(mode, params), wrapped:false }] : []),
      { name: "jina",           url: jinaUrl(mode, params),             wrapped:false },
      { name: "allorigins-raw", url: aoRawUrl(mode, params),            wrapped:false },
      { name: "allorigins-get", url: aoGetUrl(mode, params),            wrapped:true  },
      { name: "direct",         url: directUrl(mode, params),           wrapped:false },
    ];
    const errors = [];
    for (const a of attempts) {
      try { return await tryJson(a.url, !!a.wrapped, a.name); }
      catch (e) { errors.push(`${a.name}: ${e.message}`); }
    }
    throw new Error(`Ophalen mislukt (${mode}) – ${errors.join(" | ")}`);
  }

  // === 5) ✅ POST saveKlant ===
  async function apiPost(mode, payload) {
    // Voor POST zijn proxies vaak nodig; proberen eerst direct → dan (optioneel) server-proxy
    const body = JSON.stringify(payload || {});
    const headers = { "Content-Type":"application/json" };

    // 5a) Direct naar GAS
    try {
      const url = `${GAS_BASE}?mode=${encodeURIComponent(mode)}&t=${Date.now()}`;
      const r = await fetchWithTimeout(url, { method:"POST", headers, body }, 12000);
      const txt = await r.text();
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = parseMaybeWrapped(txt, false);
      if (j?.ok !== true) throw new Error(j?.error || "Onbekende API-fout");
      return j.data;
    } catch (e) {
      if (!USE_PROXY_SERVER) throw e;
    }

    // 5b) (Optioneel) via eigen proxy
    if (USE_PROXY_SERVER) {
      const url = `${PROXY_BASE}?mode=${encodeURIComponent(mode)}&t=${Date.now()}`;
      const r = await fetchWithTimeout(url, { method:"POST", headers, body }, 12000);
      const j = await r.json();
      if (!r.ok || j?.ok !== true) throw new Error(j?.error || `Proxy HTTP ${r.status}`);
      return j.data;
    }

    throw new Error("Bewaren mislukt: geen werkende POST-route.");
  }

  // === 6) Normalisatie ===
  const toTitle = s => String(s||'').toLowerCase().replace(/\b([a-zà-ÿ])/g, m => m.toUpperCase());
  function normKlant(k) {
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

  // === 7) UI helpers ===
  function showLoader(on=true){
    if (els.loader) els.loader.style.display = on ? "" : "none";
    if (els.wrap)   els.wrap.style.display   = on ? "none" : "";
  }
  function showError(msg=""){
    if(!els.error) return;
    els.error.textContent = msg;
    els.error.style.display = msg ? "" : "none";
  }

  // === 8) Data laden ===
  async function loadAll(){
    showError(""); showLoader(true);
    try{
      await ping(GAS_BASE);
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
      const hint = state.lastRoute ? ` (route: ${state.lastRoute})` : '';
      showError((e?.message || "Laden mislukt") + hint);
    }finally{
      showLoader(false);
    }
  }

  // === 9) Render ===
  function render(){
    if(!els.tbody) return;
    if(!Array.isArray(state.klanten) || state.klanten.length === 0) {
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

  // === 10) Form helpers ===
  const sv = (el) => (el ? String(el.value || '').trim() : '');
  const emailLike = (s) => /\S+@\S+\.\S+/.test(String(s||''));

  function composeAdres() {
    const p1 = [sv(F.straat()), [sv(F.huisnr()), sv(F.bus())].filter(Boolean).join('')].filter(Boolean).join(' ');
    const p2 = [sv(F.postcode()), sv(F.gemeente())].filter(Boolean).join(' ');
    return [p1, p2].filter(Boolean).join(', ');
  }
  function fullName() {
    const n = sv(F.naam());
    if (n) return n;
    const comb = [sv(F.voornaam()), sv(F.achternaam())].filter(Boolean).join(' ').trim();
    return comb;
  }

  async function onSave() {
    try {
      if (!els.form) return;
      els.btnSave && (els.btnSave.disabled = true);
      showError('');

      const payload = {
        id: sv(F.id()),                              // optioneel
        naam: fullName(),                            // verplicht
        email: sv(F.email()),                        // verplicht
        telefoon: sv(F.telefoon()) || '',
        adres: composeAdres() || '',
        status: 'actief',                            // eventueel uit UI halen later
        // losse velden stuur je mee (niet vereist door GAS, kan handig zijn)
        voornaam: sv(F.voornaam()),
        achternaam: sv(F.achternaam()),
        land: sv(F.land()),
        straat: sv(F.straat()),
        huisnr: sv(F.huisnr()),
        bus: sv(F.bus()),
        postcode: sv(F.postcode()),
        gemeente: sv(F.gemeente())
      };

      if (!payload.naam)  throw new Error("Naam is verplicht.");
      if (!payload.email || !emailLike(payload.email)) throw new Error("Geef een geldig e-mailadres.");

      // POST → saveKlant (GAS doPost)
      await apiPost('saveKlant', payload);

      // herladen en modal sluiten
      await loadAll();
      if (els.modal?.close) els.modal.close();
      else els.modal?.setAttribute?.('open','false');
    } catch (err) {
      console.error("Bewaren mislukt:", err);
      showError("❌ Bewaren mislukt: " + (err?.message || err));
    } finally {
      els.btnSave && (els.btnSave.disabled = false);
    }
  }

  // === 11) Events ===
  els.btnNieuw?.addEventListener("click", () => {
    if (!els.modal || !els.form) return;
    els.form.reset();
    els.modal.showModal?.();
  });

  els.btnCancel?.addEventListener("click", () => els.modal?.close?.());
  els.btnSave?.addEventListener("click", onSave);

  // === 12) Debug (optioneel) ===
  (async () => {
    const m = new URLSearchParams(location.search).get("mode");
    if (!els.debug || !m) return;
    els.debug.style.display = "";
    try {
      await ping(GAS_BASE);
      const data = await apiGet(m);
      els.debug.textContent = JSON.stringify({ ok:true, data, route: state.lastRoute }, null, 2);
    } catch (e) {
      els.debug.textContent = "❌ " + (e?.message || String(e));
    }
  })();

  // === 13) Start ===
  loadAll();
})();
