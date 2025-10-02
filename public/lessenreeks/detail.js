// /public/lessenreeks/detail.js
function getParam(k){ return new URLSearchParams(location.search).get(k); }

async function fetchJson(candidates){
  for (const url of candidates){
    try{
      const r = await fetch(url + (url.includes('?')?'':'?t=') + Date.now(), {cache:'no-store'});
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
    return db;
  }catch{ return { series:[] }; }
}

// Normaliseer willekeurige vormen naar array met reeksen
function normalizeToArray(raw){
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.reeksen)) return raw.reeksen;
  if (Array.isArray(raw.series))  return raw.series;
  if (Array.isArray(raw.items))   return raw.items;
  if (Array.isArray(raw.data))    return raw.data;
  return [];
}

function S(v){ return String(v ?? ''); }

function euro(n){
  if (n==null || isNaN(n)) return '—';
  return new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(Number(n));
}

document.addEventListener('DOMContentLoaded', async () => {
  const id = getParam('id');
  const loader = document.getElementById('loader');
  const errorBox = document.getElementById('error');
  const detail = document.getElementById('detail');

  try{
    if(!id) throw new Error('Geen id meegegeven.');

    // 1) demo JSON
    const ext = await fetchJson(['../data/lessenreeksen.json','/data/lessenreeksen.json']);
    const arrExt = normalizeToArray(ext);

    // 2) lokaal (browser)
    const db = loadDB();
    const arrLoc = normalizeToArray({series: db.series});

    // 3) samen: extern wint bij gelijke id
    const map = new Map(arrLoc.map(x => [S(x.id), x]));
    for (const x of arrExt) map.set(S(x.id), x);
    const all = Array.from(map.values());

    const reeks = all.find(r => S(r.id) === S(id));
    if (!reeks) throw new Error('Geen reeks gevonden met id '+ id);

    // ——— velden lezen met fallback-namen
    const naam   = S(reeks.naam || reeks.name || [reeks.packageName, reeks.seriesName].filter(Boolean).join(' — '));
    const type   = S(reeks.type  || '');
    const thema  = S(reeks.thema || reeks.theme || '');
    const prijs  = reeks.prijs ?? reeks.price;
    const status = (reeks.status === false || S(reeks.status).toLowerCase()==='niet actief') ? 'Niet actief' : 'Actief';

    document.getElementById('reeksTitel').textContent = naam;
    document.getElementById('naam').textContent   = naam;
    document.getElementById('type').textContent   = type || '—';
    document.getElementById('thema').textContent  = thema || '—';
    document.getElementById('aantal').textContent = (
      reeks.aantalLessen ?? reeks.aantal ?? reeks.count ??
      (Array.isArray(reeks.lessen) ? reeks.lessen.length :
       Array.isArray(reeks.lessons)? reeks.lessons.length : '—')
    );
    document.getElementById('prijs').textContent  = (prijs==null ? '—' : euro(prijs));
    document.getElementById('status').textContent = status;

    // lessen tonen (ondersteun verschillende veldnamen)
    const ul = document.getElementById('lessenLijst');
    const lessen = Array.isArray(reeks.lessen) ? reeks.lessen
                 : Array.isArray(reeks.lessons)? reeks.lessons
                 : [];
    if (!lessen.length){
      ul.innerHTML = '<li class="muted">Geen lessen gekoppeld.</li>';
    } else {
      ul.innerHTML = lessen.map(l => {
        const datum = l.datum || l.date || (l.startISO || l.start || '').slice(0,10) || '—';
        const start = l.start || l.starttijd || (l.startISO ? l.startISO.slice(11,16) : '');
        const eind  = l.eind || l.eindtijd  || (l.endISO   ? l.endISO.slice(11,16)   : '');
        const loc   = l.locatie || (l.location && l.location.name) || '—';
        return `<li>${datum} — ${start}${eind?('–'+eind):''} · ${loc}</li>`;
      }).join('');
    }

    loader.style.display = 'none';
    detail.style.display = '';
  }catch(e){
    loader.style.display = 'none';
    errorBox.textContent = S(e.message || e);
    errorBox.style.display = '';
  }
});
