// /public/lessenreeks/index.js
// Overzicht + zoeken + acties (bekijk/bewerk/verwijder) – API/JSON merge met localStorage
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

  // Mount topbar/footer via layout.js
  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title: 'Lessenreeks', icon: '📦', back: '../dashboard/' });
    }
  });

  // -------- Data helpers --------
  const bust = () => '?t=' + Date.now();

  async function fetchJson(tryUrls) {
    for (const u of tryUrls) {
      try {
        const r = await fetch(u + bust(), { cache: 'no-store' });
        if (r.ok) return r.json();
      } catch (_) {}
    }
    return null;
  }

  function loadDB() {
    try {
      const raw = localStorage.getItem('superhond-db');
      const db = raw ? JSON.parse(raw) : {};
      db.series  = Array.isArray(db.series)  ? db.series  : [];
      db.lessons = Array.isArray(db.lessons) ? db.lessons : [];
      return db;
    } catch {
      return { series:[], lessons:[] };
    }
  }
  function saveDB(db){ localStorage.setItem('superhond-db', JSON.stringify(db)); }

  // Normaliseer naar uniforme rijen {id,name,thema,count,price}
  function normalizeSeries(raw) {
    const rows = [];
    const arr =
      Array.isArray(raw) ? raw :
      Array.isArray(raw?.items) ? raw.items :
      Array.isArray(raw?.data) ? raw.data :
      Array.isArray(raw?.reeksen) ? raw.reeksen :
      Array.isArray(raw?.series) ? raw.series :
      Array.isArray(raw?.lessenreeks) ? raw.lessenreeks :
      [];

    for (const r of arr) {
      const id   = r.id ?? r.reeksId ?? r.seriesId ?? null;
      const pkg  = r.packageName ?? r.pakket ?? r.pkg ?? r.naam ?? r.name ?? '';
      const ser  = r.seriesName  ?? r.reeks   ?? r.serie ?? '';
      const name = S([pkg, ser].filter(Boolean).join(' — ')) || S(r.name || r.naam || '');
      const thema= r.theme ?? r.thema ?? '';
      const cnt  = Number(r.count ?? r.aantal ?? r.lessonsCount ?? (Array.isArray(r.lessons)?r.lessons.length:0)) || 0;
      const price= Number(r.price ?? r.prijs ?? 0);
      rows.push({ id, name, thema, count: cnt, price });
    }
    return rows;
  }

  function mergeById(primary = [], secondary = []) {
    // primary overschrijft secondary bij dezelfde id
    const map = new Map(secondary.map(x => [String(x.id ?? Math.random()), x]));
    for (const p of primary) {
      const k = String(p.id ?? Math.random());
      map.set(k, p);
    }
    return Array.from(map.values());
  }

  function euro(n) {
    if (n == null || isNaN(n)) return '—';
    return new Intl.NumberFormat('nl-BE', { style:'currency', currency:'EUR' }).format(Number(n));
  }

  function escapeHTML(s='') {
    return String(s)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }

  // -------- Render + zoeken + acties --------
  let ALL_ROWS = []; // bewaar laatste snapshot voor filter/rerender

  function rowHTML(r) {
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
    if (!rows.length) {
      els.tbody.innerHTML = '';
      els.wrap.style.display = 'none';
      return;
    }
    els.tbody.innerHTML = rows.map(rowHTML).join('');
    els.wrap.style.display = '';
  }

  function applySearch(allRows) {
    const q = S(els.zoek.value).toLowerCase();
    if (!q) return allRows;
    return allRows.filter(r =>
      (r.name || '').toLowerCase().includes(q) ||
      (r.thema|| '').toLowerCase().includes(q)
    );
  }

  function bindActions() {
    // Delete via event delegation
    els.tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="delete"]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      if (!id) return;

      if (!confirm('Deze lessenreeks en gekoppelde lessen verwijderen?')) return;

      const db = loadDB();
      db.series  = db.series.filter(s => String(s.id) !== String(id));
      db.lessons = db.lessons.filter(l => String(l.seriesId) !== String(id));
      saveDB(db);

      // haal verwijderde rij uit ALL_ROWS en rerender (met huidige zoekfilter)
      const newRows = ALL_ROWS.filter(r => String(r.id) !== String(id));
      renderTable(applySearch(newRows));
    });
  }

  // -------- Init --------
  async function init() {
    try {
      els.loader.style.display = '';
      els.error.style.display  = 'none';
      els.wrap.style.display   = 'none';

      // 1) extern (API/JSON)
      const raw = await fetchJson([
        '../api/lessenreeks', '/api/lessenreeks',
        '../data/lessenreeks.json', '/data/lessenreeks.json'
      ]);
      const extRows = normalizeSeries(raw);

      // 2) localStorage merge
      const db = loadDB();
      const locRows = normalizeSeries({ series: db.series });

      // 3) samenvoegen (extern wint), alfabetisch
      const all = mergeById(extRows, locRows)
        .sort((a,b) => String(a.name).localeCompare(String(b.name)));

      renderTable(all);
      els.loader.style.display = 'none';
      els.wrap.style.display   = '';

      els.zoek.addEventListener('input', () => {
        renderTable(applySearch(all));
      });

      bindActions();
    } catch (e) {
      console.error(e);
      els.loader.style.display = 'none';
      els.error.style.display  = '';
      els.error.textContent    = '⚠️ Kon lessenreeks niet laden. ' + (e.message || e);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
