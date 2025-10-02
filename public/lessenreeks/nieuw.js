// /public/lessenreeks/nieuw.js
// Reeks = oneindige recurrence. We bewaren enkel recurrence in db.series.
// Voor agenda/materialisatie genereren we lessen in een venster:
// - Als eindDatum is ingevuld: t/m eindDatum (inclusief).
// - Anders: komende 'horizon' weken (default 12).
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

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
    horizon:    $('#horizon'),
    trainers:   $('#trainers'),
    locNaam:    $('#locNaam'),
    locMaps:    $('#locMaps'),
    previewBtn: $('#btnPreview'),
    previewWrap:$('#previewWrap'),
    previewList:$('#previewList'),
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title: 'Nieuwe lessenreeks', icon:'📦', back:'../lessenreeks/' });
    }
  });

  // ---- Helpers ----
  const pad2 = n => String(n).padStart(2, '0');
  const dayNames2 = ['zo','ma','di','wo','do','vr','za'];

  const toISO = (dateYYYYMMDD, timeHHmm) => `${dateYYYYMMDD}T${timeHHmm}`;
  function addMinutes(iso, minutes){
    const d = new Date(iso);
    d.setMinutes(d.getMinutes() + Number(minutes || 0));
    return d.toISOString().slice(0,16);
  }
  function addDays(dateYYYYMMDD, days){
    const d = new Date(dateYYYYMMDD + 'T00:00');
    d.setDate(d.getDate() + Number(days || 0));
    return d.toISOString().slice(0,10);
  }
  function cmpDate(a, b){ return a < b ? -1 : a > b ? 1 : 0; }
  function day2letters(dateYYYYMMDD){
    const d = new Date(dateYYYYMMDD + 'T00:00');
    return dayNames2[d.getDay()];
  }
  function fmtRange(startISO, endISO){
    const s = new Date(startISO), e = new Date(endISO);
    const day = dayNames2[s.getDay()];
    const date = `${pad2(s.getDate())}/${pad2(s.getMonth()+1)}/${s.getFullYear()}`;
    const t1 = `${pad2(s.getHours())}:${pad2(s.getMinutes())}`;
    const t2 = `${pad2(e.getHours())}:${pad2(e.getMinutes())}`;
    return `${day} ${date} ${t1} — ${t2}`;
  }
  function firstNameOnly(name=''){
    const cleaned = S(name).replace(/\s+/g,' ').trim();
    return cleaned ? cleaned.split(' ')[0] : '';
  }
  const parseTrainers = v => S(v).split(',').map(s=>firstNameOnly(s)).filter(Boolean);

  // ---- DB ----
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

  // ---- Materialisatie helpers ----
  function* dateIterator(startDate, endDateExclusive, stepDays){
    let d = startDate;
    while (cmpDate(d, endDateExclusive) < 0) {
      yield d;
      d = addDays(d, stepDays);
    }
  }
  function generateWindow({ startDate, startTime, durationMin, intervalDays }, windowStart, windowEndExclusive, title, trainers, location){
    const lessons = [];
    // Startpunt alignen op de reeks-start (als windowStart vóór startDate ligt, start vanaf startDate)
    const first = cmpDate(windowStart, startDate) < 0 ? startDate : windowStart;

    // Vind de eerste datum in het interval-grid >= first
    const diffDays = Math.round((new Date(first) - new Date(startDate)) / 86400000);
    const offset   = ((diffDays % intervalDays) + intervalDays) % intervalDays;
    let firstAligned = first;
    if (offset !== 0) firstAligned = addDays(first, intervalDays - offset);

    for (const d of dateIterator(firstAligned, windowEndExclusive, intervalDays)){
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

  function collectConfig(forSave){
    const meta = {
      packageName: S(el.pakNaam.value),
      seriesName:  S(el.reeksNaam.value),
      thema:       S(el.thema.value),
      price:       Number(el.prijs.value || 0)
    };
    const recurrence = {
      startDate:   S(el.startDatum.value),
      startTime:   S(el.startTijd.value || '09:00'),
      intervalDays:Math.max(1, Number(el.interval.value || 7)),
      durationMin: Math.max(5, Number(el.duur.value || 60))
    };
    const endDateOpt = S(el.endDatum.value); // optioneel
    const horizonWk  = Math.max(1, Number(el.horizon?.value || 12));

    if (!meta.packageName || !meta.seriesName || !recurrence.startDate) {
      alert('Gelieve pakket-naam, reeks-naam en startdatum in te vullen.');
      return null;
    }

    const trainers = parseTrainers(el.trainers.value);
    const location = S(el.locNaam.value)
      ? { name: S(el.locNaam.value), mapsUrl: S(el.locMaps.value) || null }
      : null;

    const title = `${meta.packageName}${meta.seriesName ? ' — ' + meta.seriesName : ''}`;

    return { meta, recurrence, endDateOpt, horizonWk, trainers, location, title, forSave };
  }

  function renderPreview(cfg){
    // Preview: als eind-datum is opgegeven, toon t/m die datum; anders t/m (start + horizon weken)
    const windowStart = cfg.recurrence.startDate;
    const windowEndExclusive = cfg.endDateOpt
      ? addDays(cfg.endDateOpt, 1)
      : addDays(cfg.recurrence.startDate, cfg.horizonWk * 7);

    const items = generateWindow(cfg.recurrence, windowStart, windowEndExclusive, cfg.title, cfg.trainers, cfg.location)
      .map(l => `${fmtRange(l.startISO, l.endISO)} — ${cfg.title}`);

    el.previewList.innerHTML = items.map(li => `<li>${li}</li>`).join('');
    el.previewWrap.open = true;
  }

  function saveSeriesAndMaterialize(cfg){
    const db = loadDB();

    // 1) Reeks opslaan (oneindig, dus enkel recurrence)
    const id = `reeks-${cfg.meta.packageName.toLowerCase().replace(/\s+/g,'-')}-${cfg.meta.seriesName.toLowerCase().replace(/\s+/g,'-')}-${Math.random().toString(36).slice(2,6)}`;
    db.series.push({
      id,
      packageName: cfg.meta.packageName,
      seriesName:  cfg.meta.seriesName,
      thema:       cfg.meta.thema,
      price:       cfg.meta.price,
      recurrence:  { ...cfg.recurrence }, // startDate,startTime,intervalDays,durationMin
      status:      'actief'
    });

    // 2) Eerste venster materialiseren in db.lessons
    const windowStart = cfg.recurrence.startDate;
    const windowEndExclusive = cfg.endDateOpt
      ? addDays(cfg.endDateOpt, 1)
      : addDays(cfg.recurrence.startDate, cfg.horizonWk * 7);

    const lessons = generateWindow(cfg.recurrence, windowStart, windowEndExclusive, cfg.title, cfg.trainers, cfg.location)
      .map(l => ({ ...l, seriesId: id }));

    db.lessons.push(...lessons);

    saveDB(db);

    renderPreview(cfg); // optioneel laten openklappen

    alert(`Lessenreeks opgeslagen.\n${lessons.length} lessen gematerialiseerd voor het startvenster.\nDe reeks zelf blijft oneindig (recurrence).`);
    location.href = './';
  }

  // ---- Events ----
  document.addEventListener('DOMContentLoaded', () => {
    el.previewBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      const cfg = collectConfig(false);
      if (!cfg) return;
      renderPreview(cfg);
    });

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const cfg = collectConfig(true);
      if (!cfg) return;
      saveSeriesAndMaterialize(cfg);
    });
  });
})();
