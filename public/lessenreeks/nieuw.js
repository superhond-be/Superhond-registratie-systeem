// Nieuwe lessenreeks – generator + save naar localStorage
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title: 'Nieuwe lessenreeks', icon: '🧩', back: './' });
    }
  });

  const el = {
    form: $('#formReeks'),
    previewWrap: $('#previewWrap'),
    previewList: $('#previewList'),
    btnPreview:  $('#btnPreview'),
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
  };

  function loadDB() {
    try {
      const raw = localStorage.getItem('superhond-db');
      const db  = raw ? JSON.parse(raw) : {};
      db.series  = Array.isArray(db.series)  ? db.series  : [];
      db.lessons = Array.isArray(db.lessons) ? db.lessons : [];
      return db;
    } catch {
      return { series:[], lessons:[] };
    }
  }
  function saveDB(db){ localStorage.setItem('superhond-db', JSON.stringify(db)); }

  function toISO(date, time) {
    const [h, m] = String(time).split(':').map(Number);
    const d = new Date(date); d.setHours(h||0, m||0, 0, 0);
    d.setSeconds(0,0);
    return d.toISOString().slice(0,16); // yyyy-MM-ddTHH:mm
  }
  function addMinutes(iso, mins) {
    const d = new Date(iso);
    d.setMinutes(d.getMinutes() + Number(mins||0));
    return d.toISOString().slice(0,16);
  }

  function makeSeriesAndLessons() {
    const pkg   = S(el.pakNaam.value);
    const serie = S(el.reeksNaam.value);
    const name  = [pkg, serie].filter(Boolean).join(' — ');
    const thema = S(el.thema.value);
    const price = el.prijs.value ? Number(el.prijs.value) : null;

    const startDate = S(el.startDatum.value);
    const startTime = S(el.startTijd.value);
    const n   = Math.max(1, Number(el.aantal.value||1));
    const dur = Math.max(5, Number(el.duur.value||60));
    const step= Number(el.interval.value||7);

    const trainers = S(el.trainers.value).split(',').map(s=>s.trim()).filter(Boolean);
    const locName  = S(el.locNaam.value);
    const locMaps  = S(el.locMaps.value);

    const seriesId = 'reeks-' + Math.random().toString(36).slice(2,8);

    const lessons = [];
    for (let i=0;i<n;i++){
      const startISO = toISO(startDate, startTime);
      const d = new Date(startISO);
      d.setDate(d.getDate() + i*step);
      const start = d.toISOString().slice(0,16);
      const end   = addMinutes(start, dur);

      lessons.push({
        id: 'les-' + seriesId + '-' + String(i+1).padStart(2,'0'),
        seriesId,
        title: `${name} — les ${i+1}`,
        startISO: start,
        endISO: end,
        location: {
          name: locName || '',
          mapsUrl: locMaps || null
        },
        trainers
      });
    }

    const series = {
      id: seriesId,
      name,
      thema,
      count: n,
      price
    };

    return { series, lessons };
  }

  function fmt(li){
    const d2 = n => String(n).padStart(2,'0');
    const s  = new Date(li.startISO);
    const e  = new Date(li.endISO);
    const date = `${d2(s.getDate())}/${d2(s.getMonth()+1)}/${s.getFullYear()}`;
    const t1 = `${d2(s.getHours())}:${d2(s.getMinutes())}`;
    const t2 = `${d2(e.getHours())}:${d2(e.getMinutes())}`;
    return `${date} — ${t1} → ${t2} · ${li.title}`;
  }

  function renderPreview(list){
    el.previewList.innerHTML = list.map(li => `<li>${fmt(li)}</li>`).join('');
    el.previewWrap.open = true;
  }

  el.btnPreview?.addEventListener('click', () => {
    const { lessons } = makeSeriesAndLessons();
    renderPreview(lessons);
  });

  el.form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const { series, lessons } = makeSeriesAndLessons();

    const db = loadDB();
    db.series.push(series);
    db.lessons.push(...lessons);
    saveDB(db);

    alert('Reeks en lessen opgeslagen.');
    location.href = `./detail.html?id=${encodeURIComponent(series.id)}`;
  });
})();
