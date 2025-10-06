/* v0.22.0 – Hondenpagina (centrale config + robuuste fallbacks)
   - Haalt GAS-base via SuperhondConfig.resolveApiBase()
   - Ping-first met fallbacks (direct -> Jina -> AO-raw -> AO-get)
   - GET: volgorde proxy -> Jina -> AO-raw -> AO-get -> direct
   - POST: proxy (indien aan) -> direct
   - Heldere foutmeldingen, defensieve parsing & rendering
*/
(async () => {
  // === 0) CONFIG-RESOLVER (async) ===
  const LS_KEY = 'superhond_api_base';

  async function resolveApiBase() {
    if (window.SuperhondConfig?.resolveApiBase) {
      const v = await window.SuperhondConfig.resolveApiBase();
      if (v) return v;
    }
    try {
      const v = localStorage.getItem(LS_KEY) || '';
      if (v) return v.trim();
    } catch {}
    return '';
  }

  let GAS_BASE = (await resolveApiBase()) || '';
  const PROXY_BASE = "/api/sheets";
  const USE_PROXY_SERVER = false; // zet TRUE als je proxy actief is (aanrader voor POST)
  const TIMEOUT_MS = 12000;

  // === 1) DOM ===
  const els = {
    loader: document.querySelector("#loader"),
    error:  document.querySelector("#error"),
    wrap:   document.querySelector("#wrap"),
    tbody:  document.querySelector("#tabel tbody"),
    zoek:   document.querySelector("#zoek"),
    ownerFilter:  document.querySelector("#ownerFilter"),
    btnNieuw:     document.querySelector("#btn-nieuw"),
    modal:        document.querySelector("#modal"),
    form:         document.querySelector("#form"),
    btnCancel:    document.querySelector("#btn-cancel"),
    btnSave:      document.querySelector("#btn-save"),
    selEigenaar:  document.querySelector("#sel-eigenaar")
  };

  // === 2) STATE ===
  const state = {
    honden: [],
    klanten: [],
    kById: {},
    q: "",
    filterOwner: "",
    lastRoute: null
  };

  // === 3) URL helpers ===
  const query = (mode, p={}) => new URLSearchParams({ mode, t: Date.now(), ...p }).toString();
  const directUrl = (m,p) => `${GAS_BASE}?${query(m,p)}`;
  const proxyUrl  = (m,p) => `${PROXY_BASE}?${query(m,p)}`;
  const aoRawUrl  = (m,p) => `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl(m,p))}`;
  const aoGetUrl  = (m,p) => `https://api.allorigins.win/get?url=${encodeURIComponent(directUrl(m,p))}`;
  const jinaUrl   = (m,p) => `https://r.jina.ai/http://${directUrl(m,p).replace(/^https?:\/\//,'')}`;

  // === 4) Utils ===
  const strip = s => String(s||'').replace(/^\uFEFF/, '').trim();
  const isHTML = t => /^\s*</.test(strip(t));
  const isValidUrl = u => { try { new URL(u); return true; } catch { return false; } };

  async function fetchWithTimeout(url, ms = TIMEOUT_MS, init={}) {
    if (typeof AbortController !== "undefined") {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort("timeout"), ms);
      try { return await fetch(url, { cache:"no-store", signal: ac.signal, ...init }); }
      finally { clearTimeout(t); }
    }
    return Promise.race([
      fetch(url, { cache:"no-store", ...init }),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")), ms))
    ]);
  }

  function parseMaybeWrapped(text, expectWrapped=false) {
    const s = strip(text);
    if (isHTML(s)) throw new Error("HTML ontvangen (login/foutpagina) — zet de Web App op ‘Iedereen (zelfs anoniem)’ en publiceer opnieuw.");
    if (!expectWrapped) return JSON.parse(s);
    const outer = JSON.parse(s);
    if (typeof outer?.contents !== "string") throw new Error("Proxy-antwoord onjuist (AllOrigins/get).");
    const inner = strip(outer.contents);
    if (isHTML(inner)) throw new Error("Proxy gaf HTML door (login) — Web App is niet publiek.");
    return JSON.parse(inner);
  }

  async function tryJson(url, expectWrapped=false, routeName='direct', init={}) {
    const res = await fetchWithTimeout(url, TIMEOUT_MS, init);
    const txt = await res.text().catch(()=> { throw new Error(`${routeName}: body niet leesbaar`); });
    if (!res.ok) throw new Error(`${routeName}: HTTP ${res.status}`);
    const j = parseMaybeWrapped(txt, expectWrapped);
    const data = Array.isArray(j) ? j : (j?.data ?? null);
    const okFlag = j?.ok;
    if (!data && okFlag !== true) throw new Error(`${routeName}: onbekende API-structuur`);
    state.lastRoute = routeName;
    return data || [];
  }

  // === 5) Ping-first met fallbacks ===
  async function ping(base=GAS_BASE) {
    if (!base || !isValidUrl(base)) throw new Error("Geen geldige API URL ingesteld. Stel de Web-App URL in.");
    const direct = `${base}?${query('ping')}`;
    const steps = [
      { name:'direct',           url: direct,                                 wrapped:false },
      { name:'jina',             url: `https://r.jina.ai/http://${direct.replace(/^https?:\/\//,'')}`, wrapped:false },
      { name:'allorigins-raw',   url: `https://api.allorigins.win/raw?url=${encodeURIComponent(direct)}`, wrapped:false },
      { name:'allorigins-get',   url: `https://api.allorigins.win/get?url=${encodeURIComponent(direct)}`, wrapped:true }
    ];
    const errors=[];
    for (const s of steps) {
      try {
        const r = await fetchWithTimeout(s.url, 8000);
        const txt = await r.text();
        if (!r.ok) { errors.push(`${s.name}: HTTP ${r.status}`); continue; }
        const j = parseMaybeWrapped(txt, s.wrapped);
        const ok = j?.ok === true || String(j?.ping||'').toLowerCase()==='ok' || j?.data?.ok === true;
        if (!ok) { errors.push(`${s.name}: geen ok-indicator`); continue; }
        state.lastRoute = s.name;
        return true;
      } catch(e){ errors.push(`${s.name}: ${e.message}`); }
    }
    throw new Error(`Ping faalde – ${errors.join(' | ')}`);
  }

  // === 6) API GET met fallbacks ===
  async function apiGet(mode, params={}) {
    const attempts = [
      ...(USE_PROXY_SERVER ? [{ name:"proxy", url: proxyUrl(mode, params), wrapped:false }] : []),
      { name:"jina",           url: jinaUrl(mode, params),             wrapped:false },
      { name:"allorigins-raw", url: aoRawUrl(mode, params),            wrapped:false },
      { name:"allorigins-get", url: aoGetUrl(mode, params),            wrapped:true  },
      { name:"direct",         url: directUrl(mode, params),           wrapped:false }
    ];
    const errors=[];
    for (const a of attempts) {
      try { return await tryJson(a.url, !!a.wrapped, a.name); }
      catch(e){ errors.push(`${a.name}: ${e.message}`); }
    }
    throw new Error(`Ophalen mislukt (${mode}) – ${errors.join(' | ')}`);
  }

  // === 7) API POST (proxy → direct) ===
  async function apiPost(mode, payload) {
    const headers = { "Content-Type": "application/json" };

    // 1) via proxy (aanrader voor productie; vereist server-POST route)
    if (USE_PROXY_SERVER) {
      try {
        return await tryJson(`${PROXY_BASE}?mode=${encodeURIComponent(mode)}`, false, 'proxy-post', {
          method: "POST",
          headers,
          body: JSON.stringify(payload || {})
        });
      } catch (e) {
        // val door naar direct
      }
    }

    // 2) direct (kan door CORS of rate-limits geblokkeerd worden; werkt vaak als WebApp publiek is)
    try {
      return await tryJson(`${GAS_BASE}?mode=${encodeURIComponent(mode)}`, false, 'direct-post', {
        method: "POST",
        headers,
        body: JSON.stringify(payload || {})
      });
    } catch (e) {
      throw new Error(`POST ${mode} mislukt – ${e.message}${USE_PROXY_SERVER ? '' : ' (tip: activeer proxy-POST op je server)'}`);
    }
  }

  // === 8) Normalisatie ===
  const toTitle = s => String(s||'').toLowerCase().replace(/\b([a-zà-ÿ])/g, m => m.toUpperCase());

  const normKlant = k => ({
    id: (k.id || "").toString(),
    naam: String(k.naam || "").trim() || "(naam onbekend)"
  });

  const normHond = h => ({
    id: (h.id || "").toString(),
    eigenaarId: (h.eigenaar_id || h.eigenaarId || "").toString(),
    naam: toTitle(h.naam || ""),
    ras: toTitle(h.ras || ""),
    geboortedatum: String(h.geboortedatum || "").trim(),
    chip: String(h.chip || "").trim()
  });

  // === 9) UI helpers ===
  function showLoader(show = true) {
    if (els.loader) els.loader.style.display = show ? "" : "none";
    if (els.wrap)   els.wrap.style.display   = show ? "none" : "";
  }
  function showError(msg = "") {
    if (!els.error) return;
    els.error.textContent = msg;
    els.error.style.display = msg ? "" : "none";
  }

  // === 10) Filtering ===
  function applyFilters(rows) {
    const q = state.q.toLowerCase();
    const owner = state.filterOwner;
    return rows.filter(h => {
      const eigenaarNaam = state.kById[h.eigenaarId]?.naam?.toLowerCase() || "";
      const text = `${h.naam} ${h.ras} ${h.geboortedatum} ${eigenaarNaam}`.toLowerCase();
      return (!owner || h.eigenaarId === owner) && (!q || text.includes(q));
    });
  }

  // === 11) Render tabel ===
  function render() {
    if (!els.tbody) return;
    const rows = applyFilters([...state.honden]);
    els.tbody.innerHTML = rows.map(h => {
      const e = state.kById[h.eigenaarId];
      const eigenaarCell = e
        ? `<a href="../klanten/detail.html?id=${encodeURIComponent(e.id)}">${e.naam}</a>`
        : "—";
      return `
        <tr data-id="${h.id}">
          <td><a href="./detail.html?id=${encodeURIComponent(h.id)}"><strong>${h.naam || "—"}</strong></a></td>
          <td>${h.ras || "—"}</td>
          <td>${h.geboortedatum || "—"}</td>
          <td>${eigenaarCell}</td>
          <td class="right">
            <button class="btn btn-xs" data-action="edit" title="Bewerken">✏️</button>
          </td>
        </tr>`;
    }).join("");
  }

  // === 12) Dropdowns ===
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

  // === 13) Opslaan ===
  async function onSave() {
    try {
      els.btnSave.disabled = true;
      showError("");
      const payload = {
        eigenaar_id: (els.selEigenaar.value || "").trim(),
        naam: (els.form.elements["naam"]?.value || "").trim(),
        ras: (els.form.elements["ras"]?.value || "").trim(),
        chip: (els.form.elements["chip"]?.value || "").trim(),
        geboortedatum: els.form.elements["geboortedatum"]?.value || ""
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
      if (els.btnSave) els.btnSave.disabled = false;
    }
  }

  // === 14) Modal ===
  function openModal(data = null) {
    if (!els.modal || !els.form) return;
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
    if (els.modal && typeof els.modal.close === "function") els.modal.close();
    if (els.modal) els.modal.removeAttribute("open");
  }

  // === 15) Events ===
  els.zoek?.addEventListener("input", e => { state.q = e.target.value; render(); });
  els.ownerFilter?.addEventListener("change", e => { state.filterOwner = e.target.value; render(); });
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

  // === 16) Data laden ===
  async function loadAll() {
    showLoader(true); showError("");
    try {
      await ping(GAS_BASE);
      const [honden, klanten] = await Promise.all([
        apiGet("honden"),
        apiGet("klanten")
      ]);
      state.honden = (honden || []).map(normHond);
      state.klanten = (klanten || []).map(normKlant);
      state.kById = Object.fromEntries(state.klanten.map(k => [k.id, k]));
      fillOwnerFilter();
      fillOwnerSelect();
      render();
    } catch (err) {
      console.error("Fout bij laden:", err);
      const hint = state.lastRoute ? ` (route: ${state.lastRoute})` : '';
      showError("⚠️ " + err.message + hint);
    } finally {
      showLoader(false);
    }
  }

  // === 17) Start ===
  if (!GAS_BASE) {
    showError("Geen API URL ingesteld. Open Admin ▸ Instellingen of de testpagina en stel de Web-App URL in. Herlaad daarna deze pagina.");
  } else {
    loadAll();
  }
})();
