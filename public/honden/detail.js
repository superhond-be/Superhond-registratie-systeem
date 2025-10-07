/* v0.23.6 – Klant detail (super tolerant ID-match + live fetch)
   - Fetch via mode=all (zelfde als lijst)
   - ID-normalisatie: trim, NFKC, alle unicode dashes → -, alle spaties weg, lowercase
   - ↻ Vernieuwen wist cache van lijst (indien gebruikt) en herlaadt
*/
(() => {
  const TIMEOUT_MS = 10000;
  const PROXY_BASE = '/api/sheets';
  const USE_PROXY_SERVER = false; // true als je proxy draait

  const box   = document.getElementById('box');
  const dbgEl = document.getElementById('debug');
  const btnReload = document.getElementById('btn-reload');

  // ---- helpers ----
  const stripBOM = s => String(s || '').replace(/^\uFEFF/, '').trim();
  const isHTML   = t => /^\s*</.test(stripBOM(t).slice(0,200).toLowerCase());
  const esc = s => String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  // super-tolerante ID normalisatie
  function normId(s){
    return String(s ?? '')
      .normalize('NFKC')                          // compat. forms
      .replace(/[\u2010-\u2015\u2212]/g, '-')     // alle unicode dashes → -
      .replace(/\s+/g, '')                        // spaties weg
      .toLowerCase()
      .trim();
  }

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

  const q = (mode, p={}) => new URLSearchParams({ mode, t: Date.now(), ...p }).toString();
  const directUrl = (base, m, p) => `${base}?${q(m,p)}`;
  const aoRaw  = (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`;
  const aoGet  = (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`;
  const jina   = (u) => `https://r.jina.ai/http://${u.replace(/^https?:\/\//,'')}`;

  function parseMaybeWrapped(txt, wrapped=false){
    const t = stripBOM(txt);
    if (isHTML(t)) throw new Error('HTML/login ontvangen (Web App niet publiek?)');
    if (!wrapped) return JSON.parse(t);
    const j = JSON.parse(t);
    const c = stripBOM(j.contents || '');
    if (isHTML(c)) throw new Error('Proxy HTML ontvangen');
    return JSON.parse(c);
  }

  function renderError(msg, extra=''){
    box.innerHTML = `<p class="error">${esc(msg)}</p><p><a class="btn" href="./">← Terug naar klanten</a></p>`;
    if (extra) { dbgEl.style.display='block'; dbgEl.textContent = extra; }
  }

  // contact helpers
  const T = v => String(v ?? '').trim();
  const mailto = v => (T(v).includes('@') ? `mailto:${T(v)}` : '');
  function tel(v){
    let s = T(v).replace(/[^\d+]/g,''); if (s.startsWith('00')) s = '+'+s.slice(2);
    return s ? `tel:${s}` : '';
  }

  // ---- data ophalen via mode=all ----
  async function getAll(){
    const apiBase = (window.SuperhondConfig?.getApiBaseSync?.() || '').trim();
    if (!apiBase) throw new Error('Geen API-URL ingesteld.');

    const u = directUrl(apiBase, 'all');
    const seq = [
      {n:'direct', u},
      ...(USE_PROXY_SERVER ? [{n:'proxy', u:`${PROXY_BASE}?${q('all')}`}]:[]),
      {n:'jina',   u:jina(u)},
      {n:'ao-raw', u:aoRaw(u)},
      {n:'ao-get', u:aoGet(u), w:true}
    ];
    const errs = [];
    for (const s of seq){
      try{
        const r = await fetchWithTimeout(s.u);
        const txt = await r.text();
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = parseMaybeWrapped(txt, !!s.w);
        const data = Array.isArray(j) ? j : (j?.data ?? j);
        if (data?.klanten || Array.isArray(data)) return data;
      }catch(e){ errs.push(`${s.n}: ${e.message}`); }
    }
    throw new Error('Ophalen mislukt – '+errs.join(' | '));
  }

  function renderDetail(klant, honden){
    const dogs = (honden||[])
      .filter(h => normId(h.eigenaarId) === normId(klant.id))
      .sort((a,b)=> T(a.naam).localeCompare(T(b.naam)));

    const email = T(klant.email);
    const telNr = T(klant.telefoon);
    const p1 = [T(klant.straat), [T(klant.huisnr), T(klant.bus)].filter(Boolean).join('')].filter(Boolean).join(' ');
    const p2 = [T(klant.postcode), T(klant.gemeente)].filter(Boolean).join(' ');
    const adres = [p1,p2].filter(Boolean).join(', ') || T(klant.adres) || '—';

    box.innerHTML = `
      <h2 style="margin-top:0">${esc(T(klant.naam) || [T(klant.voornaam),T(klant.achternaam)].filter(Boolean).join(' ') || '(zonder naam)')}</h2>
      <div class="grid" style="display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
        <section>
          <ul>
            <li><strong>E-mail:</strong> ${email ? `<a href="${esc(mailto(email))}">${esc(email)}</a>` : '—'}</li>
            <li><strong>Telefoon:</strong> ${telNr ? `<a href="${esc(tel(telNr))}">${esc(telNr)}</a>` : '—'}</li>
            <li><strong>Adres:</strong> ${esc(adres)}</li>
            <li><strong>Land:</strong> ${esc(T(klant.land) || '—')}</li>
          </ul>
        </section>
        <section>
          <h3>Honden</h3>
          ${
            dogs.length
              ? `<ul>${dogs.map(h => `<li><a href="../honden/detail.html?id=${encodeURIComponent(h.id)}">${esc(T(h.naam)||'Hond')}</a></li>`).join('')}</ul>`
              : '<p class="muted">Geen honden gekoppeld.</p>'
          }
        </section>
      </div>
    `;
  }

  async function init(){
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title:'Klant detail', icon:'👤', back:'./', showApiStatus:false });
    }

    const params = new URLSearchParams(location.search);
    const wantedRaw = params.get('id') || '';
    const wanted = normId(wantedRaw);

    if (!wanted){
      renderError('Geen id opgegeven.', '');
      return;
    }

    try{
      box.textContent = '⏳ Laden…';
      const all = await getAll();            // {klanten, honden} of array
      const klanten = Array.isArray(all?.klanten) ? all.klanten : (Array.isArray(all) ? all : []);
      const honden  = Array.isArray(all?.honden)  ? all.honden  : [];

      // toon eerste 12 ids in debug zodat je meteen ziet wat we hebben
      const match = klanten.find(k => normId(k.id) === wanted);
      if (!match){
        const ids = klanten.slice(0, 12).map(x => x.id).join(', ');
        renderError(`Klant met id ${esc(wantedRaw)} niet gevonden.`, `Ontvangen IDs (eerste 12): ${ids}`);
        return;
      }
      renderDetail(match, honden);
    }catch(e){
      renderError(`Laden mislukt. ${esc(e?.message || e)}`, '');
    }
  }

  btnReload?.addEventListener('click', () => location.reload());
  document.addEventListener('DOMContentLoaded', init);
})();
