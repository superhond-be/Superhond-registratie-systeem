// nieuw.js – Lessenreeks aanmaken → slaat reeks + gegenereerde lessen op in localStorage
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  // Mount topbar/footer
  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title:'Nieuwe lessenreeks', icon:'📦', back:'./' });
    }
  });

  const f = {
    form:        $('#formReeks'),
    pakNaam:     $('#pakNaam'),
    reeksNaam:   $('#reeksNaam'),
    thema:       $('#thema'),
    prijs:       $('#prijs'),
    startDatum:  $('#startDatum'),
    startTijd:   $('#startTijd'),
    aantal:      $('#aantal'),
    duur:        $('#duur'),
    interval:    $('#interval'),
    trainers:    $('#trainers'),
    locNaam:     $('#locNaam'),
    locMaps:     $('#locMaps'),
    btnPreview:  $('#btnPreview'),
    previewWrap: $('#previewWrap'),
    previewList: $('#previewList')
  };

  // ---- Local DB helpers ----
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

  // ---- Date helpers & generator ----
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
  function parseTrainers(str) {
    return S(str).split(',').map(s=>s.trim()).filter(Boolean);
  }
  function titleFor(pkg, series, idx, total) {
    return `${pkg} — ${series} (les ${idx}/${total})`;
  }

  function readSeriesFromForm(temp=false) {
    const id = temp ? 'TEMP' : uid('reeks');
    return {
      id,
      packageName: S(f.pakNaam.value),
      seriesName:  S(f.reeksNaam.value),
      theme:       S(f.thema.value),
      price:       Number(f.prijs.value) || 0,
      startDate:   S(f.startDatum.value), // YYYY-MM-DD
      startTime:   S(f.startTijd.value),  // HH:MM
      count:       Number(f.aantal.value) || 0,
      durationMin: Number(f.duur.value)   || 60,
      intervalDays:Number(f.interval.value)|| 7,
      trainers:    parseTrainers(f.trainers.value),
      locationName:S(f.locNaam.value),
      locationMaps:S(f.locMaps.value),
      createdAt:   new Date().toISOString()
    };
  }

  function generateLessons(series) {
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
        startISO, endISO,
        trainers: (series.trainers||[]).slice(),
        location: { name: series.locationName||'', mapsUrl: series.locationMaps||'' }
      });
      date = addDays(date, series.intervalDays);
    }
    return out;
  }

  function previewFromForm() {
    const s = readSeriesFromForm(true);
    if (!s.packageName || !s.seriesName || !s.startDate) {
      alert('Vul minimaal pakket, reeks en startdatum in.');
      return;
    }
    const lessons = generateLessons(s);
    f.previewList.innerHTML = lessons.map(l =>
      `<li>${l.title} — ${l.startISO.replace('T',' ')} → ${l.endISO.replace('T',' ')}</li>`
    ).join('');
    f.previewWrap.open = true;
  }

  // ---- Events ----
  function bindEvents() {
    f.btnPreview.addEventListener('click', (e) => {
      e.preventDefault();
      previewFromForm();
    });

    f.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const s = readSeriesFromForm(false);
      if (!s.packageName || !s.seriesName || !s.startDate) {
        alert('Gelieve pakket, reeks en startdatum in te vullen.');
        return;
      }

      const db = loadDB();
      db.series.push(s);

      const lessons = generateLessons(s);
      // voeg toe (nieuwe ids → geen conflict)
      const map = new Map(db.lessons.map(x => [String(x.id), x]));
      for (const l of lessons) map.set(String(l.id), l);
      db.lessons = Array.from(map.values());

      saveDB(db);

      // naar detailpagina
      location.href = `./detail.html?id=${encodeURIComponent(s.id)}`;
    });
  }

  document.addEventListener('DOMContentLoaded', bindEvents);
})();
