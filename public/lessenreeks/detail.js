// /lessenreeks/detail.js
// Lessenreeks detail met inline bewerken van lessen + interval verschuiven
(() => {
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const S  = v => String(v ?? '').trim();
  const D2 = ['zo','ma','di','wo','do','vr','za'];

  // --------- UI Mount (topbar) ---------
  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title:'Lessenreeks – Detail', icon:'📦', back:'./' });
    }
  });

  // --------- Storage helpers ---------
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
  function saveDB(db){ localStorage.setItem('superhond-db', JSON.stringify(db)); }

  // --------- Fetch helpers (optioneel extern) ---------
  async function fetchJson(tryUrls){
    for (const u of tryUrls){
      try{
        const url = u + (u.includes('?') ? '&' : '?') + 't=' + Date.now();
        const r = await fetch(url, { cache:'no-store' });
        if (r.ok) return r.json();
      }catch(_){}
    }
    return null;
  }

  // --------- Normalisatie series ---------
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

  // --------- Date/Time helpers ---------
  function pad2(n){ return String(n).padStart(2,'0'); }

  function fmtDOW(dateISO){
    if (!dateISO) return '—';
    const d = new Date(String(dateISO).replace(' ','T'));
    const dd = pad2(d.getDate()), mm = pad2(d.getMonth()+1), yyyy = d.getFullYear();
    return `${D2[d.getDay()]} ${dd}/${mm}/${yyyy}`;
  }

  function joinISO(dateStr, timeStr){
    // dateStr 'YYYY-MM-DD', timeStr 'HH:MM'
    if (!dateStr || !timeStr) return null;
    return `${dateStr}T${timeStr}:00`;
  }

  function addMinutes(iso, minutes){
    if (!iso) return null;
    const d = new Date(iso);
    d.setMinutes(d.getMinutes() + (Number(minutes) || 0));
    return d.toISOString();
  }

  function toDateInputValue(iso){
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }
  function toTimeInputValue(iso){
    if (!iso) return '';
    const d = new Date(iso);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function euro(n){
    if (n == null || isNaN(n)) return '—';
    return new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(Number(n));
  }

  function escapeHTML(s=''){
    return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;')
      .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }

  // --------- Tabel rendering ---------
  function rowViewHTML(l){
    const trainers = Array.isArray(l.trainers) && l.trainers.length
      ? l.trainers.map(t => `<span class="badge">${escapeHTML(String(t))}</span>`).join(' ')
      : '—';
    const startDate = fmtDOW(l.startISO);
    const startTime = l.startISO ? l.startISO.slice(11,16) : '—';
    const endTime   = l.endISO   ? l.endISO.slice(11,16)   : '—';
    return `
      <tr data-id="${escapeHTML(l.id)}" data-mode="view">
        <td>${escapeHTML(l.title || l.name || 'Les')}</td>
        <td>${startDate}</td>
        <td>${startTime}</td>
        <td>${endTime}</td>
        <td>${escapeHTML(l.location?.name || l.locatie || '—')}</td>
        <td>${trainers}</td>
        <td style="white-space:nowrap;display:flex;gap:.35rem;flex-wrap:wrap">
          <button class="btn btn-xs" data-action="shift">🔁</button>
          <button class="btn btn-xs" data-action="edit">✏️</button>
          <button class="btn btn-xs" data-action="delete">🗑</button>
        </td>
      </tr>
    `;
  }

  function rowEditHTML(l, fallbackDuurMin = 60){
    const dateVal = toDateInputValue(l.startISO);
    const startVal= toTimeInputValue(l.startISO);
    const duurVal = String(Number(l.duur_min || fallbackDuurMin));
    const endVal  = toTimeInputValue(l.endISO);
    const locName = l.location?.name || l.locatie || '';
    const locMaps = l.location?.mapsUrl || l.mapsUrl || '';
    const trStr   = Array.isArray(l.trainers) ? l.trainers.join(', ') : '';
    const title   = l.title || l.name || 'Les';
    return `
      <tr data-id="${escapeHTML(l.id)}" data-mode="edit">
        <td><input class="input" data-f="title" type="text" value="${escapeHTML(title)}" /></td>
        <td><input class="input" data-f="date"  type="date" value="${escapeHTML(dateVal)}" /></td>
        <td><input class="input" data-f="start" type="time" value="${escapeHTML(startVal)}" /></td>
        <td>
          <div style="display:flex;gap:6px;align-items:center">
            <input class="input input-nr" data-f="duur" type="number" min="5" step="5" value="${escapeHTML(duurVal)}" title="Duur (minuten)"/>
            <span class="muted">=</span>
            <input class="input" data-f="end" type="time" value="${escapeHTML(endVal)}" title="Einde (kan overschreven worden)"/>
          </div>
        </td>
        <td>
          <input class="input" data-f="locName" type="text" placeholder="Locatie" value="${escapeHTML(locName)}" />
          <input class="input" style="margin-top:4px" data-f="locMaps" type="url" placeholder="https://maps.google.com/?q=..." value="${escapeHTML(locMaps)}" />
        </td>
        <td><input class="input" data-f="trainers" type="text" placeholder="vb. Paul, Sophie" value="${escapeHTML(trStr)}" /></td>
        <td style="white-space:nowrap;display:flex;gap:.35rem;flex-wrap:wrap">
          <button class="btn btn-xs" data-action="save">✔️</button>
          <button class="btn btn-xs" data-action="cancel">✖</button>
        </td>
      </tr>
    `;
  }

  function renderLessons(seriesId, db, tbody, fallbackDuurMin){
    const lessons = (db.lessons || [])
      .filter(l => String(l.seriesId) === String(seriesId))
      .sort((a,b) => S(a.startISO).localeCompare(S(b.startISO)));

    if (!lessons.length){
      tbody.innerHTML = `<tr><td colspan="7" class="muted">Geen gekoppelde lessen.</td></tr>`;
      return;
    }
    tbody.innerHTML = lessons.map(l => rowViewHTML(l)).join('');

    // auto-wire: klik op “✏️” zet rij in edit
    // (we doen event delegation verder)
  }

  // --------- Acties per rij ---------
  function findLesson(db, id){
    return (db.lessons || []).find(l => String(l.id) === String(id));
  }

  function enterEditRow(tr, l, fallbackDuurMin){
    tr.outerHTML = rowEditHTML(l, fallbackDuurMin);
  }
  function backToViewRow(tr, l){
    tr.outerHTML = rowViewHTML(l);
  }

  function minutesBetween(startISO, endISO){
    if (!startISO || !endISO) return null;
    const a = new Date(startISO).getTime();
    const b = new Date(endISO).getTime();
    return Math.round((b-a)/60000);
  }

  function parseEditRowValues(tr, defaultDuurMin){
    const g = sel => tr.querySelector(sel);

    const title   = S(g('[data-f="title"]')?.value);
    const dateStr = S(g('[data-f="date"]')?.value);  // YYYY-MM-DD
    const start   = S(g('[data-f="start"]')?.value); // HH:MM
    const endIn   = S(g('[data-f="end"]')?.value);   // HH:MM
    let   duurMin = Number(g('[data-f="duur"]')?.value || defaultDuurMin) || defaultDuurMin;

    const locName = S(g('[data-f="locName"]')?.value);
    const locMaps = S(g('[data-f="locMaps"]')?.value);
    const trStr   = S(g('[data-f="trainers"]')?.value);
    const trainers= trStr ? trStr.split(',').map(s => S(s)).filter(Boolean) : [];

    const startISO = joinISO(dateStr, start);
    let   endISO   = endIn ? joinISO(dateStr, endIn) : null;

    // Indien eindtijd leeg/te vroeg → bereken met duur
    if (!endISO && startISO) endISO = addMinutes(startISO, duurMin);
    if (startISO && endISO && new Date(endISO) <= new Date(startISO)) {
      // als end <= start (door manuele wijziging), forceer via duur
      endISO = addMinutes(startISO, duurMin);
    }

    // Indien user manueel eindtijd koos, herleid duurMin daarop (zodat duur kolom klopt)
    const calc = minutesBetween(startISO, endISO);
    if (calc != null) duurMin = calc;

    return {
      title, startISO, endISO, duur_min: duurMin,
      location: locName || locMaps ? { name: locName, mapsUrl: locMaps || null } : null,
      trainers
    };
  }

  function addLesson(seriesId, db, tbody, fallbackDuurMin){
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(now.getDate())}`;
    const startISO = joinISO(dateStr, '09:00');
    const endISO   = addMinutes(startISO, fallbackDuurMin);

    const newLesson = {
      id: 'les-' + Date.now(),
      seriesId,
      title: 'Nieuwe les',
      startISO,
      endISO,
      duur_min: fallbackDuurMin,
      location: null,
      trainers: []
    };
    db.lessons.push(newLesson);
    saveDB(db);
    renderLessons(seriesId, db, tbody, fallbackDuurMin);
    // direct in edit zetten
    const tr = tbody.querySelector(`tr[data-id="${CSS.escape(newLesson.id)}"]`);
    if (tr) enterEditRow(tr, newLesson, fallbackDuurMin);
  }

  function shiftFrom(seriesId, db, startLessonId, days, tbody, fallbackDuurMin){
    const d = Number(days);
    if (!Number.isFinite(d) || d === 0) return;
    const list = (db.lessons || [])
      .filter(l => String(l.seriesId) === String(seriesId))
      .sort((a,b) => S(a.startISO).localeCompare(S(b.startISO)));

    // vind index van startles
    const idx = list.findIndex(l => String(l.id) === String(startLessonId));
    if (idx < 0) return;

    const msShift = d * 86400000;

    for (let i = idx; i < list.length; i++){
      const l = list[i];
      if (l.startISO) l.startISO = new Date(new Date(l.startISO).getTime() + msShift).toISOString();
      if (l.endISO)   l.endISO   = new Date(new Date(l.endISO).getTime()   + msShift).toISOString();
      // duur_min blijft identiek
    }

    saveDB(db);
    renderLessons(seriesId, db, tbody, fallbackDuurMin);
  }

  // --------- Init ---------
  async function init(){
    const params = new URLSearchParams(location.search);
    const id = params.get('id');

    const info = $('#info');
    const msg  = $('#msg');
    const body = $('#lessenBody');
    const btnAdd = $('#btnAdd');

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
        <div><strong>Lesduur (default):</strong> ${rec.lesduur_min || '—'} min</div>
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

    const fallbackDuurMin = rec.lesduur_min || 60;

    // render lessen
    renderLessons(id, db, body, fallbackDuurMin);

    // Add knop
    btnAdd?.addEventListener('click', () => addLesson(id, db, body, fallbackDuurMin));

    // Event delegation op tbody voor acties
    body.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const tr = btn.closest('tr');
      const lid = tr?.dataset.id;
      if (!lid) return;

      const mode = tr.dataset.mode || 'view';
      const l = findLesson(db, lid);
      if (!l) return;

      const action = btn.dataset.action;

      if (action === 'delete'){
        if (!confirm('Les verwijderen?')) return;
        db.lessons = db.lessons.filter(x => String(x.id) !== String(lid));
        saveDB(db);
        renderLessons(id, db, body, fallbackDuurMin);
        return;
      }

      if (action === 'edit' && mode === 'view'){
        enterEditRow(tr, l, fallbackDuurMin);
        return;
      }

      if (action === 'cancel'){
        // her-render actuele data (zonder wijzigingen)
        backToViewRow(tr, l);
        return;
      }

      if (action === 'save'){
        // lees waarden uit rij en schrijf terug naar db
        const newVals = parseEditRowValues(tr, fallbackDuurMin);
        l.title     = newVals.title || l.title || 'Les';
        l.startISO  = newVals.startISO || l.startISO;
        l.endISO    = newVals.endISO   || l.endISO;
        l.duur_min  = newVals.duur_min;
        l.location  = newVals.location;
        l.trainers  = newVals.trainers;

        saveDB(db);
        // render deze rij terug in view met geüpdatete data
        backToViewRow(tr, l);
        return;
      }

      if (action === 'shift'){
        const daysStr = prompt('Aantal dagen verschuiven (positief = vooruit, negatief = terug):', '7');
        if (daysStr == null) return; // geannuleerd
        const days = Number(daysStr);
        if (!Number.isFinite(days) || days === 0){
          alert('Geef een geldig getal (≠ 0) op.');
          return;
        }
        if (!confirm(`Alle lessen vanaf deze les met ${days > 0 ? '+' : ''}${days} dag(en) verschuiven?`)) return;
        shiftFrom(id, db, lid, days, body, fallbackDuurMin);
        return;
      }
    });

    // Auto update eindtijd bij wijziging start/duur in edit-rij
    body.addEventListener('input', (e) => {
      const tr = e.target.closest('tr[data-mode="edit"]');
      if (!tr) return;
      const date  = S(tr.querySelector('[data-f="date"]')?.value);
      const start = S(tr.querySelector('[data-f="start"]')?.value);
      const duur  = Number(S(tr.querySelector('[data-f="duur"]')?.value || '0')) || 0;
      const endEl = tr.querySelector('[data-f="end"]');

      if (date && start && duur > 0 && endEl){
        const startISO = joinISO(date, start);
        const endISO   = addMinutes(startISO, duur);
        endEl.value = toTimeInputValue(endISO);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
