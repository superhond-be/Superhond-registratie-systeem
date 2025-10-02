// /public/lessenreeks/bewerken.js
// Reeks bewerken → save; optioneel lessen her-genereren voor deze seriesId
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  // Mount
  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title:'Lessenreeks bewerken', icon:'📦', back:'./' });
    }
  });

  const els = {
    loader:     $('#loader'),
    error:      $('#error'),
    form:       $('#formReeks'),
    pakNaam:    $('#pakNaam'),
    reeksNaam:  $('#reeksNaam'),
    thema:      $('#thema'),
    prijs:      $('#prijs'),
    startDatum: $('#startDatum'),
    startTijd:  $('#startTijd'),
    aantal:     $('#aantal'),
    duur:       $('#duur'),
    interval:   $('#interval'),
    trainers:   $('#trainers'),
    locNaam:    $('#locNaam'),
    locMaps:    $('#locMaps'),
    btnSaveRegen: $('#btnSaveRegen'),
  };

  function q(k){ return new URL(location.href).searchParams.get(k); }

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
  function saveDB(db){ localStorage.setItem('superhond-db', JSON.stringify(db)); }
  function uid(prefix='id'){ return prefix + '_' + Math.random().toString(36).slice(2,9); }

  function parseTrainers(str) {
    return S(str).split(',').map(s=>s.trim()).filter(Boolean);
  }

  function dtISO(dateStr, timeStr) {
    const t = (S(timeStr) || '00:00').padEnd(5, ':00');
    return `${S(dateStr)}T${t}`;
  }
  function addDays(isoDate, days) {
    const d = new Date(isoDate);
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }
  function withDuration(startISO, minutes) {
    const s = new Date(startISO);
    const e = new Date(s.getTime() + (Number(minutes)||0) * 60000);
    const pad = n => String(n).padStart(2,'0');
    return `${e.getFullYear()}-${pad(e.getMonth()+1)}-${pad(e.getDate())}T${pad(e.getHours())}:${pad(e.getMinutes())}:00`;
  }
  function titleFor(pkg, series, idx, total) {
    return `${pkg} — ${series} (les ${idx}/${total})`;
  }
  function generateLessons(series){
    const out = [];
    let date = series.startDate;
    for (let i=1; i<=series.count; i++) {
      const id = uid('les');
      const startISO = dtISO(date, series.startTime);
      const endISO = withDuration(startISO, series.durationMin);
      out.push({
        id,
        seriesId: series.id,
        type: 'les',
        title: titleFor(series.packageName, series.seriesName, i, series.count),
        startISO,
        endISO,
        trainers: (series.trainers||[]).slice(),
        location: { name: series.locationName||'', mapsUrl: series.locationMaps||'' }
      });
      date = addDays(date, series.intervalDays);
    }
    return out;
  }

  function fillForm(s) {
    els.pakNaam.value    = s.packageName || '';
    els.reeksNaam.value  = s.seriesName  || '';
    els.thema.value      = s.theme       || '';
    els.prijs.value      = s.price ?? '';
    els.startDatum.value = s.startDate   || '';
    els.startTijd.value  = s.startTime   || '18:00';
    els.aantal.value     = s.count       || 5;
    els.duur.value       = s.durationMin || 60;
    els.interval.value   = s.intervalDays|| 7;
    els.trainers.value   = Array.isArray(s.trainers) ? s.trainers.join(', ') : (s.trainers || '');
    els.locNaam.value    = s.locationName|| '';
    els.locMaps.value    = s.locationMaps|| '';
  }

  function readFormInto(series) {
    series.packageName = S(els.pakNaam.value);
    series.seriesName  = S(els.reeksNaam.value);
    series.theme       = S(els.thema.value);
    series.price       = Number(els.prijs.value) || 0;
    series.startDate   = S(els.startDatum.value);
    series.startTime   = S(els.startTijd.value);
    series.count       = Number(els.aantal.value) || 0;
    series.durationMin = Number(els.duur.value)   || 60;
    series.intervalDays= Number(els.interval.value)|| 7;
    series.trainers    = parseTrainers(els.trainers.value);
    series.locationName= S(els.locNaam.value);
    series.locationMaps= S(els.locMaps.value);
    return series;
  }

  function requireBasic(series) {
    if (!series.packageName || !series.seriesName || !series.startDate) {
      throw new Error('Vul minimaal pakket, reeks en startdatum in.');
    }
  }

  function goDetail(id) {
    location.href = `./detail.html?id=${encodeURIComponent(id)}`;
  }

  async function init() {
    try {
      const id = q('id');
      if (!id) throw new Error('Geen id opgegeven.');

      const db = loadDB();
      const idx = db.series.findIndex(s => String(s.id) === String(id));
      if (idx === -1) throw new Error('Reeks niet gevonden.');

      const s = db.series[idx];

      fillForm(s);
      els.loader.style.display = 'none';
      els.form.style.display   = '';

      // Opslaan (zonder hergenereren)
      els.form.addEventListener('submit', (e) => {
        e.preventDefault();
        try {
          readFormInto(s);
          requireBasic(s);
          db.series[idx] = s;
          saveDB(db);
          alert('Reeks opgeslagen.');
          goDetail(s.id);
        } catch (err) {
          els.error.textContent = '⚠️ ' + (err.message || err);
          els.error.style.display = '';
        }
      });

      // Opslaan + hergenereren
      els.btnSaveRegen.addEventListener('click', () => {
        try {
          readFormInto(s);
          requireBasic(s);
          // vervang lessen van deze reeks
          db.lessons = db.lessons.filter(l => String(l.seriesId) !== String(s.id));
          const newLessons = generateLessons(s);
          db.lessons.push(...newLessons);
          db.series[idx] = s;
          saveDB(db);
          alert(`Reeks opgeslagen en ${newLessons.length} lessen opnieuw gegenereerd.`);
          goDetail(s.id);
        } catch (err) {
          els.error.textContent = '⚠️ ' + (err.message || err);
          els.error.style.display = '';
        }
      });

    } catch (e) {
      els.loader.style.display = 'none';
      els.error.style.display  = '';
      els.error.textContent    = '⚠️ ' + (e.message || e);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
