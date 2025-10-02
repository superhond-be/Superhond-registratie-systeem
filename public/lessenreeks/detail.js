// /public/lessenreeks/detail.js
// Lessenreeks detail: info + gekoppelde lessen (CRUD) met tijden en acties
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  // dag-afkortingen NL (Date.getDay(): 0=zo .. 6=za)
  const DOW = ['zo','ma','di','wo','do','vr','za'];

  // ---------- boot ----------
  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title:'Lessenreeks – Detail', icon:'📦', back:'./' });
    }
    init();
  });

  // ---------- storage ----------
  function loadDB() {
    try {
      const raw = localStorage.getItem('superhond-db');
      const db = raw ? JSON.parse(raw) : {};
      db.series  = Array.isArray(db.series)  ? db.series  : [];
      db.lessons = Array.isArray(db.lessons) ? db.lessons : [];
      return db;
    } catch {
      return { series:[], lessons:[] };
    }
  }
  function saveDB(db) {
    localStorage.setItem('superhond-db', JSON.stringify(db));
  }

  // ---------- fetch JSON helper ----------
  async function fetchJson(tryUrls) {
    for (const u of tryUrls) {
      try {
        const url = u + (u.includes('?') ? '&' : '?') + 't=' + Date.now();
        const r = await fetch(url, { cache:'no-store' });
        if (r.ok) return r.json();
      } catch(_) {}
    }
    return null;
  }

  // ---------- normalize reeks ----------
  function normalizeSeries(raw) {
    if (!raw) return [];
    const arr =
      Array.isArray(raw)         ? raw :
      Array.isArray(raw.items)   ? raw.items :
      Array.isArray(raw.data)    ? raw.data :
      Array.isArray(raw.reeksen) ? raw.reeksen :
      Array.isArray(raw.series)  ? raw.series : [];

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
      startISO: r.startISO ?? (r.startDatum ? r.startDatum + 'T00:00' : null) ?? r.start ?? null,
      endISO:   r.endISO   ?? (r.eindDatum  ? r.eindDatum  + 'T23:59' : null) ?? r.end   ?? null,
      locatie:  r.locatie || r.location || null,
      trainers: Array.isArray(r.trainers) ? r.trainers : [],
      prijs_excl: Number(r.prijs_excl ?? r.prijs ?? r.price ?? 0),
      status: S(r.status || 'actief')
    }));
  }

  // ---------- date helpers ----------
  function pad2(n){ return String(n).padStart(2,'0'); }
  function toDate(x){ return x ? new Date(String(x).replace(' ','T')) : null; }
  function combineDateTime(dateStr, timeStr){ // "YYYY-MM-DD", "HH:mm" -> ISO "YYYY-MM-DDTHH:mm"
    if (!dateStr) return null;
    const t = (timeStr && /\d{1,2}:\d{2}/.test(timeStr)) ? timeStr : '00:00';
    return `${dateStr}T${t}`;
  }
  function addMinutes(iso, minutes){
    const d = toDate(iso);
    if (!d || !minutes) return iso;
    d.setMinutes(d.getMinutes() + Number(minutes));
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  function fmtDateHuman(iso){ // "ma 06/10/2025, 09:00 — 10:30"
    if (!iso) return '—';
    const d = toDate(iso);
    if (!d) return '—';
    const day  = DOW[d.getDay()];
    const ddmmyyyy = `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`;
    const hhmm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    return { day, ddmmyyyy, hhmm };
  }
  function fmtRange(startISO, endISO){
    const s = fmtDateHuman(startISO);
    const e = fmtDateHuman(endISO);
    if (s === '—') return '—';
    if (e === '—') return `${s.day} ${s.ddmmyyyy}, ${s.hhmm}`;
    return `${s.day} ${s.ddmmyyyy}, ${s.hhmm} — ${e.hhmm}`;
  }

  // ---------- UI helpers ----------
  function escapeHTML(s=''){
    return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;')
      .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }
  function euro(n){
    if (n == null || isNaN(n)) return '—';
    return new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(Number(n));
  }

  // ---------- render reeks info ----------
  function renderInfo(rec){
    const info = $('#info');
    info.innerHTML = `
      <div style="display:flex;align-items:center;gap:.5rem;justify-content:space-between;flex-wrap:wrap">
        <h2 style="margin:0">${escapeHTML(rec.name)}</h2>
        <div class="row" style="display:flex;gap:.5rem;flex-wrap:wrap">
          <button class="btn" id="btnAddLesson">➕ Les toevoegen</button>
          <button class="btn" id="btnReload">↻ Herladen</button>
        </div>
      </div>

      <div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-top:8px">
        <div><strong>Thema:</strong> ${escapeHTML(rec.thema || '—')}</div>
        <div><strong>Aantal strippen (pakket):</strong> ${rec.strippen || 0}</div>
        <div><strong>Geldigheidsduur:</strong> ${rec.geldigheid_weken || 0} weken</div>
        <div><strong>Max. deelnemers/les:</strong> ${rec.max_deelnemers || '—'}</div>
        <div><strong>Lesduur (default):</strong> ${rec.lesduur_min || '—'} min</div>
        <div><strong>Start:</strong> ${rec.startISO ? (fmtDateHuman(rec.startISO).day + ' ' + fmtDateHuman(rec.startISO).ddmmyyyy) : '—'}</div>
        <div><strong>Einde:</strong> ${rec.endISO ? (fmtDateHuman(rec.endISO).day   + ' ' + fmtDateHuman(rec.endISO).ddmmyyyy)   : '—'}</div>
        <div><strong>Status:</strong> ${escapeHTML(rec.status)}</div>
        <div><strong>Prijs (excl.):</strong> ${euro(rec.prijs_excl)}</div>
        <div><strong>Locatie:</strong>
          ${
            rec.locatie?.mapsUrl
              ? `<a href="${escapeHTML(rec.locatie.mapsUrl)}" target="_blank" rel="noopener">${escapeHTML(rec.locatie.name || rec.locatie.naam || 'Locatie')}</a>`
              : escapeHTML(rec.locatie?.name || rec.locatie?.naam || '—')
          }
        </div>
        <div><strong>Trainers (default):</strong>
          ${
            (rec.trainers || []).length
              ? rec.trainers.map(t => `<span class="badge">${escapeHTML(String(t))}</span>`).join(' ')
              : '—'
          }
        </div>
      </div>
    `;

    // bind knoppen
    $('#btnAddLesson')?.addEventListener('click', () => addLessonFlow(rec));
    $('#btnReload')?.addEventListener('click', () => location.reload());
  }

  // ---------- lessen (CRUD) ----------
  function getSeriesLessons(seriesId){
    const db = loadDB();
    return (db.lessons || [])
      .filter(l => String(l.seriesId) === String(seriesId))
      .sort((a,b) => S(a.startISO||'').localeCompare(S(b.startISO||'')));
  }

  function renderLessons(seriesId){
    const tbody = $('#lessenBody');
    const rows = getSeriesLessons(seriesId).map(l => {
      const when = fmtRange(l.startISO, l.endISO);
      const locName = l.location?.name || l.locatie || '—';
      const locUrl  = l.location?.mapsUrl || l.mapsUrl || '';
      const trainers = Array.isArray(l.trainers) ? l.trainers : [];
      return `
        <tr data-id="${escapeHTML(String(l.id))}">
          <td>${escapeHTML(l.title || l.name || 'Les')}</td>
          <td>${when}</td>
          <td>${locUrl ? `<a href="${escapeHTML(locUrl)}" target="_blank" rel="noopener">${escapeHTML(locName)}</a>` : escapeHTML(locName)}</td>
          <td>${trainers.length ? trainers.map(t => `<span class="badge">${escapeHTML(String(t))}</span>`).join(' ') : '—'}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-xs" data-action="view">👁️</button>
            <button class="btn btn-xs" data-action="edit">✏️</button>
            <button class="btn btn-xs" data-action="delete">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');

    // Zorg dat tabel 5e kolom bestaat (detail.html heeft die al)
    const table = $('#tabel');
    if (table && table.tHead && table.tHead.rows[0].cells.length < 5) {
      const th = document.createElement('th');
      th.textContent = 'Acties';
      table.tHead.rows[0].appendChild(th);
    }

    tbody.innerHTML = rows || `<tr><td colspan="5" class="muted">Geen gekoppelde lessen.</td></tr>`;

    // events op acties
    tbody.addEventListener('click', onRowAction(seriesId), { once:true });
  }

  function onRowAction(seriesId){
    return (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) { // rebinden voor volgende klik
        $('#lessenBody').addEventListener('click', onRowAction(seriesId), { once:true });
        return;
      }
      const tr = btn.closest('tr');
      const id = tr?.dataset?.id;
      const action = btn.dataset.action;
      if (!id) return;

      if (action === 'view') {
        // link naar bestaande les-detail indien beschikbaar
        location.href = `../lessen/detail.html?id=${encodeURIComponent(id)}`;
        return;
      }

      if (action === 'edit') {
        editLessonFlow(seriesId, id);
        return;
      }

      if (action === 'delete') {
        if (!confirm('Deze les verwijderen?')) {
          // re-bind voor volgende klik
          $('#lessenBody').addEventListener('click', onRowAction(seriesId), { once:true });
          return;
        }
        const db = loadDB();
        db.lessons = db.lessons.filter(l => String(l.id) !== String(id));
        saveDB(db);
        renderLessons(seriesId);
        return;
      }
    };
  }

  // ---------- add/edit flows (snelle prompts) ----------
  function promptNonEmpty(label, init=''){
    const v = prompt(label, init);
    return v == null ? null : S(v);
  }
  function addLessonFlow(rec){
    // velden: titel, datum, start, duur, locatie naam/url, trainers
    const defTitle = `${rec.name} – les`;
    const title = promptNonEmpty('Titel van de les', defTitle);
    if (title === null) return;

    const date = promptNonEmpty('Datum (YYYY-MM-DD)', (rec.startISO || '').slice(0,10));
    if (date === null) return;

    const startTime = promptNonEmpty('Starttijd (HH:mm)', '09:00');
    if (startTime === null) return;

    const duur = promptNonEmpty('Duur in minuten (vb. 60 of 90)', String(rec.lesduur_min || 60));
    if (duur === null) return;
    const duurMin = Number(duur) || 60;

    const locName = promptNonEmpty('Locatie-naam', rec.locatie?.name || rec.locatie?.naam || '');
    if (locName === null) return;
    const locUrl  = promptNonEmpty('Google Maps URL (optioneel)', rec.locatie?.mapsUrl || '');
    if (locUrl === null) return;

    const trainersStr = promptNonEmpty('Trainers (komma-gescheiden)', (rec.trainers || []).join(', '));
    if (trainersStr === null) return;
    const trainers = trainersStr ? trainersStr.split(',').map(s => S(s)).filter(Boolean) : [];

    const startISO = combineDateTime(date, startTime);
    const endISO = addMinutes(startISO, duurMin);

    const db = loadDB();
    const id = `les-${Date.now()}`;
    db.lessons.push({
      id,
      seriesId: String(rec.id),
      title,
      startISO,
      endISO,
      durationMin: duurMin,
      location: { name: locName, mapsUrl: locUrl || null },
      trainers
    });
    saveDB(db);
    renderLessons(rec.id);
  }

  function editLessonFlow(seriesId, lessonId){
    const db = loadDB();
    const les = db.lessons.find(l => String(l.id) === String(lessonId) && String(l.seriesId) === String(seriesId));
    if (!les) { alert('Les niet gevonden.'); return; }

    const curDate = (les.startISO || '').slice(0,10);
    const curStart = (les.startISO || '').slice(11,16);
    const curDuur  = Number(les.durationMin || 60);

    const title = promptNonEmpty('Titel van de les', les.title || 'Les');
    if (title === null) return;

    const date = promptNonEmpty('Datum (YYYY-MM-DD)', curDate);
    if (date === null) return;

    const startTime = promptNonEmpty('Starttijd (HH:mm)', curStart || '09:00');
    if (startTime === null) return;

    const duur = promptNonEmpty('Duur in minuten', String(curDuur));
    if (duur === null) return;
    const duurMin = Number(duur) || curDuur;

    const locName = promptNonEmpty('Locatie-naam', les.location?.name || les.locatie || '');
    if (locName === null) return;
    const locUrl  = promptNonEmpty('Google Maps URL (optioneel)', les.location?.mapsUrl || les.mapsUrl || '');
    if (locUrl === null) return;

    const trainersStr = promptNonEmpty('Trainers (komma-gescheiden)', Array.isArray(les.trainers) ? les.trainers.join(', ') : '');
    if (trainersStr === null) return;
    const trainers = trainersStr ? trainersStr.split(',').map(s => S(s)).filter(Boolean) : [];

    les.title    = title;
    les.startISO = combineDateTime(date, startTime);
    les.endISO   = addMinutes(les.startISO, duurMin);
    les.durationMin = duurMin;
    les.location = { name: locName, mapsUrl: S(locUrl) || null };
    les.trainers = trainers;

    saveDB(db);
    renderLessons(seriesId);
  }

  // ---------- init ----------
  async function init(){
    const msg = $('#msg');
    const params = new URLSearchParams(location.search);
    const id = params.get('id');

    if (!id) {
      msg.style.display = '';
      msg.className = 'card error';
      msg.textContent = 'Geen id meegegeven.';
      $('#info').innerHTML = '';
      $('#lessenBody').innerHTML = `<tr><td colspan="5" class="muted">—</td></tr>`;
      return;
    }

    // 1) externe reeksen + lokale reeksen
    const [ext, db] = await Promise.all([
      fetchJson(['../data/lessenreeksen.json','/data/lessenreeksen.json']),
      Promise.resolve(loadDB())
    ]);
    const all = [
      ...normalizeSeries(ext),
      ...normalizeSeries({ series: db.series })
    ];
    const rec = all.find(r => String(r.id) === String(id));

    if (!rec) {
      msg.style.display = '';
      msg.className = 'card error';
      msg.textContent = `Reeks met id ${id} niet gevonden.`;
      $('#info').innerHTML = '';
      $('#lessenBody').innerHTML = `<tr><td colspan="5" class="muted">—</td></tr>`;
      return;
    }

    msg.style.display = 'none';
    renderInfo(rec);
    renderLessons(rec.id);
  }
})();
