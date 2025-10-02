// Superhond — Dashboard Agenda (API → fallback /data/agenda.json)
// - Tabs: Deze week / Alles / Mededelingen
// - Trainers als chips (meerdere namen mogelijk)
// - Locatie klikbaar naar Google Maps (mapsUrl of geconcateneerd adres)
// - Auto-fallback naar "Alles" als "Deze week" leeg is

(function () {
  const tabs  = document.querySelectorAll('#agenda-tabs .tab[data-tab], #agenda-tabs .tab:not([data-tab])');
  const table = document.getElementById('agenda-table');
  const tbody = table?.querySelector('tbody');
  const wrap  = document.getElementById('agenda-table-wrap');
  const elErr = document.getElementById('agenda-error');
  const elLoad= document.getElementById('agenda-loader');

  if (!table || !tbody || !wrap) {
    console.error('Agenda: ontbrekende DOM (#agenda-table / #agenda-table-wrap).');
    if (elErr) { elErr.style.display = 'block'; elErr.textContent = 'Agenda lay-out ontbreekt.'; }
    return;
  }

  let items = []; // ruwe items van API/JSON

  // ------------- helpers -------------
  const S = v => String(v ?? '');
  const toDate = d => (d ? new Date(d) : null);

  function isSameWeek(d) {
    if (!d) return false;
    const now = new Date();
    const start = new Date(now);
    const dow = (now.getDay() + 6) % 7; // 0 = maandag
    start.setDate(now.getDate() - dow);
    start.setHours(0,0,0,0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return d >= start && d < end;
  }

  function humanDateTime(iso) {
    const dt = toDate(iso);
    if (!dt || String(dt) === 'Invalid Date') return S(iso);
    // nl-BE compacte notatie
    return dt.toLocaleString('nl-BE', { dateStyle:'short', timeStyle:'short' });
  }

  function chipHtml(text) {
    return `<span class="chip" style="display:inline-flex;align-items:center;padding:.15rem .5rem;border:1px solid #e5e7eb;border-radius:999px;background:#fff">${escapeHtml(text)}</span>`;
  }

  function escapeHtml(s){
    return S(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function buildMapsUrlFromItem(it){
    if (it.mapsUrl) return it.mapsUrl;
    const parts = [it.locatieStraat, it.locatieHuisnr].filter(Boolean).join(' ');
    const city  = [it.locatiePostcode, it.locatiePlaats || it.gemeente].filter(Boolean).join(' ');
    const full  = [parts, city, it.land || 'BE'].filter(Boolean).join(', ');
    if (!full.trim()) return '';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(full)}`;
  }

  function trainersArray(val){
    if (Array.isArray(val)) return val;
    if (!val) return [];
    // string met komma's splitsen
    return S(val).split(',').map(s => s.trim()).filter(Boolean);
  }

  function rowHtml(it) {
    const when = it.eindtijd ? `${humanDateTime(it.datum)} – ${S(it.eindtijd)}` : humanDateTime(it.datum);
    const trainers = trainersArray(it.trainer);
    const maps = it.mapsUrl || buildMapsUrlFromItem(it);
    const locHtml = maps
      ? `<a href="${escapeHtml(maps)}" target="_blank" rel="noopener">${escapeHtml(it.locatie || '')}</a>`
      : escapeHtml(it.locatie || '');

    // Link naar detail (les/reeks/mededeling)
    const type = it.type || 'les';
    let url = '#';
    if (type === 'les')           url = `/lessen/detail.html?id=${encodeURIComponent(it.id)}`;
    else if (type === 'reeks')    url = `/lessenreeks/detail.html?id=${encodeURIComponent(it.id)}`;
    else if (type === 'mededeling') url = `/mededelingen/detail.html?id=${encodeURIComponent(it.id)}`;

    return `
      <tr>
        <td><a href="${url}">${escapeHtml(it.naam || '—')}</a></td>
        <td>${when}</td>
        <td>${locHtml}</td>
        <td>${trainers.length ? trainers.map(chipHtml).join(' ') : '—'}</td>
      </tr>
    `;
  }

  function setActive(tabName){
    document.querySelectorAll('#agenda-tabs .tab').forEach(btn=>{
      const isActive = btn.dataset.tab === tabName;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true':'false');
    });
  }

  function render(kind='week'){
    let list = items.slice();

    if (kind === 'week') {
      list = list.filter(x => isSameWeek(toDate(x.datum)));
    } else if (kind === 'mededelingen') {
      list = list.filter(x => (x.type || 'les') === 'mededeling');
    } // 'alles' → geen extra filter

    // sorteer op datum
    list.sort((a,b) => S(a.datum).localeCompare(S(b.datum)));

    // auto-fallback: week → alles
    if (kind === 'week' && list.length === 0) {
      setActive('alles');
      return render('alles');
    }

    tbody.innerHTML = list.length
      ? list.map(rowHtml).join('')
      : `<tr><td colspan="4"><em>Geen items</em></td></tr>`;

    elLoad.style.display = 'none';
    wrap.style.display = '';
  }

  async function fetchJson(url){
    const r = await fetch(url, { cache:'no-store' });
    if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
    return r.json();
  }

  async function loadAgenda(){
    // API → data/agenda.json (absolute) → ../data/agenda.json → ./data/agenda.json
    const bust = `?t=${Date.now()}`;
    const sources = [
      '/api/agenda',
      '/data/agenda.json',
      '../data/agenda.json',
      './data/agenda.json'
    ];
    const tried = [];
    for (const u of sources) {
      try {
        const data = await fetchJson(u + bust);
        console.log('[agenda] geladen uit:', u, 'items:', Array.isArray(data) ? data.length : 'n/a');
        return Array.isArray(data) ? data : (data.items || []); // /api kan {items:[...]} teruggeven
      } catch (e) {
        tried.push(e.message);
      }
    }
    throw new Error('Geen agenda-bron bereikbaar.\n' + tried.join('\n'));
  }

  // init
  (async () => {
    try {
      items = await loadAgenda();
      // normaliseer: datum verplicht ISO (YYYY-MM-DDTHH:mm)
      items = items
        .filter(Boolean)
        .map(x => {
          // support "datum":"YYYY-MM-DD" + "start":"HH:MM"
          if (x && x.datum && x.datum.length <= 10 && x.start) {
            return { ...x, datum: `${x.datum}T${x.start}` };
          }
          return x;
        });

      setActive('week');
      render('week');
    } catch (e) {
      console.error(e);
      elLoad.style.display = 'none';
      elErr.style.display = 'block';
      elErr.textContent = '⚠️ Kon agenda niet laden: ' + e.message;
      wrap.style.display = '';
      tbody.innerHTML = `<tr><td colspan="4"><em>Kon agenda niet laden</em></td></tr>`;
    }
  })();

  // tab events
  document.getElementById('agenda-tabs')?.addEventListener('click', (e)=>{
    const btn = e.target.closest('.tab');
    if (!btn) return;
    const tab = btn.dataset.tab || 'week';
    setActive(tab);
    render(tab);
  });
})();
