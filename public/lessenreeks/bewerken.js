// /public/lessenreeks/bewerken.js
const S = v => String(v ?? '').trim();

function mountLayout(){
  if (window.SuperhondUI?.mount) {
    SuperhondUI.mount({ title:'Reeks bewerken', icon:'📦', back:'./' });
  }
}

function getParam(k){ return new URLSearchParams(location.search).get(k); }

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

function parseTrainers(v){
  return S(v).split(',').map(s => s.trim()).filter(Boolean);
}

// ---- Datum helpers ----
function addDays(d, days){ const n = new Date(d); n.setDate(n.getDate()+Number(days||0)); return n; }
function addMinutes(d, mins){ const n = new Date(d); n.setMinutes(n.getMinutes()+Number(mins||0)); return n; }
function toISODate(date){ const d2=n=>String(n).padStart(2,'0'); return `${date.getFullYear()}-${d2(date.getMonth()+1)}-${d2(date.getDate())}`; }
function combine(dateISO, hhmm){ return new Date(`${dateISO}T${hhmm||'00:00'}`); }
function toISO(dt){ const d2=n=>String(n).padStart(2,'0'); return `${dt.getFullYear()}-${d2(dt.getMonth()+1)}-${d2(dt.getDate())}T${d2(dt.getHours())}:${d2(dt.getMinutes())}`; }

// ---- UI refs ----
const ui = {
  loader: document.getElementById('loader'),
  error:  document.getElementById('error'),
  form:   document.getElementById('formReeks'),
  btnDelete: document.getElementById('btnDelete'),
  btnCancel: document.getElementById('btnCancel'),

  seriesId:   document.getElementById('seriesId'),
  pakNaam:    document.getElementById('pakNaam'),
  reeksNaam:  document.getElementById('reeksNaam'),
  thema:      document.getElementById('thema'),
  prijs:      document.getElementById('prijs'),
  startDatum: document.getElementById('startDatum'),
  startTijd:  document.getElementById('startTijd'),
  duur:       document.getElementById('duur'),
  interval:   document.getElementById('interval'),
  trainers:   document.getElementById('trainers'),
  locNaam:    document.getElementById('locNaam'),
  locMaps:    document.getElementById('locMaps'),
  status:     document.getElementById('status'),
  regen:      document.getElementById('regenLessen'),
  aantal:     document.getElementById('aantal'),
};

// ---- Lessons generator (voor re-gen) ----
function generateLessons(seriesId, firstDateISO, startTime, durationMin, intervalDays, count, locName, locMaps, trainers){
  const out = [];
  for (let i=0; i<count; i++){
    const dISO   = toISODate(addDays(new Date(firstDateISO), i * intervalDays));
    const startD = combine(dISO, startTime);
    const endD   = addMinutes(startD, durationMin);
    out.push({
      id: `les-${Date.now()}-${i+1}`,
      seriesId,
      nummer: i+1,
      dateISO: dISO,
      startISO: toISO(startD),
      endISO: toISO(endD),
      location: { name: S(locName), mapsUrl: S(locMaps) || null },
      trainers: Array.isArray(trainers) ? trainers.slice() : parseTrainers(trainers)
    });
  }
  return out;
}

function euro(n){
  if (n==null || isNaN(n)) return '—';
  return new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(Number(n));
}

// ---- Load existing series from localStorage or demo JSON (fallback readonly) ----
async function fetchJson(urls){
  for (const u of urls){
    try{
      const r = await fetch(u + (u.includes('?')?'':'?t=') + Date.now(), {cache:'no-store'});
      if (r.ok) return r.json();
    }catch(_){}
  }
  return null;
}
function normalizeSeries(raw){
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.reeksen)) return raw.reeksen;
  if (Array.isArray(raw.series))  return raw.series;
  if (Array.isArray(raw.items))   return raw.items;
  if (Array.isArray(raw.data))    return raw.data;
  return [];
}

async function init(){
  mountLayout();

  const id = getParam('id');
  if (!id){
    ui.loader.style.display = 'none';
    ui.error.textContent = 'Geen id meegegeven.';
    ui.error.style.display = '';
    return;
  }

  // 1) haal lokale db
  const db = loadDB();
  let reeks = db.series.find(s => S(s.id) === S(id));

  // 2) als niet lokaal, probeer demo-json (read-only)
  let readonly = false;
  if (!reeks){
    const ext = await fetchJson(['../data/lessenreeksen.json','/data/lessenreeksen.json']);
    const arr = normalizeSeries(ext);
    reeks = arr.find(r => S(r.id) === S(id));
    readonly = !!reeks; // we kunnen tonen, maar niet opslaan (want staat niet in localStorage)
  }

  if (!reeks){
    ui.loader.style.display = 'none';
    ui.error.textContent = 'Reeks niet gevonden.';
    ui.error.style.display = '';
    return;
  }

  // 3) UI vullen
  ui.seriesId.value = S(reeks.id);
  // name kan "pakket — reeks" zijn → splits optioneel op " — "
  const name = S(reeks.name || reeks.naam || '');
  const parts = name.split(' — ');
  ui.pakNaam.value   = parts.length > 1 ? parts[0] : (S(reeks.packageName || '') || name);
  ui.reeksNaam.value = parts.length > 1 ? parts.slice(1).join(' — ') : S(reeks.seriesName || '');

  ui.thema.value  = S(reeks.thema || reeks.theme || '');
  ui.prijs.value  = (reeks.price ?? reeks.prijs ?? '') === '' ? '' : (reeks.price ?? reeks.prijs);
  ui.startDatum.value = S(reeks.startDate || reeks.startdatum || '');
  ui.startTijd.value  = S(reeks.startTime || reeks.starttijd || '18:00');
  ui.duur.value       = S(reeks.durationMin || reeks.lesduur_min || 60);
  ui.interval.value   = String(reeks.intervalDays || reeks.interval || 7);
  ui.trainers.value   = Array.isArray(reeks.trainers) ? reeks.trainers.join(', ') : '';
  ui.locNaam.value    = S(reeks.location?.name || reeks.locatie || '');
  ui.locMaps.value    = S(reeks.location?.mapsUrl || reeks.map_url || '');
  ui.status.value     = String(reeks.status !== false);

  // Link voor annuleren terug naar detail
  ui.btnCancel.href = `./detail.html?id=${encodeURIComponent(id)}`;

  // Readonly (als reeks alleen in demo JSON zit)
  if (readonly){
    ui.form.querySelectorAll('input,select,button').forEach(el => {
      if (el.id !== 'btnCancel') el.disabled = true;
    });
  }

  ui.loader.style.display = 'none';
  ui.form.style.display = '';
}

document.addEventListener('DOMContentLoaded', init);

// ---- Submit & Delete ----
ui.form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = ui.seriesId.value;
  const db = loadDB();

  // vind of maak
  const idx = db.series.findIndex(s => S(s.id) === S(id));
  if (idx === -1){
    alert('Deze reeks staat niet lokaal. Open eerst in "Nieuw" om lokaal op te slaan, of kopieer handmatig.');
    return;
  }

  const name = `${S(ui.pakNaam.value)} — ${S(ui.reeksNaam.value)}`;
  const trainers = parseTrainers(ui.trainers.value);
  const status = ui.status.value === 'true';

  // update series
  db.series[idx] = {
    ...db.series[idx],
    name,
    thema: S(ui.thema.value),
    price: S(ui.prijs.value) ? Number(ui.prijs.value) : null,
    startDate: S(ui.startDatum.value),
    startTime: S(ui.startTijd.value),
    durationMin: Number(ui.duur.value || 60),
    intervalDays: Number(ui.interval.value || 7),
    trainers,
    location: { name: S(ui.locNaam.value), mapsUrl: S(ui.locMaps.value) || null },
    status
  };

  // lessen opnieuw genereren (optioneel)
  if (ui.regen.checked){
    const count = Math.max(1, Number(ui.aantal.value || 1));
    // verwijder bestaande lessen van deze reeks
    db.lessons = db.lessons.filter(l => S(l.seriesId) !== S(id));
    // genereer nieuwe lessen
    const lessons = generateLessons(
      id,
      S(ui.startDatum.value),
      S(ui.startTijd.value) || '18:00',
      Number(ui.duur.value || 60),
      Number(ui.interval.value || 7),
      count,
      S(ui.locNaam.value),
      S(ui.locMaps.value),
      trainers
    );
    db.lessons.push(...lessons);
  }

  saveDB(db);
  alert('Reeks opgeslagen.');
  location.href = `./detail.html?id=${encodeURIComponent(id)}`;
});

ui.btnDelete?.addEventListener('click', () => {
  const id = ui.seriesId.value;
  if (!id) return;
  if (!confirm('Deze lessenreeks en alle gekoppelde lessen verwijderen?')) return;

  const db = loadDB();
  db.series  = db.series.filter(s => S(s.id) !== S(id));
  db.lessons = db.lessons.filter(l => S(l.seriesId) !== S(id));
  saveDB(db);

  alert('Reeks verwijderd.');
  location.href = './';
});
