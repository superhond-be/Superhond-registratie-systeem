/* v0.23.4 — Klant detail
   - Haalt data via mode=all (zelfde route/vallen terug als lijst)
   - Normaliseert ID (— → -) en trimt
   - ↻ Vernieuwen wist cache en haalt live op
*/
(() => {
  const LS_KEY_CACHE = 'superhond_cache_all';
  const TIMEOUT_MS = 10000;
  const PROXY_BASE = '/api/sheets';
  const USE_PROXY_SERVER = false; // zet true als je server/proxy actief is

  // ------- DOM -------
  const box   = document.getElementById('box');
  const dbgEl = document.getElementById('debug');
  const btnReload = document.getElementById('btn-reload');

  // ------- Helpers -------
  const stripBOM = s => String(s || '').replace(/^\uFEFF/, '').trim();
  const isHTML   = t => /^\s*</.test(stripBOM(t).slice(0, 200).toLowerCase());
  const esc = s => String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  const canonId = s => String(s||'').trim()
    .replace(/[\u2013\u2014]/g,'-');   // en/em dash → hyphen

  function fetchWithTimeout(url, opts = {}, ms = TIMEOUT_MS) {
    if (typeof AbortController !== 'undefined') {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort('timeout'), ms);
      return fetch(url, { cache:'no-store', ...opts, signal: ac.signal })
        .finally(() => clearTimeout(t));
    }
    return Promise.race([
      fetch(url, { cache:'no-store', ...opts }),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')), ms))
    ]);
  }

  const query     = (mode, p={}) => new URLSearchParams({ mode, t: Date.now(), ...p }).toString();
  const directUrl = (base, m, p) => `${base}?${query(m,p)}`;
  const aoRawUrl  = (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`;
  const aoGetUrl  = (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`;
  const jinaUrl   = (u) => `https://r.jina.ai/http://${u.replace(/^https?:\/\//,'')}`;

  function parseMaybeWrapped(txt, wrapped = false) {
    const t = stripBOM(txt);
    if (isHTML(t)) throw new Error('HTML/login ontvangen (Web App niet publiek?)');
    if (!wrapped) return JSON.parse(t);
    const j = JSON.parse(t);
    const c = stripBOM(j.contents || '');
    if (isHTML(c)) throw new Error('Proxy HTML ontvangen');
    return JSON.parse(c);
  }

  function clearCache(){ try { localStorage.removeItem(LS_KEY_CACHE); } catch {} }

  function renderError(msg, extras=''){
    box.innerHTML = `<p class="error">Klant ${esc(msg)}</p><p><a class="btn" href="./">← Terug naar klanten</a></p>`;
    if (extras) { dbgEl.style.display='block'; dbgEl.textContent = extras; }
  }

  function mailtoHref(v){ const s = String(v||'').trim(); return s && s.includes('@') ? `mailto:${s}` : ''; }
  function telHref(v){
    let s = String(v||'').trim().replace(/[^\d+]/g,'');
    if (s.startsWith('00')) s = '+' + s.slice(2);
    return s ? `tel:${s}` : '';
  }
  const T = v => String(v ?? '').trim();

  // ------- Data ophalen (mode=all) -------
  async function getAll(){
    const apiBase = (window.SuperhondConfig?.getApiBaseSync?.() || '').trim();
    if (!apiBase) throw new Error('Geen API-URL ingesteld.');

    const direct = directUrl(apiBase, 'all');
    const seq = [
      { n:'direct', u: direct },
      ...(USE_PROXY_SERVER ? [{ n:'proxy', u: `${PROXY_BASE}?${query('all')}` }] : []),
      { n:'jina',   u: jinaUrl(direct) },
      { n:'ao-raw', u: aoRawUrl(direct) },
      { n:'ao-get', u: aoGetUrl(direct), w:true }
    ];

    const errors = [];
    for (const s of seq) {
      try {
        const r   = await fetchWithTimeout(s.u);
        const txt = await r.text();
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j   = parseMaybeWrapped(txt, !!s.w);
        const data = Array.isArray(j) ? j : (j?.data ?? j);
        if (data?.klanten) return data; // verwacht {klanten, honden?}
        // fallback: als iemand alleen klanten retourneert
        if (Array.isArray(data)) return { klanten: data, honden: [] };
      } catch (e) { errors.push(`${s.n}: ${e.message}`); }
    }
    throw new Error('Ophalen mislukt – ' + errors.join(' | '));
  }

  function renderDetail(klant, honden){
    const dogs = (honden||[])
      .filter(h => canonId(h.eigenaarId) === canonId(klant.id))
      .sort((a,b) => T(a.naam).localeCompare(T(b.naam)));

    const email = T(klant.email);
    const tel   = T(klant.telefoon);

    const emailHTML = email ? `<a href="${esc(mailtoHref(email))}">${esc(email)}</a>` : '—';
    const telHTML   = tel   ? `<a href="${esc(telHref(tel))}">${esc(tel)}</a>` : '—';

    const p1 = [T(klant.straat), [T(klant.huisnr), T(klant.bus)].filter(Boolean).join('')].filter(Boolean).join(' ');
    const p2 = [T(klant.postcode), T(klant.gemeente)].filter(Boolean).join(' ');
    const adres = [p1, p2].filter(Boolean).join(', ') || T(klant.adres) || '—';

    box.innerHTML = `
      <h2 style="margin-top:0">${esc(T(klant.naam) || [T(klant.voornaam),T(klant.achternaam)].filter(Boolean).join(' ') || '(zonder naam)')}</h2>
      <div class="grid" style="display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
        <section>
          <ul>
            <li><strong>E-mail:</strong> ${emailHTML}</li>
            <li><strong>Telefoon:</strong> ${telHTML}</li>
            <li><strong>Adres:</strong> ${esc(adres)}</li>
            <li><strong>Land:</strong> ${esc(T(klant.land) || '—')}</li>
          </ul>
        </section>
        <section>
          <h3>Honden</h3>
          ${ dogs.length
              ? `<ul>${dogs.map(h=>`<li><a href="../honden/detail.html?id=${encodeURIComponent(h.id)}">${esc(T(h.naam)||'Hond')}</a></li>`).join('')}</ul>`
              : '<p class="muted">Geen honden gekoppeld.</p>' }
        </section>
      </div>
    `;
  }

  async function init(){
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title:'Klant detail', icon:'👤', back:'./', showApiStatus:false });
    }

    // ID uit URL normaliseren
    const params = new URLSearchParams(location.search);
    const wantedIdRaw = params.get('id') || '';
    const wantedId    = canonId(wantedIdRaw);

    if (!wantedId) {
      renderError('zonder id.', '');
      return;
    }

    try {
      box.textContent = '⏳ Laden…';
      const all = await getAll(); // {klanten, honden?}
      const klanten = Array.isArray(all?.klanten) ? all.klanten : [];
      const honden  = Array.isArray(all?.honden)  ? all.honden  : [];

      const match = klanten.find(k => canonId(k.id) === wantedId);
      if (!match) {
        const ids = klanten.slice(0, 12).map(k => k.id).join(', ');
        renderError(`met id ${wantedId} niet gevonden.`, `Beschikbare IDs (eerste 12): ${ids}`);
        return;
      }
      renderDetail(match, honden);
    } catch (e) {
      renderError(`laden mislukt. ${e?.message || e}`, '');
    }
  }

  btnReload?.addEventListener('click', () => { clearCache(); location.reload(); });

  document.addEventListener('DOMContentLoaded', init);
})();
