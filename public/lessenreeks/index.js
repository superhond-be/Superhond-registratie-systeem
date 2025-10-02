// /public/lessenreeks/index.js
// Lessenreeksen: laad /data/lessenreeksen.json + merge met localStorage, zoek & acties
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

  // Mount topbar/footer (optioneel; geen layout=ok)
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

  async function fetchJson(tryUrls) {
    for (const u of tryUrls) {
      try {
        const r = await fetch(u + bust(), { cache:'no-store' });
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

  // Normaliseer willekeurige vormen naar uniforme {id,name,thema,count,price}
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
      // aantal lessen: expliciet veld, of lengte embedded lessen[]
      const cnt  = Number(
                    r.count ?? r.aantal ?? r.lessonsCount ??
                    (Array.isArray(r.lessen) ? r.lessen.length :
                     Array.isArray(r.lessons)? r.lessons.length : 0)
                  ) || 0;
      const price= Number(r.price ?? r.prijs ?? r.prijs_excl ?? 0);
      rows.push({ id, name, thema, count: cnt, price });
    }
    return rows;
  }

  // Extern wint bij gelijke id, anders alles samen
  function mergeById(primary = [], secondary = []) {
    const map = new Map(secondary.map(x => [String(x.id ?? Math.random()), x]));
    for (const p of primary) map.set(String(p.id ?? Math.random()), p);
    return Array.from(map.values());
  }

  // ---------- Render ----------
  let ALL_ROWS = [];

  function rowHTML(r) {
    // Acties alleen als er een id is (anders geen detail/bewerken)
    const view = r.id ? `<a class="btn btn-xs" href="./detail.html?id=${encodeURIComponent(r.id)}">Bekijken</a>` : '';
    const edit = r.id ? `<a class="btn btn-xs" href="./bewerken.html?id=${encodeURIComponent(r.id)}">Bewerken</a>` : '';
    const del  = r.id ? `<button class="btn btn-xs" data-action="delete" data-id="${escapeHTML(r.id)}">Verwijderen</button>` : '';
    return `
      <tr data-id="${escapeHTML(r.id || '')}">
        <td>${r.id ? `<a href="./detail.html?id=${encodeURIComponent(r.id)}">${escapeHTML(r.name)}</a>` : escapeHTML(r.name)}</td>
        <td>${escapeHTML(r.thema || '—')}</td>
        <td>${r.count || 0}</td>
        <td>${(r.price || r.price === 0) ? euro(r.price) : '—'}</td>
        <td style="white-space:nowrap;display:flex;gap:.35rem;flex-wrap:wrap">${view}${edit}${del}</td>
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
    // Delete: verwijder reeks + gekoppelde lessen
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

      // UI updaten
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
      const ext = await fetchJson([
        '../data/lessenreeksen.json', // relatieve demo
        '/data/lessenreeksen.json'    // absolute fallback
      ]);
      const extRows = normalizeSeries(ext);

      // 2) lokaal (localStorage)
      const db = loadDB();
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
