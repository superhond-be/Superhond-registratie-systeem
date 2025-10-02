// /public/lessenreeks/index.js
// Lessenreeksen – icoon-acties + kolom Tijd (start — eind) + badge 'actieve lessen' (toekomst)
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
  const bust = () => '?t=' + Date.now();

  function euro(n){
    if (n == null || isNaN(n)) return '—';
    return new Intl.NumberFormat('nl-BE', { style:'currency', currency:'EUR' })
      .format(Number(n));
  }
  function escapeHTML(s=''){
    return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;')
      .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }
  function addMinutesToHHmm(hhmm='00:00', minutes=0){
    const [hStr,mStr] = String(hhmm).split(':');
    const h = Number(hStr||0), m = Number(mStr||0);
    const total = h*60 + m + Number(minutes||0);
    const day = 24*60;
    const norm = ((total % day) + day) % day;
    const hh = Math.floor(norm/60);
    const mm = norm % 60;
    const pad = n => String(n).padStart(2,'0');
    return `${pad(hh)}:${pad(mm)}`;
  }
  async function fetchJson(tryUrls) {
    for (const u of tryUrls) {
      try {
        const url = u + (u.includes('?') ? '&' : '?') + 't=' + Date.now();
        const r = await fetch(url, { cache:'no-store' });
        if (r.ok) return r.json();
      } catch(_) {}
    }
    return null;
  }
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

  // Normaliseer willekeurige vormen naar uniforme rij
  // {id, name, thema, count, price, startTime, endTime, durationMin}
  function normalizeSeries(raw) {
    if (!raw) return [];
    const arr =
      Array.isArray(raw) ? raw :
      Array.isArray(raw?.reeksen) ? raw.reeksen :
      Array.isArray(raw?.series) ? raw.series :
      Array.isArray(raw?.items) ? raw.items :
      Array.isArray(raw?.data) ? raw.data : [];

    const rows = [];
    for (const r of arr) {
      const id   = r.id ?? r.reeksId ?? r.seriesId ?? null;
      const pkg  = r.packageName ?? r.pakket ?? r.pkg ?? r.naam ?? r.name ?? '';
      const ser  = r.seriesName  ?? r.reeks   ?? r.serie ?? '';
      const name = S([pkg, ser].filter(Boolean).join(' — ')) || S(r.naam || r.name || '');
      const thema= r.theme ?? r.thema ?? '';

      const cnt  = Number(
                    r.count ?? r.aantal ?? r.lessonsCount ??
                    (Array.isArray(r.lessen) ? r.lessen.length :
                     Array.isArray(r.lessons)? r.lessons.length : 0)
                  ) || 0;
      const price= Number(r.price ?? r.prijs ?? r.prijs_excl ?? 0);

      // Recurrence/tijd
      const rec   = r.recurrence || r.herhaling || {};
      const startTime   = S(rec.startTime || r.startTime || '');
      const durationMin = Number(rec.durationMin ?? r.durationMin ?? 0) || 0;
      const endTime     = (startTime && durationMin > 0)
                            ? addMinutesToHHmm(startTime, durationMin)
                            : '';

      rows.push({ id, name, thema, count: cnt, price, startTime, endTime, durationMin });
    }
    return rows;
  }

  // Extern wint op id, anders alles samen
  function mergeById(primary = [], secondary = []) {
    const key = x => String(x.id ?? x.name ?? Math.random());
    const map = new Map(secondary.map(x => [key(x), x])); // local eerst
    for (const p of primary) map.set(key(p), p);          // extern overschrijft
    return Array.from(map.values());
  }

  // ---- Actieve lessen tellen per reeks (toekomst)
  function countActiveLessonsFor(seriesId, allLessons){
    if (!seriesId) return 0;
    const now = new Date();
    return allLessons.filter(l =>
      String(l.seriesId) === String(seriesId) &&
      l.startISO && new Date(String(l.startISO).replace(' ','T')) >= now
    ).length;
  }

  // ---------- Render ----------
  let ALL_ROWS = [];
  let ALL_LESSONS = []; // uit localStorage

  function actionsHTML(r) {
    if (!r.id) return '';
    const idEnc = encodeURIComponent(r.id);
    return `
      <div class="icon-actions">
        <a class="icon-btn" href="./detail.html?id=${idEnc}" title="Bekijken" aria-label="Bekijken">
          <i class="icon icon-view"></i>
        </a>
        <a class="icon-btn" href="./bewerken.html?id=${idEnc}" title="Bewerken" aria-label="Bewerken">
          <i class="icon icon-edit"></i>
        </a>
        <button class="icon-btn" data-action="delete" data-id="${escapeHTML(r.id)}" title="Verwijderen" aria-label="Verwijderen">
          <i class="icon icon-del"></i>
        </button>
      </div>
    `;
  }

  function rowHTML(r) {
    const tijd = (r.startTime && r.endTime) ? `${r.startTime} — ${r.endTime}` : '—';
    const actief = countActiveLessonsFor(r.id, ALL_LESSONS);

    // Badge vóór de naam
    const badge = `<span class="badge" style="margin-right:.4rem">${actief}</span>`;

    return `
      <tr data-id="${escapeHTML(r.id || '')}">
        <td>${badge}${r.id ? `<a href="./detail.html?id=${encodeURIComponent(r.id)}">${escapeHTML(r.name)}</a>` : escapeHTML(r.name)}</td>
        <td>${escapeHTML(r.thema || '—')}</td>
        <td>${tijd}</td>
        <td>${r.count || 0}</td>
        <td style="text-align:right">${(r.price || r.price === 0) ? euro(r.price) : '—'}</td>
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
      (r.name || '').toLowerCase().includes(q) ||
      (r.thema|| '').toLowerCase().includes(q)
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
  }

  // ---------- Init ----------
  async function init() {
    try {
      els.loader.style.display = '';
      els.error.style.display  = 'none';
      els.wrap.style.display   = 'none';

      // 1) extern (JSON demo)
      const ext = await fetchJson(['../data/lessenreeksen.json', '/data/lessenreeksen.json']);
      const extRows = normalizeSeries(ext);

      // 2) lokaal (localStorage)
      const db = loadDB();
      ALL_LESSONS = Array.isArray(db.lessons) ? db.lessons : [];
      const locRows = normalizeSeries({ series: db.series });

      // 3) merge + sort
      const all = mergeById(extRows, locRows)
        .sort((a,b) => String(a.name).localeCompare(String(b.name)));

      renderTable(all);
      els.loader.style.display = 'none';
      els.wrap.style.display   = '';

      els.zoek?.addEventListener('input', () => {
        renderTable(applySearch(all));
      });

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
