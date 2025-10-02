// /public/lessenreeks/detail.js
const S = v => String(v ?? '');
const id = new URLSearchParams(location.search).get('id');

function euro(n){
  if (n==null || isNaN(n)) return '—';
  return new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(Number(n));
}

async function fetchJson(candidates){
  for (const u of candidates){
    try{
      const r = await fetch(u + (u.includes('?')?'':'?t=') + Date.now(), {cache:'no-store'});
      if (r.ok) return r.json();
    }catch(_){}
  }
  return null;
}

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

// normaliseer reeksen → array
function normalizeSeries(raw){
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.reeksen)) return raw.reeksen;
  if (Array.isArray(raw.series))  return raw.series;
  if (Array.isArray(raw.items))   return raw.items;
  if (Array.isArray(raw.data))    return raw.data;
  return [];
}

// normaliseer lessenlijst voor rendering
function normalizeLessons(reeks, dbLessons){
  // 1) ingebedde lessen op de reeks
  let out = [];
  if (Array.isArray(reeks.lessen))  out = reeks.lessen.slice();
  else if (Array.isArray(reeks.lessons)) out = reeks.lessons.slice();

  // 2) + lessen uit localStorage gekoppeld via seriesId
  const sid = S(reeks.id);
  if (sid && Array.isArray(dbLessons) && dbLessons.length){
    out = out.concat(dbLessons.filter(l => S(l.seriesId) === sid));
  }
  // dedupe op id + sorteren op datum/tijd
  const seen = new Map();
  for (const l of out){
    const key = S(l.id) || (S(l.dateISO||l.datum||'') + ' ' + S(l.startISO||l.start||l.starttijd||''));
    seen.set(key, l);
  }
  return Array.from(seen.values()).sort((a,b) =>
    S(a.dateISO||a.datum||a.startISO||'').localeCompare(S(b.dateISO||b.datum||b.startISO||''))
  );
}

function fmtTimeRange(l){
  const start = S(l.start || l.starttijd || (l.startISO ? l.startISO.slice(11,16) : ''));
  const end   = S(l.eind  || l.eindtijd  || (l.endISO   ? l.endISO.slice(11,16)   : ''));
  return start && end ? `${start}–${end}` : (start || '—');
}

function fmtDate(l){
  return S(l.datum || l.date || l.dateISO || (l.startISO ? l.startISO.slice(0,10) : '—'));
}

function mountLayout(){
  if (window.SuperhondUI?.mount) {
    SuperhondUI.mount({ title:'Reeks detail', icon:'📦', back:'./' });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  mountLayout();

  const loader   = document.getElementById('loader');
  const errorBox = document.getElementById('error');
  const section  = document.getElementById('detail');

  try{
    if (!id) throw new Error('Geen id meegegeven.');

    // extern + lokaal ophalen
    const ext  = await fetchJson(['../data/lessenreeksen.json','/data/lessenreeksen.json']);
    const extArr = normalizeSeries(ext);
    const db   = loadDB();

    // extern heeft voorrang bij gelijke id; anders merge
    const map = new Map(db.series.map(x => [S(x.id), x]));
    for (const x of extArr) map.set(S(x.id), x);
    const all = Array.from(map.values());

    const reeks = all.find(r => S(r.id) === S(id));
    if (!reeks) throw new Error('Reeks niet gevonden: ' + id);

    // velden met fallbacks
    const naam   = S(reeks.naam || reeks.name || [reeks.packageName, reeks.seriesName].filter(Boolean).join(' — '));
    const type   = S(reeks.type || '');
    const thema  = S(reeks.thema || reeks.theme || '');
    const prijs  = (reeks.prijs != null) ? reeks.prijs : reeks.price;
    const status = (reeks.status === false || S(reeks.status).toLowerCase()==='niet actief') ? 'Niet actief' : 'Actief';

    const startdate = S(reeks.startDate || reeks.startdatum || reeks.start || '');
    const starttime = S(reeks.startTime || reeks.starttijd || '');
    const duur      = S(reeks.durationMin || reeks.lesduur_min || '');
    const interval  = S(reeks.intervalDays || reeks.interval || '');

    const locName = S(reeks.location?.name || reeks.locatie || '');
    const locUrl  = S(reeks.location?.mapsUrl || reeks.map_url || '');

    const trainers = Array.isArray(reeks.trainers) ? reeks.trainers
                    : Array.isArray(reeks.trainer) ? reeks.trainer : [];

    // titel + basis
    document.getElementById('reeksTitel').textContent = naam;
    document.getElementById('naam').textContent = naam || '—';
    document.getElementById('type').textContent = type || '—';
    document.getElementById('thema').textContent = thema || '—';
    document.getElementById('aantal').textContent =
      (reeks.aantalLessen ?? reeks.aantal ?? reeks.count ??
        (Array.isArray(reeks.lessen) ? reeks.lessen.length :
         Array.isArray(reeks.lessons)? reeks.lessons.length : '—'));
    document.getElementById('prijs').textContent = (prijs==null ? '—' : euro(prijs));
    document.getElementById('status').textContent = status;

    // extra info
    document.getElementById('startdate').textContent = startdate || '—';
    document.getElementById('starttime').textContent = starttime || '—';
    document.getElementById('duur').textContent      = duur || '—';
    document.getElementById('interval').textContent  = interval || '—';
    document.getElementById('locatie').innerHTML     = locUrl ? `<a href="${locUrl}" target="_blank" rel="noopener">${locName || '(kaart)'}</a>` : (locName || '—');
    document.getElementById('trainers').textContent  = trainers.length ? trainers.join(', ') : '—';

    // lessen
    const lessons = normalizeLessons(reeks, db.lessons);
    const tbody = document.getElementById('lessenBody');
    if (!lessons.length){
      tbody.innerHTML = `<tr><td colspan="5" class="muted">Geen lessen gekoppeld.</td></tr>`;
    } else {
      tbody.innerHTML = lessons.map((l, idx) => `
        <tr>
          <td>${l.nummer ?? (idx+1)}</td>
          <td>${fmtDate(l)}</td>
          <td>${fmtTimeRange(l)}</td>
          <td>${S(l.location?.name || l.locatie || '—')}</td>
          <td>${Array.isArray(l.trainers) ? l.trainers.map(S).join(', ') : '—'}</td>
        </tr>
      `).join('');
    }

    // bewerken-knop (optioneel, pas pad aan als je die pagina maakt)
    const btnEdit = document.getElementById('btnEdit');
    btnEdit.href = `./bewerken.html?id=${encodeURIComponent(id)}`;
    btnEdit.style.display = '';

    loader.style.display = 'none';
    section.style.display = '';
  }catch(e){
    loader.style.display = 'none';
    errorBox.textContent = S(e.message || e);
    errorBox.style.display = '';
  }
});
