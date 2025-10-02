// /public/klassen/index.js
// Klassen – laden (data + localStorage), zoeken, acties (bekijken/bewerken/verwijderen)
(() => {
  const $  = s => document.querySelector(s);
  const S  = v => String(v ?? '').trim();

  const els = {
    loader: $('#loader'),
    error:  $('#error'),
    wrap:   $('#wrap'),
    tbody:  $('#tabelBody'),
    zoek:   $('#zoek'),
  };

  // Topbar/footer mount
  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title:'Klassen', icon:'📚', back:'../dashboard/' });
    }
  });

  // --------------- Helpers ---------------
  async function fetchJson(tryUrls){
    for (const u of tryUrls){
      try{
        const url = u + (u.includes('?') ? '&' : '?') + 't=' + Date.now();
        const r = await fetch(url, { cache:'no-store' });
        if (r.ok) return r.json();
      }catch(_){}
    }
    return null;
  }

  function loadDB(){
    try{
      const raw = localStorage.getItem('superhond-db');
      const db  = raw ? JSON.parse(raw) : {};
      db.klassen = Array.isArray(db.klassen) ? db.klassen : [];
      return db;
    }catch{
      return { klassen: [] };
    }
  }
  function saveDB(db){
    localStorage.setItem('superhond-db', JSON.stringify(db));
  }

  // Normaliseer klassen-records naar uniforme vorm
  // {id, naam, type, thema, strippen, geldigheid_weken, status}
  function normalizeKlassen(raw){
    const arr =
      Array.isArray(raw)            ? raw :
      Array.isArray(raw?.klassen)   ? raw.klassen :
      Array.isArray(raw?.items)     ? raw.items :
      Array.isArray(raw?.data)      ? raw.data : [];

    return arr.map(k => ({
      id:                k.id ?? k.klasId ?? k.classId ?? null,
      naam:              S(k.naam || k.name || ''),
      type:              S(k.type || k.subnaam || ''),
      thema:             S(k.thema || k.theme || ''),
      strippen:          Number(k.strippen ?? k.aantal_strippen ?? k.strips ?? 0) || 0,
      geldigheid_weken:  Number(k.geldigheid_weken ?? k.geldigheid ?? k.weken ?? 0) || 0,
      status:            (S(k.status || '').toLowerCase() || 'actief')
    }));
  }

  // Merge op id → lokale (bewerkte) klassen overschrijven externe demo
  function mergeById(localRows = [], extRows = []){
    const key = x => S(x.id) || S(x.naam);
    const map = new Map(extRows.map(x => [key(x), x])); // extern eerst
    for (const loc of localRows) map.set(key(loc), loc); // lokaal overschrijft
    return [...map.values()];
  }

  // --------------- Render ---------------
  let ALL_ROWS = [];

  function statusBadge(s){
    const t = (s || '').toLowerCase();
    if (t === 'inactief') return '<span class="badge" style="background:#fee2e2;color:#991b1b">inactief</span>';
    return '<span class="badge" style="background:#e8f5e9;color:#166534">actief</span>';
  }

  function rowHTML(r){
    const idEnc = r.id ? encodeURIComponent(r.id) : '';
    return `
      <tr data-id="${r.id ? String(r.id).replaceAll('"','&quot;') : ''}">
        <td>${r.id ? `<a href="./detail.html?id=${idEnc}">${escapeHTML(r.naam || '(zonder naam)')}</a>`
                    : escapeHTML(r.naam || '(zonder naam)')}</td>
        <td>${escapeHTML(r.type || '—')}</td>
        <td>${escapeHTML(r.thema || '—')}</td>
        <td>${r.strippen || 0}</td>
        <td>${r.geldigheid_weken || 0} w</td>
        <td>${statusBadge(r.status)}</td>
        <td style="white-space:nowrap">
          ${r.id ? `
            <a class="btn btn-xs" href="./detail.html?id=${idEnc}" title="Bekijken">👁️</a>
            <a class="btn btn-xs" href="./bewerken.html?id=${idEnc}" title="Bewerken">✏️</a>
            <button class="btn btn-xs" data-action="delete" data-id="${escapeHTML(r.id)}" title="Verwijderen">🗑️</button>
          ` : ''}
        </td>
      </tr>
    `;
  }

  function escapeHTML(s=''){
    return String(s)
      .replaceAll('&','&amp;').replaceAll('<','&lt;')
      .replaceAll('>','&gt;').replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }

  function render(rows){
    ALL_ROWS = rows.slice();
    els.tbody.innerHTML = rows.map(rowHTML).join('');
    els.wrap.style.display = rows.length ? '' : 'none';
  }

  function applySearch(all){
    const q = S(els.zoek?.value).toLowerCase();
    if (!q) return all;
    return all.filter(r =>
      (r.naam || '').toLowerCase().includes(q) ||
      (r.type || '').toLowerCase().includes(q) ||
      (r.thema|| '').toLowerCase().includes(q)
    );
  }

  function bindActions(){
    els.tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="delete"]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      if (!id) return;

      if (!confirm('Deze klas verwijderen?')) return;

      const db = loadDB();
      db.klassen = db.klassen.filter(k => String(k.id) !== String(id));
      saveDB(db);

      const newRows = ALL_ROWS.filter(r => String(r.id) !== String(id));
      render(applySearch(newRows));
    });
  }

  // --------------- Init ---------------
  async function init(){
    try{
      els.loader.style.display = '';
      els.error.style.display  = 'none';
      els.wrap.style.display   = 'none';

      const [extRaw, db] = await Promise.all([
        fetchJson(['../data/klassen.json','/data/klassen.json']),
        Promise.resolve(loadDB())
      ]);

      const extRows = normalizeKlassen(extRaw);
      const locRows = normalizeKlassen({ klassen: db.klassen });

      const merged = mergeById(locRows, extRows)
        .sort((a,b) => String(a.naam).localeCompare(String(b.naam)));

      render(merged);

      els.loader.style.display = 'none';
      els.wrap.style.display   = '';

      els.zoek?.addEventListener('input', () => render(applySearch(merged)));
      bindActions();
    }catch(e){
      console.error(e);
      els.loader.style.display = 'none';
      els.error.style.display  = '';
      els.error.textContent    = '⚠️ Kon klassen niet laden. ' + (e.message || e);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
