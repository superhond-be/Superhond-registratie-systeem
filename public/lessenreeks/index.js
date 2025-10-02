<!-- Plaats NIET in HTML. Dit is de volledige JS voor /public/lessenreeks/index.js -->
<script>
/* Lessenreeksen – overzicht met koppeling naar klassen + telling toekomstige lessen */
(() => {
  const $  = s => document.querySelector(s);
  const S  = v => String(v ?? '').trim();

  const els = {
    loader: $('#loader'),
    error:  $('#error'),
    wrap:   $('#wrap'),
    tbody:  document.querySelector('#tabel tbody'),
    zoek:   $('#zoek'),
  };

  // Mount topbar/footer
  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title: 'Lessenreeksen', icon: '📦', back: '../dashboard/' });
    }
  });

  // ---------- Helpers ----------
  function bust(u){ return u + (u.includes('?')?'&':'?') + 't=' + Date.now(); }
  async function fetchJson(tryUrls){
    for (const u of tryUrls){
      try{ const r = await fetch(bust(u), { cache:'no-store' }); if (r.ok) return r.json(); }catch(_){}
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
    }catch{ return { series:[], lessons:[] }; }
  }
  function saveDB(db){ localStorage.setItem('superhond-db', JSON.stringify(db)); }

  const pad2 = n => String(n).padStart(2,'0');
  const euro = n => (n == null || isNaN(n)) ? '—' :
    new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(Number(n));
  function addMinutesToHHmm(hhmm='00:00', minutes=0){
    const [h,m] = String(hhmm).split(':').map(Number);
    const t = (h*60 + (m||0) + Number(minutes||0) + 24*60) % (24*60);
    return `${pad2(Math.floor(t/60))}:${pad2(t%60)}`;
  }
  function isFuture(startISO){
    if (!startISO) return false;
    const s = new Date(String(startISO).replace(' ','T'));
    const now = new Date();
    return s >= now;
  }

  // ---------- Normalizers ----------
  function normalizeKlassen(raw){
    if (!raw) return [];
    const arr = Array.isArray(raw.klassen) ? raw.klassen :
                Array.isArray(raw.items)   ? raw.items   :
                Array.isArray(raw.data)    ? raw.data    :
                Array.isArray(raw)         ? raw         : [];
    return arr.map(k => ({
      id:   k.id,
      naam: S(k.naam || k.name || ''),
      type: S(k.type || ''),
      thema: S(k.thema || k.theme || ''),
      strippen: Number(k.aantalStrippen ?? k.strippen ?? 0) || 0,
      geldigheid_weken: Number(k.geldigheidsduur_weken ?? k.weken ?? 0) || 0,
      prijs_excl: Number(k.prijs_excl ?? k.price ?? 0) || 0,
      status: S(k.status || 'actief')
    }));
  }

  function normalizeReeksen(raw){
    if (!raw) return [];
    const arr = Array.isArray(raw.lessenreeksen) ? raw.lessenreeksen :
                Array.isArray(raw.reeksen)       ? raw.reeksen       :
                Array.isArray(raw.items)         ? raw.items         :
                Array.isArray(raw.data)          ? raw.data          :
                Array.isArray(raw)               ? raw               : [];
    return arr.map(r => ({
      id: S(r.id ?? r.reeksId ?? r.seriesId ?? ''),
      klasId: S(r.klasId ?? r.classId ?? ''),
      naam: S(r.naam || r.name || ''),
      datum: S(r.datum || r.startDatum || ''),
      begintijd: S(r.begintijd || r.startTime || ''),
      eindtijd:  S(r.eindtijd  || r.endTime   || ''),
      thema: S(r.thema || r.theme || ''),
      maxDeelnemers: Number(r.maxDeelnemers ?? r.max ?? 0) || 0,
      locatie: (r.locatie && typeof r.locatie === 'object')
        ? { naam:S(r.locatie.naam || r.locatie.name || ''), mapsUrl:S(r.locatie.mapsUrl || '') || null }
        : { naam:S(r.locatie || r.location || ''), mapsUrl:null },
      trainers: Array.isArray(r.trainers) ? r.trainers.map(S) : [],
      status: S(r.status || 'actief')
    }));
  }

  function normalizeLessons(arr){
    if (!Array.isArray(arr)) return [];
    return arr.map(l => ({
      id: S(l.id),
      seriesId: S(l.seriesId || l.reeksId || ''),
      klasId: S(l.klasId || ''),
      titel: S(l.titel || l.title || l.name || 'Les'),
      startISO: S(l.startISO || l.start || ''),
      endISO:   S(l.endISO   || l.end   || ''),
      locatie: (l.locatie && typeof l.locatie === 'object')
        ? { naam:S(l.locatie.naam || l.locatie.name || ''), mapsUrl:S(l.locatie.mapsUrl || '') || null }
        : { naam:S(l.locatie || ''), mapsUrl:null },
      trainers: Array.isArray(l.trainers) ? l.trainers.map(S) : [],
      status: S(l.status || 'actief')
    }));
  }

  // ---------- Merge helpers ----------
  const byId = (arr, id) => arr.find(x => String(x.id) === String(id));

  // ---------- Render ----------
  let ALL_ROWS = [];

  function actionsHTML(r) {
    if (!r.id) return '';
    const idEnc = encodeURIComponent(r.id);
    return `
      <div class="icon-actions">
        <a class="icon-btn" href="./detail.html?id=${idEnc}" title="Bekijken"><i class="icon icon-view"></i></a>
        <a class="icon-btn" href="./bewerken.html?id=${idEnc}" title="Bewerken"><i class="icon icon-edit"></i></a>
        <button class="icon-btn" data-action="delete" data-id="${r.id}" title="Verwijderen"><i class="icon icon-del"></i></button>
      </div>
    `;
  }

  function rowHTML(r) {
    const tijd = (r.begintijd && r.eindtijd) ? `${r.begintijd} — ${r.eindtijd}` :
                  (r.begintijd && r.lesduur_min ? `${r.begintijd} — ${addMinutesToHHmm(r.begintijd,r.lesduur_min)}` : '—');
    const prijsTxt = (r.klas && (r.klas.prijs_excl || r.klas.prijs_excl === 0)) ? euro(r.klas.prijs_excl) : '—';

    return `
      <tr data-id="${r.id}">
        <td style="text-align:center;font-weight:700">${r.futureCount}</td>
        <td>${r.id ? `<a href="./detail.html?id=${encodeURIComponent(r.id)}">${r.naam}</a>` : r.naam}</td>
        <td>${r.thema || (r.klas?.thema || '—')}</td>
        <td>${tijd}</td>
        <td>${r.futureCount}</td>
        <td style="text-align:right">${prijsTxt}</td>
        <td>${actionsHTML(r)}</td>
      </tr>
    `;
  }

  function renderTable(rows) {
    ALL_ROWS = rows.slice();
    els.tbody.innerHTML = rows.map(rowHTML).join('');
    els.wrap.style.display = rows.length ? '' : 'none';
  }

  function applySearch(allRows) {
    const q = S(els.zoek?.value).toLowerCase();
    if (!q) return allRows;
    return allRows.filter(r =>
      (r.naam || '').toLowerCase().includes(q) ||
      (r.thema|| '').toLowerCase().includes(q) ||
      (r.klas?.naam || '').toLowerCase().includes(q)
    );
  }

  function bindActions() {
    els.tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="delete"]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      if (!id) return;

      if (!confirm('Deze lessenreeks en alle gekoppelde lessen verwijderen?')) return;

      const db = loadDB();
      db.series  = db.series.filter(s => String(s.id) !== String(id));
      db.lessons = db.lessons.filter(l => String(l.seriesId) !== String(id));
      saveDB(db);

      const newRows = ALL_ROWS.filter(r => String(r.id) !== String(id));
      renderTable(applySearch(newRows));
    });

    els.zoek?.addEventListener('input', () => {
      renderTable(applySearch(ALL_ROWS));
    });
  }

  // ---------- Init ----------
  async function init() {
    try {
      els.loader.style.display = '';
      els.error.style.display  = 'none';
      els.wrap.style.display   = 'none';

      // extern JSON (optioneel) + localStorage
      const [klasJSON, reeksJSON] = await Promise.all([
        fetchJson(['../data/klassen.json','/data/klassen.json']),
        fetchJson(['../data/lessenreeksen.json','/data/lessenreeksen.json'])
      ]);
      const KLASSEN = normalizeKlassen(klasJSON);
      const REEKSEN = normalizeReeksen(reeksJSON);

      const db = loadDB();
      const localLessons = normalizeLessons(db.lessons);

      // Verrijk reeksen met klas + teller toekomstige lessen
      const enriched = REEKSEN.map(r => {
        const klas = byId(KLASSEN, r.klasId) || null;

        // eindtijd afleiden als ontbreekt en klas.lesduur_min beschikbaar
        const lesduurMin = Number(klas?.lesduur_min ?? 0);
        const eindtijd = r.eindtijd || (r.begintijd && lesduurMin ? addMinutesToHHmm(r.begintijd, lesduurMin) : '');

        // tel toekomstige lessen in deze reeks
        const futureCount = localLessons.filter(
          l => String(l.seriesId) === String(r.id) && isFuture(l.startISO)
        ).length;

        return { ...r, klas, eindtijd, futureCount, lesduur_min: lesduurMin };
      }).sort((a,b)=>S(a.naam).localeCompare(S(b.naam)));

      renderTable(enriched);
      els.loader.style.display = 'none';
      els.wrap.style.display   = '';

      bindActions();
    } catch (e) {
      console.error(e);
      els.loader.style.display = 'none';
      els.error.style.display  = '';
      els.error.textContent    = '⚠️ Kon lessenreeksen niet laden. ' + (e.message || e);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
</script>
