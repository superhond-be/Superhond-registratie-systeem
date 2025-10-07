/* ===========================================================================
   Superhond – klantenmodule
   v0.23.1  (snelle load + save zonder “volledige naam”)
   - 1 call (mode=all) → {klanten, honden}
   - Route-memoization + 5 min cache
   - Auto-reload bij wijziging apiBase (via layout.js event)
   - Naam = voornaam + achternaam (fallback uit e-mail)
   =========================================================================== */
(() => {
  // ==== Config ====
  const qs = new URLSearchParams(location.search);
  const LS_KEY_API   = 'superhond_api_base';
  const LS_KEY_ROUTE = 'superhond_api_route';
  const LS_KEY_CACHE = 'superhond_cache_all';
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const TIMEOUT_MS   = 10000;
  const USE_PROXY_SERVER = false;
  const PROXY_BASE   = '/api/sheets';

  const fromQS = (qs.get('apiBase') || '').trim();
  try { if (fromQS) localStorage.setItem(LS_KEY_API, fromQS); } catch {}
  const GAS_BASE =
    fromQS ||
    (window.SuperhondConfig?._resolved || '') ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem(LS_KEY_API) || ''
      : '');

  // ==== DOM ====
  const els = {
    loader:    document.querySelector('#loader'),
    error:     document.querySelector('#error'),
    wrap:      document.querySelector('#wrap'),
    tbody:     document.querySelector('#tabel tbody'),
    zoek:      document.querySelector('#zoek'),
    btnNieuw:  document.querySelector('#btn-nieuw'),
    modal:     document.querySelector('#modal'),
    form:      document.querySelector('#form'),
    btnCancel: document.querySelector('#btn-cancel'),
    btnSave:   document.querySelector('#btn-save')
  };
  const fld = id => els.form?.querySelector(`#${id}`);

  // ==== Utils ====
  const stripBOM = s => String(s || '').replace(/^\uFEFF/, '').trim();
  const isHTML   = t => /^\s*</.test(stripBOM(t).slice(0, 200).toLowerCase());
  const S        = v => String(v ?? '');
  const sv       = el => (el ? S(el.value).trim() : '');

  function fetchWithTimeout(url, opts = {}, ms = TIMEOUT_MS) {
    if (typeof AbortController !== 'undefined') {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort('timeout'), ms);
      return fetch(url, { cache: 'no-store', ...opts, signal: ac.signal })
        .finally(() => clearTimeout(t));
    }
    return Promise.race([
      fetch(url, { cache: 'no-store', ...opts }),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error('timeout')), ms)
      )
    ]);
  }

  const query     = (mode, p = {}) => new URLSearchParams({ mode, t: Date.now(), ...p }).toString();
  const directUrl = (m, p) => `${GAS_BASE}?${query(m, p)}`;
  const proxyUrl  = (m, p) => `${PROXY_BASE}?${query(m, p)}`;
  const aoRawUrl  = (m, p) => `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl(m, p))}`;
  const aoGetUrl  = (m, p) => `https://api.allorigins.win/get?url=${encodeURIComponent(directUrl(m, p))}`;
  const jinaUrl   = (m, p) => `https://r.jina.ai/http://${directUrl(m, p).replace(/^https?:\/\//, '')}`;

  function parseMaybeWrapped(txt, wrapped = false) {
    const t = stripBOM(txt);
    if (isHTML(t)) throw new Error('HTML/login ontvangen (Web App niet publiek?)');
    if (!wrapped) return JSON.parse(t);
    const j = JSON.parse(t);
    const c = stripBOM(j.contents || '');
    if (isHTML(c)) throw new Error('Proxy HTML ontvangen');
    return JSON.parse(c);
  }

  // ==== Routebeheer ====
  const getSavedRoute = () => { try { return localStorage.getItem(LS_KEY_ROUTE) || ''; } catch { return ''; } };
  const saveRoute     = n => { try { localStorage.setItem(LS_KEY_ROUTE, n); } catch {} };
  const resetRouteAndCache = () => {
    try {
      localStorage.removeItem(LS_KEY_ROUTE);
      localStorage.removeItem(LS_KEY_CACHE);
    } catch {}
  };
  window.addEventListener('superhond:apiBaseChanged', () => {
    resetRouteAndCache();
    location.reload();
  });

  async function tryRoute(name, url, wrapped = false) {
    const r = await fetchWithTimeout(url);
    const txt = await r.text();
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
    const j = parseMaybeWrapped(txt, wrapped);
    const data = Array.isArray(j) ? j : j?.data ?? j;
    if (!data) throw new Error(`${name}: leeg antwoord`);
    saveRoute(name);
    return data;
  }

  async function apiGetAll() {
    const mode = 'all';
    if (!GAS_BASE) throw new Error('Geen API-URL ingesteld (zie Admin ▸ Instellingen).');
    const saved = getSavedRoute();

    const seq = (() => {
      if (saved === 'direct') return [{ n: 'direct', u: directUrl(mode) }];
      if (saved === 'jina')   return [{ n: 'jina',   u: jinaUrl(mode) }];
      if (saved === 'ao-raw') return [{ n: 'ao-raw', u: aoRawUrl(mode) }];
      if (saved === 'ao-get') return [{ n: 'ao-get', u: aoGetUrl(mode), w: true }];
      if (saved === 'proxy' && USE_PROXY_SERVER) return [{ n: 'proxy', u: proxyUrl(mode) }];
      return [
        { n: 'direct', u: directUrl(mode) },
        ...(USE_PROXY_SERVER ? [{ n: 'proxy', u: proxyUrl(mode) }] : []),
        { n: 'jina',   u: jinaUrl(mode) },
        { n: 'ao-raw', u: aoRawUrl(mode) },
        { n: 'ao-get', u: aoGetUrl(mode), w: true }
      ];
    })();

    const errors = [];
    for (const s of seq) {
      try { return await tryRoute(s.n, s.u, !!s.w); }
      catch (e) { errors.push(`${s.n}: ${e.message}`); }
    }
    throw new Error('Ophalen mislukt – ' + errors.join(' | '));
  }

  // ==== Normalisatie ====
  const G = (o, ...keys) => {
    for (const k of keys)
      if (o && o[k] != null && String(o[k]).trim() !== '') return String(o[k]);
    return '';
  };
  const toTitle = s => S(s).toLowerCase().replace(/\b([a-zà-ÿ])/g, m => m.toUpperCase());

  const normKlant = k => ({
    id:   G(k, 'id', 'ID', 'KlantID', 'klant_id', 'klantId'),
    naam: G(k, 'naam', 'Naam') ||
          [G(k, 'voornaam', 'Voornaam'), G(k, 'achternaam', 'Achternaam')]
            .filter(Boolean).join(' ').trim() || '(naam onbekend)',
    email: G(k, 'email', 'Email', 'E-mail', 'e-mail').toLowerCase(),
    telefoon: G(k, 'telefoon', 'Telefoon', 'gsm', 'GSM', 'Mobiel')
  });

  const normHond = h => ({
    id:         G(h, 'id', 'ID', 'HondID'),
    eigenaarId: G(h, 'eigenaar_id', 'eigenaarId', 'KlantID', 'klant_id', 'ownerId', 'klantId'),
    naam:       toTitle(G(h, 'naam', 'Naam', 'HondNaam'))
  });

  // ==== UI helpers ====
  function showLoader(on = true) {
    if (els.loader) els.loader.style.display = on ? '' : 'none';
    if (els.wrap)   els.wrap.style.display   = on ? 'none' : '';
  }
  function showError(msg = '') {
    if (!els.error) return;
    els.error.textContent = msg;
    els.error.style.display = msg ? '' : 'none';
  }

  // ==== Cache ====
  const readCache = () => {
    try {
      const raw = localStorage.getItem(LS_KEY_CACHE);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj?.ts || !obj?.data) return null;
      if (Date.now() - obj.ts > CACHE_TTL_MS) return null;
      return obj.data;
    } catch { return null; }
  };
  const writeCache = data => {
    try { localStorage.setItem(LS_KEY_CACHE, JSON.stringify({ ts: Date.now(), data })); } catch {}
  };

  // ==== Render & filter ====
  let ALL = { klanten: [], honden: [] };

  function render(klanten = [], honden = []) {
    if (!els.tbody) return;
    klanten = klanten.slice().sort((a, b) => S(a.naam).localeCompare(S(b.naam)));

    const map = new Map();
    honden.forEach(h => {
      if (!map.has(h.eigenaarId)) map.set(h.eigenaarId, []);
      map.get(h.eigenaarId).push(h);
    });

    els.tbody.innerHTML = klanten.length
      ? klanten.map(k => {
          const dogs = map.get(k.id) || [];
          const chips = dogs.length
            ? dogs.map(d => `<a class="chip btn btn-xs" href="../honden/detail.html?id=${encodeURIComponent(d.id)}">${d.naam}</a>`).join(' ')
            : '<span class="muted">0</span>';
          return `
            <tr data-id="${k.id}">
              <td><a href="./detail.html?id=${encodeURIComponent(k.id)}"><strong>${k.naam}</strong></a></td>
              <td>${k.email ? `<a href="mailto:${k.email}">${k.email}</a>` : '—'}</td>
              <td>${k.telefoon || '—'}</td>
              <td>${chips}</td>
              <td class="right"><button class="btn btn-xs" data-action="edit" title="Bewerken">✏️</button></td>
            </tr>`;
        }).join('')
      : '<tr><td colspan="5">Geen gegevens.</td></tr>';
  }

  function applyFilter() {
    const q = (els.zoek?.value || '').toLowerCase().trim();
    if (!q) return render(ALL.klanten, ALL.honden);
    const f = ALL.klanten.filter(k =>
      S(k.naam).toLowerCase().includes(q) ||
      S(k.email).toLowerCase().includes(q) ||
      S(k.telefoon).toLowerCase().includes(q)
    );
    render(f, ALL.honden);
  }
  let filterTimer = null;
  els.zoek?.addEventListener('input', () => {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(applyFilter, 120);
  });

  // ==== Load ====
  async function loadAll({ preferCache = true } = {}) {
    showError('');
    let usedCache = false;

    if (preferCache) {
      const c = readCache();
      if (c?.klanten && c?.honden) {
        usedCache = true;
        ALL = { klanten: c.klanten.map(normKlant), honden: c.honden.map(normHond) };
        showLoader(false);
        render(ALL.klanten, ALL.honden);
      }
    }

    try {
      if (!usedCache) showLoader(true);
      const data = await apiGetAll();
      ALL = {
        klanten: (data.klanten || []).map(normKlant),
        honden:  (data.honden  || []).map(normHond)
      };
      writeCache({ klanten: ALL.klanten, honden: ALL.honden });
      render(ALL.klanten, ALL.honden);
      showLoader(false);
    } catch (e) {
      console.error('[klanten] loadAll fout:', e);
      showLoader(false);
      const msg = e?.name === 'AbortError'
        ? 'Timeout bij ophalen (netwerk?)'
        : (e.message || 'Laden mislukt');
      showError(msg);
    }
  }

  // ==== Save (POST saveKlant) ====
  const emailLike = s => /\S+@\S+\.\S+/.test(String(s || ''));
  const nameFromEmail = mail =>
    (String(mail || '').split('@')[0] || '').replace(/[._-]+/g, ' ').trim();

  const fullName = () =>
    [sv(fld('fld-voornaam')), sv(fld('fld-achternaam'))]
      .filter(Boolean).join(' ').trim() ||
    nameFromEmail(sv(fld('fld-email')));

  const composeAdres = () => {
    const p1 = [sv(fld('fld-straat')), [sv(fld('fld-huisnr')), sv(fld('fld-bus'))].filter(Boolean).join('')].filter(Boolean).join(' ');
    const p2 = [sv(fld('fld-postcode')), sv(fld('fld-gemeente'))].filter(Boolean).join(' ');
    return [p1, p2].filter(Boolean).join(', ');
  };

  async function apiPostSaveKlant(payload) {
    if (!GAS_BASE) throw new Error('Geen API URL ingesteld.');
    const r = await fetchWithTimeout(
      `${GAS_BASE}?mode=saveKlant&t=${Date.now()}`,
      { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload || {}) },
      15000
    );
    const txt = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = parseMaybeWrapped(txt, false);
    if (j?.ok !== true) throw new Error(j?.error || 'Onbekende API-fout');
    return j.data;
  }

  async function onSave() {
    try {
      if (els.btnSave) els.btnSave.disabled = true;
      showError('');

      const payload = {
        id:         sv(fld('fld-id')),
        naam:       fullName(),
        email:      sv(fld('fld-email')),
        telefoon:   sv(fld('fld-telefoon')) || '',
        adres:      composeAdres(),
        status:     'actief',
        voornaam:   sv(fld('fld-voornaam')),
        achternaam: sv(fld('fld-achternaam')),
        land:       sv(fld('fld-land')),
        straat:     sv(fld('fld-straat')),
        huisnr:     sv(fld('fld-huisnr')),
        bus:        sv(fld('fld-bus')),
        postcode:   sv(fld('fld-postcode')),
        gemeente:   sv(fld('fld-gemeente'))
      };

      if (!payload.naam) throw new Error('Voornaam of achternaam invullen (of e-mail).');
      if (payload.email && !emailLike(payload.email)) throw new Error('Geef een geldig e-mailadres.');

      await apiPostSaveKlant(payload);

      localStorage.removeItem(LS_KEY_CACHE);
      await loadAll({ preferCache: false });
      els.modal?.close?.();
    } catch (e) {
      showError('❌ Bewaren mislukt: ' + (e.message || e));
    } finally {
      if (els.btnSave) els.btnSave.disabled = false;
    }
  }

  // ==== Events ====
  els.btnNieuw?.addEventListener('click', () => { els.form?.reset(); els.modal?.showModal?.(); });
  els.btnCancel?.addEventListener('click', () => els.modal?.close?.());
  els.btnSave?.addEventListener('click', onSave);

  // ==== Start ====
  if (!GAS_BASE) {
    showLoader(false);
    showError('Geen API URL ingesteld. Open Admin ▸ Instellingen of voeg ?apiBase=… toe aan de URL.');
    return;
  }
  loadAll();
})();
