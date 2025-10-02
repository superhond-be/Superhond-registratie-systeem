// /public/lessenreeks/nieuw.js
// Reeks op basis van: startDatum + startTijd + eindDatum + interval(dagen) + duur(min)
// Lessen van start t/m eind (inclusief), eindtijd = start + duur.
// Trainers (voornamen) & locatie uit input (later optioneel uit data-bestanden).

(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  // ---- DOM refs ----
  const form = $('#formReeks');
  const el = {
    pakNaam:    $('#pakNaam'),
    reeksNaam:  $('#reeksNaam'),
    thema:      $('#thema'),
    prijs:      $('#prijs'),
    startDatum: $('#startDatum'),
    startTijd:  $('#startTijd'),
    endDatum:   $('#endDatum'),
    interval:   $('#interval'),
    duur:       $('#duur'),
    trainers:   $('#trainers'),
    locNaam:    $('#locNaam'),
    locMaps:    $('#locMaps'),
    previewBtn: $('#btnPreview'),
    previewWrap:$('#previewWrap'),
    previewList:$('#previewList'),
  };

  // ---- UI mount ----
  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title: 'Nieuwe lessenreeks', icon:'📦', back:'../lessenreeks/' });
    }
  });

  // ---- Helpers ----
  const pad2 = n => String(n).padStart(2, '0');
  const bust = () => Date.now();
  const dayNames2 = ['zo','ma','di','wo','do','vr','za'];

  function toISO(dateYYYYMMDD, timeHHmm) {
    return `${dateYYYYMMDD}T${timeHHmm}`;
  }
  function addMinutes(iso, minutes) {
    const d = new Date(iso);
    d.setMinutes(d.getMinutes() + Number(minutes || 0));
    return d.toISOString().slice(0,16);
  }
  function addDays(dateYYYYMMDD, days) {
    const d = new Date(dateYYYYMMDD + 'T00:00');
    d.setDate(d.getDate() + Number(days || 0));
    return d.toISOString().slice(0,10);
  }
  function cmpDate(aYYYYMMDD, bYYYYMMDD) {
    // return -1,0,1
    if (aYYYYMMDD < bYYYYMMDD) return -1;
    if (aYYYYMMDD > bYYYYMMDD) return 1;
    return 0;
  }
  function day2letters(dateYYYYMMDD) {
    const d = new Date(dateYYYYMMDD + 'T00:00');
    return dayNames2[d.getDay()];
  }
  function fmtRange(startISO, endISO) {
    const s = new Date(startISO);
    const e = new Date(endISO);
    const day2 = dayNames2[s.getDay()];
    const date = `${pad2(s.getDate())}/${pad2(s.getMonth()+1)}/${s.getFullYear()}`;
    const t1 = `${pad2(s.getHours())}:${pad2(s.getMinutes())}`;
    const t2 = `${pad2(e.getHours())}:${pad2(e.getMinutes())}`;
    return `${day2} ${date} ${t1} — ${t2}`;
  }
  function euro(n){
    if (n == null || isNaN(n)) return '—';
    return new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(Number(n));
  }
  function firstNameOnly(name=''){
    const cleaned = S(name).replace(/\s+/g,' ').trim();
    if (!cleaned) return '';
    return cleaned.split(' ')[0];
  }
  function parseTrainersInput(v=''){
    return S(v).split(',').map(s=>firstNameOnly(s)).filter(Boolean);
  }

  // ---- DB helpers ----
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
  function saveDB(db){
    localStorage.setItem('superhond-db', JSON.stringify(db));
  }

  // ---- Generate lessons (interval-based) ----
  function* dateIterator(startDate, endDate, stepDays){
    let d = startDate;
    while (cmpDate(d, endDate) <= 0) {
      yield d;
      d = addDays(d, stepDays);
    }
  }

  function generateLessonsInterval({ startDate, endDate, startTime, intervalDays, durationMin, title, trainers, location }){
    const lessons = [];
    for (const d of dateIterator(startDate, endDate, intervalDays)){
      const startISO = toISO(d, startTime);
      const endISO   = addMinutes(startISO, durationMin);
      lessons.push({
        id: `les-${d}-${startTime}-${Math.random().toString(36).slice(2,8)}`,
        title,
        startISO,
        endISO,
        location: location?.name ? { name: location.name, mapsUrl: location.mapsUrl || null } : null,
        trainers: Array.isArray(trainers) ? trainers.slice() : []
      });
    }
    return lessons;
  }

  function buildPreviewItems(cfg){
    const items = generateLessonsInterval(cfg);
    return items.map(l => `${fmtRange(l.startISO, l.endISO)} — ${S(cfg.title)}`);
  }

  // ---- Collect form -> config ----
  function collectConfig({ forSave }){
    const pakNaam   = S(el.pakNaam.value);
    const reeksNaam = S(el.reeksNaam.value);
    const thema     = S(el.thema.value);
    const prijs     = Number(el.prijs.value || 0);

    const startDate = S(el.startDatum.value); // YYYY-MM-DD
    const startTime = S(el.startTijd.value || '09:00');
    const endDate   = S(el.endDatum.value);   // YYYY-MM-DD
    const intervalDays = Math.max(1, Number(el.interval.value || 7));
    const duur      = Math.max(5, Number(el.duur.value || 60));

    if (!pakNaam || !reeksNaam || !startDate || !endDate) {
      alert('Gelieve pakket-naam, reeks-naam, startdatum en einddatum in te vullen.');
      return null;
    }
    if (cmpDate(endDate, startDate) < 0) {
      alert('Eind-datum moet op of na de start-datum liggen.');
      return null;
    }

    // Trainers (voornamen)
    const trainers = parseTrainersInput(el.trainers.value);

    // Locatie
    const location = S(el.locNaam.value)
      ? { name: S(el.locNaam.value), mapsUrl: S(el.locMaps.value) || null }
      : null;

    // Titel voor in lesregels
    const title = `${pakNaam}${reeksNaam ? ' — ' + reeksNaam : ''}`;

    // Lessen worden bepaald door het interval: strippen = aantal gegenereerde lessen
    // (Wordt pas berekend na generate.)
    return {
      meta: { pakNaam, reeksNaam, thema, prijs },
      lessonsCfg: { startDate, endDate, startTime, intervalDays, durationMin: duur, title, trainers, location },
      forSave
    };
  }

  function renderPreview(cfg){
    const items = buildPreviewItems(cfg.lessonsCfg);
    el.previewList.innerHTML = items.map(li => `<li>${li}</li>`).join('');
    el.previewWrap.open = true;
  }

  function saveSeriesAndLessons(cfg){
    const db = loadDB();

    // Genereer lessen volgens interval
    const lessons = generateLessonsInterval(cfg.lessonsCfg);

    // strippen = aantal lessen
    const strippen = lessons.length;

    // einddatum reeks = laatste lesdatum (ISO yyyy-mm-dd)
    const lastISO = lessons.length ? lessons[lessons.length - 1].startISO : cfg.lessonsCfg.startDate + 'T' + cfg.lessonsCfg.startTime;
    const endDate = lastISO.slice(0,10);

    // Maak seriesId
    const seriesId = `reeks-${cfg.meta.pakNaam.toLowerCase().replace(/\s+/g,'-')}-${cfg.meta.reeksNaam.toLowerCase().replace(/\s+/g,'-')}-${Math.random().toString(36).slice(2,6)}`;

    // Bewaar reeks
    db.series.push({
      id: seriesId,
      packageName: cfg.meta.pakNaam,
      seriesName:  cfg.meta.reeksNaam,
      thema:       cfg.meta.thema,
      price:       cfg.meta.prijs,
      strippen,                 // aantal gegenereerde lessen
      // geldigheidWeken kan later vanuit pakket/klant ingesteld worden; hier laten we '0' staan
      geldigheidWeken: 0,
      startDate:  cfg.lessonsCfg.startDate,
      startTime:  cfg.lessonsCfg.startTime,
      endDate,                  // laatste lesdatum
      durationMin: cfg.lessonsCfg.durationMin,
      intervalDays: cfg.lessonsCfg.intervalDays, // bijv. 7
      status: 'actief'
    });

    // Bewaar lessen
    db.lessons.push(...lessons.map(l => ({ ...l, seriesId })));

    saveDB(db);

    renderPreview(cfg); // optioneel preview tonen

    alert(`Lessenreeks opgeslagen.\n${strippen} lessen om de ${cfg.lessonsCfg.intervalDays} dagen.\nVan ${cfg.lessonsCfg.startDate} t/m ${endDate}.`);

    // terug naar overzicht
    location.href = './';
  }

  // ---- Events ----
  document.addEventListener('DOMContentLoaded', () => {
    el.previewBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      const cfg = collectConfig({ forSave:false });
      if (!cfg) return;
      renderPreview(cfg);
    });

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const cfg = collectConfig({ forSave:true });
      if (!cfg) return;
      saveSeriesAndLessons(cfg);
    });
  });
})();
