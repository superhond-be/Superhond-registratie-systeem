/* v0.22.7 – Klantenpagina (snelle load)
   - 1 call: mode=all → {klanten, honden}
   - Route-memoization: gebruik direct route zodra die 1x werkt
   - Local cache (5 min) → instant UI, dan stil refresh
*/
(() => {
  // === Config ===
  const qs = new URLSearchParams(location.search);
  const LS_KEY_API = 'superhond_api_base';
  const LS_KEY_ROUTE = 'superhond_api_route';     // 'direct' | 'jina' | 'ao-raw' | 'ao-get' | 'proxy'
  const LS_KEY_CACHE = 'superhond_cache_all';     // { ts, data:{klanten, honden} }
  const CACHE_TTL_MS = 5 * 60 * 1000;             // 5 min
  const fromQS = (qs.get('apiBase') || '').trim();
  try { if (fromQS) localStorage.setItem(LS_KEY_API, fromQS); } catch {}

  const GAS_BASE =
    fromQS ||
    (window.SuperhondConfig?._resolved || '') ||
    (typeof localStorage !== 'undefined' ? (localStorage.getItem(LS_KEY_API) || '') : '');

  const PROXY_BASE = "/api/sheets";
  const USE_PROXY_SERVER = false; // zet true als je serverproxy actief gebruikt
  const TIMEOUT_MS = 8000;

  // === DOM ===
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
  };
  const fld = id => els.form?.querySelector(`#${id}`);

  // === Utils ===
  const stripBOM = s => String(s||'').replace(/^\uFEFF/, '').trim();
  const isHTML = t => /^\s*</.test(stripBOM(t).slice(0,200).toLowerCase());
  const S = v => String(v ?? '');
  const sv = el => (el ? S(el.value).trim() : '');

  function fetchWithTimeout(url, opts={}, ms=TIMEOUT_MS){
    if (typeof AbortController !== 'undefined') {
      const ac = new AbortController(), t = setTimeout(()=>ac.abort('timeout'), ms);
      return fetch(url, { cache:'no-store', ...opts, signal: ac.signal })
        .finally(()=>clearTimeout(t));
    }
    return Promise.race([
      fetch(url, { cache:'no-store', ...opts }),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')), ms))
    ]);
  }
  const query = (mode, p={}) => new URLSearchParams({ mode, t: Date.now(), ...p }).toString();
  const directUrl = (m,p) => `${GAS_BASE}?${query(m,p)}`;
  const proxyUrl  = (m,p) => `${PROXY_BASE}?${query(m,p)}`;
  const aoRawUrl  = (m,p) => `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl(m,p))}`;
  const aoGetUrl  = (m,p) => `https://api.allorigins.win/get?url=${encodeURIComponent(directUrl(m,p))}`;
  const jinaUrl   = (m,p) => `https://r.jina.ai/http://${directUrl(m,p).replace(/^https?:\/\//,'')}`;

  function parseMaybeWrapped(txt, wrapped=false){
    const t = stripBOM(txt);
    if (isHTML(t)) throw new Error('HTML/login ontvangen (Web App niet publiek?)');
    if (!wrapped) return JSON.parse(t);
    const j = JSON.parse(t);
    const c = stripBOM(j.contents || '');
    if (isHTML(c)) throw new Error('Proxy HTML ontvangen');
    return JSON.parse(c);
  }

  // === Adaptive route ===
  function getSavedRoute(){ try { return localStorage.getItem(LS_KEY_ROUTE) || ''; } catch { return ''; } }
  function saveRoute(name){ try { localStorage.setItem(LS_KEY_ROUTE, name); } catch {} }

  async function tryRoute(name, url, wrapped=false){
    const r = await fetchWithTimeout(url);
    const txt = await r.text();
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
    const j = parseMaybeWrapped(txt, wrapped);
    const data = Array.isArray(j) ? j : (j?.data ?? j);
    if (!data) throw new Error(`${name}: leeg antwoord`);
    saveRoute(name);
    return data;
  }

  async function apiGetAll() {
    const mode = 'all'; // { klanten, honden }
    const saved = getSavedRoute();

    // 1) Als we al weten dat 'direct' werkt → gebruik alleen die voor snelheid
    const trySeq = (()=>{
      if (saved === 'direct') return [{n:'direct', u:directUrl(mode)}];
      if (saved === 'jina')   return [{n:'jina',   u:jinaUrl(mode)}];
      if (saved === 'ao-raw') return [{n:'ao-raw', u:aoRawUrl(mode)}];
      if (saved === 'ao-get') return [{n:'ao-get', u:aoGetUrl(mode), w:true}];
      if (saved === 'proxy' && USE_PROXY_SERVER) return [{n:'proxy', u:proxyUrl(mode)}];

      // Geen bekende route → probeer snelste eerst
      return [
        {n:'direct', u:directUrl(mode)},
        ...(USE_PROXY_SERVER ? [{n:'proxy', u:proxyUrl(mode)}] : []),
        {n:'jina',   u:jinaUrl(mode)},
        {n:'ao-raw', u:aoRawUrl(mode)},
        {n:'ao-get', u:aoGetUrl(mode), w:true},
      ];
    })();

    const errors=[];
    for (const s of trySeq) {
      try { return await tryRoute(s.n, s.u, !!s.w); }
      catch(e){ errors.push(e.message); }
    }
    throw new Error('Ophalen mislukt – ' + errors.join(' | '));
  }

  // === Normalisatie ===
  const toTitle = s => S(s).toLowerCase().replace(/\b([a-zà-ÿ])/g, m => m.toUpperCase());
  function normKlant(k){
    const full = S(k.naam || [k.voornaam, k.achternaam].filter(Boolean).join(' ')).trim();
    const [voornaam, ...rest] = full.split(/\s+/);
    return {
      id: S(k.id || k.KlantID || ''),
      naam: full || '(naam onbekend)',
      voornaam: toTitle(voornaam || ''),
      achternaam: toTitle(rest.join(' ') || ''),
      email: S(k.email || '').toLowerCase(),
      telefoon: S(k.telefoon || k.gsm || ''),
    };
  }
  const normHond = h => ({
    id: S(h.id || h.HondID || ''),
    eigenaarId: S(h.eigenaar_id || h.eigenaarId || h.KlantID || ''),
    naam: toTitle(h.naam || h.HondNaam || ''),
  });

  // === UI helpers ===
  function showLoader(on=true){ if(els.loader) els.loader.style.display = on ? '' : 'none'; if(els.wrap) els.wrap.style.display = on ? 'none' : ''; }
  function showError(msg=''){ if(!els.error) return; els.error.textContent = msg; els.error.style.display = msg ? '' : 'none'; }

  // === Cache helpers ===
  function readCache(){
    try {
      const raw = localStorage.getItem(LS_KEY_CACHE);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj?.ts || !obj?.data) return null;
      if (Date.now() - obj.ts > CACHE_TTL_MS) return null;
      return obj.data; // {klanten, honden}
    } catch { return null; }
  }
  function writeCache(data){
    try { localStorage.setItem(LS_KEY_CACHE, JSON.stringify({ ts: Date.now(), data })); } catch {}
  }

  // === Render ===
  function render(klanten=[], honden=[]){
    if(!els.tbody) return;
    const map = new Map();
    honden.forEach(h => { if(!map.has(h.eigenaarId)) map.set(h.eigenaarId, []); map.get(h.eigenaarId).push(h); });

    els.tbody.innerHTML = klanten.length ? klanten.map(k=>{
      const dogs = map.get(k.id) || [];
      const dogChips = dogs.length
        ? dogs.map(d=>`<a class="chip btn btn-xs" href="../honden/detail.html?id=${encodeURIComponent(d.id)}" title="Bekijk ${d.naam}">${d.naam}</a>`).join(' ')
        : '<span class="muted">0</span>';
      return `
        <tr data-id="${k.id}">
          <td><a href="./detail.html?id=${encodeURIComponent(k.id)}"><strong>${k.naam}</strong></a></td>
          <td>${k.email ? `<a href="mailto:${k.email}">${k.email}</a>` : '—'}</td>
          <td>${k.telefoon || '—'}</td>
          <td>${dogChips}</td>
          <td class="right"><button class="btn btn-xs" data-action="edit" title="Bewerken">✏️</button></td>
        </tr>`;
    }).join('') : `<tr><td colspan="5">Geen gegevens.</td></tr>`;
  }

  // === Load ===
  async function loadAll({ preferCache=true } = {}){
    showError('');
    let usedCache = false;

    // 1) snelle cache tonen
    if (preferCache) {
      const c = readCache();
      if (c?.klanten && c?.honden) {
        usedCache = true;
        if (els.wrap) els.wrap.style.display = '';
        if (els.loader) els.loader.style.display = 'none';
        render(c.klanten.map(normKlant), c.honden.map(normHond));
      }
    }

    // 2) live refresh (1 call)
    try{
      if (!usedCache) showLoader(true);
      const data = await apiGetAll(); // { klanten, honden }
      const klanten = (data.klanten || []).map(normKlant);
      const honden  = (data.honden  || []).map(normHond);
      writeCache({ klanten, honden });
      render(klanten, honden);
      showLoader(false);
    }catch(e){
      if (!usedCache) {
        console.error(e);
        showLoader(false);
        showError(e.message || 'Laden mislukt');
      } // bij cache laten we stil falen
    }
  }

  // === Save (POST saveKlant) ===
  const emailLike = s => /\S+@\S+\.\S+/.test(String(s||''));
  function fullName() {
    const n = sv(fld('fld-naam')); if (n) return n;
    const comb = [sv(fld('fld-voornaam')), sv(fld('fld-achternaam'))].filter(Boolean).join(' ').trim();
    return comb;
  }
  function composeAdres() {
    const p1 = [sv(fld('fld-straat')), [sv(fld('fld-huisnr')), sv(fld('fld-bus'))].filter(Boolean).join('')].filter(Boolean).join(' ');
    const p2 = [sv(fld('fld-postcode')), sv(fld('fld-gemeente'))].filter(Boolean).join(' ');
    return [p1, p2].filter(Boolean).join(', ');
  }

  async function apiPostSaveKlant(payload){
    const body = JSON.stringify(payload||{}), headers = { 'Content-Type':'application/json' };
    // direct
    const u = `${GAS_BASE}?mode=saveKlant&t=${Date.now()}`;
    const r = await fetchWithTimeout(u, { method:'POST', headers, body }, 10000);
    const txt = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = parseMaybeWrapped(txt, false);
    if (j?.ok !== true) throw new Error(j?.error || 'Onbekende API-fout');
    return j.data;
  }

  async function onSave(){
    try{
      els.btnSave && (els.btnSave.disabled = true);
      showError('');

      const payload = {
        id: sv(fld('fld-id')),
        // naam: fullName(),
        email: sv(fld('fld-email')),
        telefoon: sv(fld('fld-telefoon')) || '',
        adres: composeAdres(),
        status: 'actief',
        voornaam: sv(fld('fld-voornaam')),
        achternaam: sv(fld('fld-achternaam')),
        land: sv(fld('fld-land')),
        straat: sv(fld('fld-straat')),
        huisnr: sv(fld('fld-huisnr')),
        bus: sv(fld('fld-bus')),
        postcode: sv(fld('fld-postcode')),
        gemeente: sv(fld('fld-gemeente')),
      };
      if (!payload.naam) throw new Error('Naam is verplicht.');
      if (!payload.email || !emailLike(payload.email)) throw new Error('Geef een geldig e-mailadres.');

      await apiPostSaveKlant(payload);

      // cache ongeldig maken zodat volgende load vers is
      try { localStorage.removeItem(LS_KEY_CACHE); } catch {}
      await loadAll({ preferCache:false });
      els.modal?.close?.();
    }catch(e){
      showError('❌ Bewaren mislukt: ' + (e.message || e));
    }finally{
      els.btnSave && (els.btnSave.disabled = false);
    }
  }

  // === Events ===
  els.btnNieuw?.addEventListener('click', () => { els.form?.reset(); els.modal?.showModal?.(); });
  els.btnCancel?.addEventListener('click', () => els.modal?.close?.());
  els.btnSave?.addEventListener('click', onSave);

  // === Start ===
  loadAll();
})();
