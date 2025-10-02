// /public/lessenreeks/nieuw.js
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  // Mount topbar/footer (optioneel)
  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title: 'Nieuwe lessenreeks', icon: '📦', back: './' });
    }
  });

  // ---------- Storage ----------
  function loadDB(){
    try{
      const raw = localStorage.getItem('superhond-db');
      const db = raw ? JSON.parse(raw) : {};
      db.series  = Array.isArray(db.series)  ? db.series  : [];
      db.lessons = Array.isArray(db.lessons) ? db.lessons : [];
      return db;
    }catch{ return { series:[], lessons:[] }; }
  }
  function saveDB(db){ localStorage.setItem('superhond-db', JSON.stringify(db)); }

  // ---------- Datum/tijd helpers ----------
  function toISODate(date){ // yyyy-mm-dd
    const d2 = n => String(n).padStart(2,'0');
    return `${date.getFullYear()}-${d2(date.getMonth()+1)}-${d2(date.getDate())}`;
  }
  function combine(dateISO, timeHHMM){ // -> Date
    return new Date(`${dateISO}T${timeHHMM || '00:00'}`);
  }
  function addMinutes(d, mins){
    const n = new Date(d); n.setMinutes(n.getMinutes() + Number(mins||0)); return n;
  }
  function addDays(d, days){
    const n = new Date(d); n.setDate(n.getDate() + Number(days||0)); return n;
  }
  function toISO(dt){ // yyyy-mm-ddTHH:MM
    const d2 = n => String(n).padStart(2,'0');
    return `${dt.getFullYear()}-${d2(dt.getMonth()+1)}-${d2(dt.getDate())}T${d2(dt.getHours())}:${d2(dt.getMinutes())}`;
  }

  // ---------- Velden ----------
  const f = {
    pakNaam:   $('#pakNaam'),
    reeksNaam: $('#reeksNaam'),
    thema:     $('#thema'),
    prijs:     $('#prijs'),
    startDatum:$('#startDatum'),
    startTijd: $('#startTijd'),
    aantal:    $('#aantal'),
    duur:      $('#duur'),
    interval:  $('#interval'),
    trainers:  $('#trainers'),
    locNaam:   $('#locNaam'),
    locMaps:   $('#locMaps'),
    btnPrev:   $('#btnPreview'),
    form:      $('#formReeks'),
    prevWrap:  $('#previewWrap'),
    prevList:  $('#previewList'),
  };

  function parseTrainers(v){
    return S(v).split(',').map(s => s.trim()).filter(Boolean);
  }

  // ---------- Generator ----------
  function generateLessons(){
    const firstDateISO = f.startDatum.value;
    const startTime    = f.startTijd.value || '18:00';
    const count        = Math.max(1, Number(f.aantal.value || 1));
    const intervalDays = Number(f.interval.value || 7);
    const durationMin  = Math.max(5, Number(f.duur.value || 60));

    const lessons = [];
    for (let i=0; i<count; i++){
      const dISO   = toISODate(addDays(new Date(firstDateISO), i * intervalDays));
      const startD = combine(dISO, startTime);
      const endD   = addMinutes(startD, durationMin);

      lessons.push({
        id: `les-${Date.now()}-${i+1}`,
        seriesId: null, // ingevuld bij opslaan
        nummer: i+1,
        dateISO: dISO,
        startISO: toISO(startD),
        endISO:   toISO(endD),
        location: { name: S(f.locNaam.value), mapsUrl: S(f.locMaps.value) || null },
        trainers: parseTrainers(f.trainers.value)
      });
    }
    return lessons;
  }

  function renderPreview(lessons){
    f.prevList.innerHTML = lessons.map(l => {
      const tijd = `${l.startISO.slice(11,16)}–${l.endISO.slice(11,16)}`;
      const loc  = l.location?.name || '—';
      return `<li>Les ${l.nummer}: ${l.dateISO} · ${tijd} · ${loc}</li>`;
    }).join('');
    if (!f.prevWrap.open) f.prevWrap.open = true;
  }

  // ---------- Events ----------
  f.btnPrev.addEventListener('click', () => {
    try{
      const lessons = generateLessons();
      renderPreview(lessons);
    }catch(e){ alert('Kon preview niet maken: ' + e.message); }
  });

  f.form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Basisvalidatie
    if (!f.pakNaam.value || !f.reeksNaam.value || !f.startDatum.value){
      alert('Vul pakket-naam, reeks-naam en startdatum in.'); return;
    }

    const db = loadDB();

    // Maak reeksobject
    const seriesId = `reeks-${Date.now()}`;
    const lessons  = generateLessons().map(l => ({ ...l, seriesId }));

    const series = {
      id: seriesId,
      name: `${S(f.pakNaam.value)} — ${S(f.reeksNaam.value)}`,
      thema: S(f.thema.value),
      count: lessons.length,
      price: S(f.prijs.value) ? Number(f.prijs.value) : null,
      startDate: S(f.startDatum.value),
      startTime: S(f.startTijd.value),
      durationMin: Number(f.duur.value || 60),
      intervalDays: Number(f.interval.value || 7),
      trainers: parseTrainers(f.trainers.value),
      location: { name: S(f.locNaam.value), mapsUrl: S(f.locMaps.value) || null },
      status: true
    };

    // Schrijf naar localStorage
    db.series.push(series);
    db.lessons.push(...lessons);
    saveDB(db);

    // Kleine bevestiging + redirect naar overzicht
    alert('Lessenreeks opgeslagen.');
    location.href = './';
  });
})();
