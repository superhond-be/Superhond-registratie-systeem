// Nieuwe Lessenreeks – kies eerst een Klas, dan prefills + generator
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  // UI refs
  const selKlas      = $('#selKlas');
  const infoStrippen = $('#infoStrippen');
  const infoGeldigheid = $('#infoGeldigheid');
  const infoType     = $('#infoType');
  const infoThema    = $('#infoThema');

  const pakNaam   = $('#pakNaam');
  const reeksNaam = $('#reeksNaam');
  const thema     = $('#thema');
  const prijs     = $('#prijs');

  const startDatum= $('#startDatum');
  const startTijd = $('#startTijd');
  const aantal    = $('#aantal');
  const duur      = $('#duur');
  const interval  = $('#interval');

  const trainers  = $('#trainers');
  const locNaam   = $('#locNaam');
  const locMaps   = $('#locMaps');

  const btnPreview= $('#btnPreview');
  const previewWrap = $('#previewWrap');
  const previewList = $('#previewList');

  // Mount topbar
  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title: 'Nieuwe lessenreeks', icon: '📦', back: './' });
    }
  });

  /* ---------------- helpers ---------------- */
  const bust = () => '?t=' + Date.now();

  async function fetchJson(tryUrls){
    for (const u of tryUrls) {
      try {
        const url = u + (u.includes('?')?'&':'?') + 't=' + Date.now();
        const r = await fetch(url, { cache:'no-store' });
        if (r.ok) return r.json();
      } catch(_) {}
    }
    return null;
  }

  function loadDB(){
    try{
      const raw = localStorage.getItem('superhond-db');
      const db  = raw ? JSON.parse(raw) : {};
      db.classes = Array.isArray(db.classes) ? db.classes : [];
      db.series  = Array.isArray(db.series)  ? db.series  : [];
      db.lessons = Array.isArray(db.lessons) ? db.lessons : [];
      return db;
    }catch{
      return { classes:[], series:[], lessons:[] };
    }
  }
  function saveDB(db){ localStorage.setItem('superhond-db', JSON.stringify(db)); }

  // ---- Klassen normaliseren en samenvoegen (extern + local) ----
  function normalizeClasses(raw){
    const arr =
      Array.isArray(raw) ? raw :
      Array.isArray(raw?.klassen) ? raw.klassen :
      Array.isArray(raw?.classes) ? raw.classes :
      Array.isArray(raw?.items)   ? raw.items :
      Array.isArray(raw?.data)    ? raw.data : [];
    return arr.map(k => ({
      id: k.id ?? k.classId ?? null,
      naam: S(k.naam || k.name || ''),
      type: S(k.type || ''),
      thema: S(k.thema || k.theme || ''),
      strippen: Number(k.strippen ?? k.aantal_strips ?? 0) || 0,
      geldigheid_weken: Number(k.geldigheid ?? k.geldigheid_weken ?? 0) || 0,
      status: S(k.status || 'actief')
    })).filter(k => k.id);
  }
  function mergeById(primary=[], secondary=[]){
    const map = new Map(secondary.map(x => [String(x.id), x])); // local eerst
    for (const p of primary) map.set(String(p.id), p);          // extern overschrijft
    return [...map.values()];
  }

  // ---- Generator helpers ----
  function addMinutesToTime(hhmm, add){
    const [h,m] = String(hhmm||'0:0').split(':').map(Number);
    const t = h*60 + m + Number(add||0);
    const hh = Math.floor(((t%1440)+1440)%1440/60);
    const mm = ((t%60)+60)%60;
    const pad=n=>String(n).padStart(2,'0');
    return `${pad(hh)}:${pad(mm)}`;
  }
  function isoFromDateTime(dateStr, timeStr){
    if (!dateStr || !timeStr) return '';
    return `${dateStr}T${timeStr}`;
  }

  function generateLessons({startDate, startTime, count, minutes, stepDays, title, location, mapsUrl, trainerList, seriesId}){
    const out = [];
    let d = new Date(startDate + 'T00:00');
    for (let i=0;i<count;i++){
      if (i>0 && stepDays>0) d.setDate(d.getDate()+stepDays);
      const dateISO = d.toISOString().slice(0,10);
      const startISO = isoFromDateTime(dateISO, startTime);
      const endTime  = addMinutesToTime(startTime, minutes);
      const endISO   = isoFromDateTime(dateISO, endTime);
      out.push({
        id: `${seriesId || 'tmp'}-les-${i+1}-${dateISO}-${startTime}`,
        seriesId: seriesId || null,
        title: title,
        startISO, endISO,
        location: { name: location || '', mapsUrl: mapsUrl || '' },
        trainers: trainerList || []
      });
    }
    return out;
  }

  function renderPreview(lessons){
    if (!lessons.length){
      previewList.innerHTML = '';
      previewWrap.open = true;
      previewList.innerHTML = `<li class="muted">Niets te tonen.</li>`;
      return;
    }
    const items = lessons.map((l,i) => {
      const d = new Date(l.startISO);
      const pad = n=>String(n).padStart(2,'0');
      const dd = `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
      const t1 = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      const e  = new Date(l.endISO);
      const t2 = `${pad(e.getHours())}:${pad(e.getMinutes())}`;
      return `<li>${i+1}. ${dd} ${t1} — ${t2} — ${S(l.title)}</li>`;
    }).join('');
    previewList.innerHTML = items;
    previewWrap.open = true;
  }

  /* ---------------- klas → prefills ---------------- */
  let KLASSEN = [];
  function fillKlasInfo(klass){
    infoStrippen.textContent   = klass ? String(klass.strippen) : '—';
    infoGeldigheid.textContent = klass ? `${klass.geldigheid_weken} weken` : '—';
    infoType.textContent       = klass ? (klass.type || '—') : '—';
    infoThema.textContent      = klass ? (klass.thema || '—') : '—';

    // Prefills voor formulier
    if (klass){
      if (!pakNaam.value)   pakNaam.value   = klass.naam || '';
      if (!thema.value)     thema.value     = klass.thema || '';
      // Reeks-naam laten de gebruiker kiezen (bv. "Maandag 18u")
    }
  }

  selKlas?.addEventListener('change', () => {
    const id = selKlas.value;
    const k = KLASSEN.find(x => String(x.id) === String(id)) || null;
    fillKlasInfo(k);
  });

  /* ---------------- INIT ---------------- */
  async function init(){
    // Load klassen: extern + local
    const [extRaw, db] = await Promise.all([
      fetchJson(['../data/klassen.json','/data/klassen.json']),
      Promise.resolve(loadDB())
    ]);

    const ext = normalizeClasses(extRaw);
    const loc = normalizeClasses({ classes: db.classes });
    KLASSEN = mergeById(ext, loc).filter(k => k.status !== 'inactief');

    // Vul select
    for (const k of KLASSEN.sort((a,b)=>S(a.naam).localeCompare(S(b.naam)))){
      const opt = document.createElement('option');
      opt.value = k.id;
      opt.textContent = `${k.naam} — ${k.type || k.thema || ''}`.replace(/\s—\s$/, '');
      selKlas.appendChild(opt);
    }
  }

  /* ---------------- PREVIEW ---------------- */
  btnPreview?.addEventListener('click', () => {
    const title = `${S(pakNaam.value)} — ${S(reeksNaam.value)}`.replace(/\s—\s$/,'');
    const lessons = generateLessons({
      startDate: S(startDatum.value),
      startTime: S(startTijd.value),
      count: Number(aantal.value||0),
      minutes: Number(duur.value||0),
      stepDays: Number(interval.value||7),
      title,
      location: S(locNaam.value),
      mapsUrl: S(locMaps.value),
      trainerList: S(trainers.value).split(',').map(s=>S(s)).filter(Boolean),
      seriesId: null
    });
    renderPreview(lessons);
  });

  /* ---------------- SUBMIT: opslaan ---------------- */
  document.getElementById('formReeks')?.addEventListener('submit', (e) => {
    e.preventDefault();

    const db = loadDB();

    // Bewaar reeks
    const id = 'reeks-' + Math.random().toString(36).slice(2,8);
    const rec = {
      id,
      packageName: S(pakNaam.value),
      seriesName:  S(reeksNaam.value),
      thema:       S(thema.value),
      prijs_excl:  Number(prijs.value||0) || 0,
      status:      'actief',
      // info uit klas (alleen referentie; klantregels zelf blijven bij de Klas)
      classRef: selKlas.value || null,
      classInfo: (() => {
        const k = KLASSEN.find(x => String(x.id) === String(selKlas.value));
        return k ? { id:k.id, naam:k.naam, strippen:k.strippen, geldigheid_weken:k.geldigheid_weken, type:k.type, thema:k.thema } : null;
      })(),
      recurrence: {
        startTime: S(startTijd.value),
        durationMin: Number(duur.value||0) || 0,
        intervalDays: Number(interval.value||7) || 7
      },
      startISO: S(startDatum.value) ? S(startDatum.value)+'T00:00' : null,
      locatie: { name:S(locNaam.value), mapsUrl:S(locMaps.value) },
      trainers: S(trainers.value).split(',').map(S).filter(Boolean)
    };

    db.series.push(rec);

    // Genereer & bewaar lessen
    const title = `${S(pakNaam.value)} — ${S(reeksNaam.value)}`.replace(/\s—\s$/,'');
    const gen = generateLessons({
      startDate: S(startDatum.value),
      startTime: S(startTijd.value),
      count: Number(aantal.value||0),
      minutes: Number(duur.value||0),
      stepDays: Number(interval.value||7),
      title,
      location: S(locNaam.value),
      mapsUrl: S(locMaps.value),
      trainerList: S(trainers.value).split(',').map(s=>S(s)).filter(Boolean),
      seriesId: id
    });
    db.lessons.push(...gen);

    saveDB(db);
    alert('Lessenreeks en lessen opgeslagen.');
    location.href = './';
  });

  document.addEventListener('DOMContentLoaded', init);
})();
