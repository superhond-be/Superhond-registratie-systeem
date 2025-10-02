// Overzicht lessenreeksen = strippenpakketten
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

  // Topbar/footer
  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title: 'Lessenreeksen', icon: '📦', back: '../dashboard/' });
    }
  });

  // ---- helpers ----
  const bust = () => ( '?t=' + Date.now() );
  function euro(n){
    if (n == null || isNaN(n)) return '—';
    return new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(Number(n));
  }
  async function fetchJson(tryUrls){
    for (const u of tryUrls){
      try{
        const r = await fetch(u + (u.includes('?')?'':'?t=') + Date.now(), { cache:'no-store' });
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
  function saveDB(db){ localStorage.setItem('superhond-db', JSON.stringify(db)); }

  // Normaliseer naar {id,name,thema,strippen,price}
  function normalizeSeries(raw){
    if (!raw) return [];
    const arr =
      Array.isArray(raw)       ? raw :
      Array.isArray(raw.items) ? raw.items :
      Array.isArray(raw.data)  ? raw.data :
      Array.isArray(raw.reeksen)? raw.reeksen :
      Array.isArray(raw.series)? raw.series : [];

    return arr.map(r => {
      const id    = r.id ?? r.reeksId ?? r.seriesId ?? null;
      const pkg   = r.packageName ?? r.pakket ?? r.pkg ?? r.naam ?? r.name ?? '';
      const ser   = r.seriesName  ?? r.reeks   ?? r.serie ?? '';
      const name  = S([pkg, ser].filter(Boolean).join(' — ')) || S(r.naam || r.name || '');
      const thema = r.thema ?? r.theme ?? '';
      const strippen = Number(
        r.strippen ?? r.strips ?? r.aantal ?? r.count ?? 0
      ) || 0;
      const price = Number(r.prijs_excl ?? r.prijs ?? r.price ?? 0);
      return { id, name, thema, strippen, price };
    });
  }

  function mergeById(primary=[], secondary=[]){
    const map = new Map(secondary.map(x => [String(x.id ?? Math.random()), x]));
    for (const p of primary) map.set(String(p.id ?? Math.random()), p);
    return Array.from(map.values());
  }

  // ---- render ----
  let ALL_ROWS = [];

  function escapeHTML(s=''){
    return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;')
      .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }
  function rowHTML(r){
    const act = r.id ? `
      <a class="btn btn-xs" href="./detail.html?id=${encodeURIComponent(r.id)}">Bekijken</a>
    ` : '';
    return `
      <tr data-id="${escapeHTML(r.id || '')}">
        <td>${r.id ? `<a href="./detail.html?id=${encodeURIComponent(r.id)}">${escapeHTML(r.name)}</a>` : escapeHTML(r.name)}</td>
        <td>${escapeHTML(r.thema || '—')}</td>
        <td>${r.strippen || 0}</td>
        <td>${(r.price || r.price === 0) ? euro(r.price) : '—'}</td>
        <td style="white-space:nowrap;display:flex;gap:.35rem;flex-wrap:wrap">${act}</td>
      </tr>
    `;
  }
  function renderTable(rows){
    ALL_ROWS = rows.slice();
    els.tbody.innerHTML = rows.map(rowHTML).join('');
    els.wrap.style.display = rows.length ? '' : 'none';
    els.loader.style.display = 'none';
  }
  function applySearch(allRows){
    const q = S(els.zoek?.value).toLowerCase();
    if (!q) return allRows;
    return allRows.filter(r =>
      (r.name || '').toLowerCase().includes(q) ||
      (r.thema|| '').toLowerCase().includes(q)
    );
  }

  // ---- init ----
  async function init(){
    try{
      els.loader.style.display = '';
      els.error.style.display  = 'none';
      els.wrap.style.display   = 'none';

      const ext = await fetchJson([
        '../data/lessenreeksen.json', '/data/lessenreeksen.json'
      ]);
      const extRows = normalizeSeries(ext);

      const db      = loadDB();
      const locRows = normalizeSeries({ series: db.series });

      const all = mergeById(extRows, locRows)
        .sort((a,b)=> String(a.name).localeCompare(String(b.name)));

      renderTable(all);

      els.zoek?.addEventListener('input', () => {
        renderTable(applySearch(all));
      });

    }catch(e){
      console.error(e);
      els.loader.style.display = 'none';
      els.error.style.display  = '';
      els.error.textContent    = '⚠️ Kon lessenreeksen niet laden. ' + (e.message || e);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
