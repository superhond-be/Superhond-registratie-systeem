// Detail van een lessenreeks (strippenpakket)
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();
  const D2 = ['zo','ma','di','wo','do','vr','za'];

  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title:'Lessenreeks – Detail', icon:'📦', back:'./' });
    }
  });

  function bust(){ return '?t=' + Date.now(); }
  async function fetchJson(tryUrls){
    for (const u of tryUrls){
      try{
        const r = await fetch(u + (u.includes('?')?'':'?t=') + Date.now(), { cache:'no-store' });
        if (r.ok) return r.json();
      }catch(_){}
    }
    return null;
  }
  function loadDB(){
    try{
      const raw = localStorage.getItem('superhond-db');
      const db  = raw ? JSON.parse(raw) : {};
      db.series  = Array.isArray(db.series)  ? db.series  : [];
      db.lessons = Array.isArray(db.lessons) ? db.lessons : [];
      return db;
    }catch{
      return { series:[], lessons:[] };
    }
  }
  function normalizeSeries(raw){
    if (!raw) return [];
    const arr =
      Array.isArray(raw)        ? raw :
      Array.isArray(raw.items)  ? raw.items :
      Array.isArray(raw.data)   ? raw.data :
      Array.isArray(raw.reeksen)? raw.reeksen :
      Array.isArray(raw.series) ? raw.series : [];
    return arr.map(r => ({
      id: r.id ?? r.reeksId ?? r.seriesId ?? null,
      name: S([r.packageName ?? r.pakket ?? r.pkg ?? r.naam ?? r.name ?? '',
               r.seriesName  ?? r.reeks   ?? r.serie ?? '']
               .filter(Boolean).join(' — ')) || S(r.naam || r.name || ''),
      thema: r.thema ?? r.theme ?? '',
      strippen: Number(r.strippen ?? r.strips ?? r.aantal ?? r.count ?? 0) || 0,
      geldigheid_weken: Number(r.geldigheid_weken ?? r.weken ?? 0) || 0,
      max_deelnemers: Number(r.max_deelnemers ?? r.max ?? 0) || 0,
      lesduur_min: Number(r.lesduur_min ?? r.duur ?? 0) || 0,
      startISO: r.startISO ?? (r.startDatum ? r.startDatum + 'T00:00' : null) ?? r.start,
      endISO:   r.endISO   ?? (r.eindDatum  ? r.eindDatum  + 'T23:59' : null) ?? r.end,
      locatie:  r.locatie || r.location || null,
      trainers: Array.isArray(r.trainers) ? r.trainers : [],
      prijs_excl: Number(r.prijs_excl ?? r.prijs ?? r.price ?? 0),
      status: S(r.status || 'actief')
    }));
  }
  function fmtDOW(dateISO){
    if (!dateISO) return '—';
    const d = new Date(String(dateISO).replace(' ','T'));
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yyyy = d.getFullYear();
    return `${D2[d.getDay()]} ${dd}/${mm}/${yyyy}`;
  }
  function euro(n){
    if (n == null || isNaN(n)) return '—';
    return new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(Number(n));
  }
  function escapeHTML(s=''){
    return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;')
      .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }

  async function init(){
    const params = new URLSearchParams(location.search);
    const id = params.get('id');

    const info = $('#info');
    const msg  = $('#msg');
    const body = $('#lessenBody');

    // data laden
    const [ext, db] = await Promise.all([
      fetchJson(['../data/lessenreeksen.json','/data/lessenreeksen.json']),
      Promise.resolve(loadDB())
    ]);

    const all = [
      ...normalizeSeries(ext),
      ...normalizeSeries({ series: db.series })
    ];

    const rec = all.find(r => String(r.id) === String(id));

    if (!rec){
      msg.style.display = '';
      msg.className = 'card error';
      msg.textContent = `Reeks met id ${id} niet gevonden.`;
      info.innerHTML = '';
      return;
    }

    msg.style.display = 'none';

    // detailblok
    info.innerHTML = `
      <h2 style="margin-top:0">${escapeHTML(rec.name)}</h2>
      <div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px">
        <div><strong>Thema:</strong> ${escapeHTML(rec.thema || '—')}</div>
        <div><strong>Aantal strippen:</strong> ${rec.strippen || 0}</div>
        <div><strong>Geldigheidsduur:</strong> ${rec.geldigheid_weken || 0} weken</div>
        <div><strong>Max. deelnemers/les:</strong> ${rec.max_deelnemers || '—'}</div>
        <div><strong>Lesduur:</strong> ${rec.lesduur_min || '—'} min</div>
        <div><strong>Start:</strong> ${fmtDOW(rec.startISO)}</div>
        <div><strong>Einde:</strong> ${fmtDOW(rec.endISO)}</div>
        <div><strong>Status:</strong> ${escapeHTML(rec.status)}</div>
        <div><strong>Prijs (excl.):</strong> ${euro(rec.prijs_excl)}</div>
        <div><strong>Locatie:</strong>
          ${
            rec.locatie?.mapsUrl
              ? `<a href="${escapeHTML(rec.locatie.mapsUrl)}" target="_blank" rel="noopener">${escapeHTML(rec.locatie.name || rec.locatie.naam || 'Locatie')}</a>`
              : escapeHTML(rec.locatie?.name || rec.locatie?.naam || '—')
          }
        </div>
        <div><strong>Trainers:</strong>
          ${
            (rec.trainers || []).length
              ? rec.trainers.map(t => `<span class="badge">${escapeHTML(String(t))}</span>`).join(' ')
              : '—'
          }
        </div>
      </div>
    `;

    // gekoppelde lessen uit localStorage (optioneel)
    const lessons = (db.lessons || []).filter(l => String(l.seriesId) === String(id));
    body.innerHTML = lessons.length
      ? lessons.map(l => `
          <tr>
            <td>${escapeHTML(l.title || l.name || 'Les')}</td>
            <td>${fmtDOW(l.startISO || l.start)}</td>
            <td>${escapeHTML(l.location?.name || l.locatie || '—')}</td>
            <td>${
              Array.isArray(l.trainers) && l.trainers.length
                ? l.trainers.map(t => `<span class="badge">${escapeHTML(String(t))}</span>`).join(' ')
                : '—'
            }</td>
          </tr>
        `).join('')
      : `<tr><td colspan="4" class="muted">Geen gekoppelde lessen.</td></tr>`;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
