// Klassen – Overzicht
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  const els = {
    loader: $('#loader'),
    error:  $('#error'),
    wrap:   $('#wrap'),
    tbody:  $('#tbody'),
    zoek:   $('#zoek')
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title:'Klassen', icon:'📚', back:'../dashboard/' });
    }
  });

  const bust = () => (Date.now());

  async function fetchJson(tryUrls){
    for (const u of tryUrls){
      try{
        const url = u + (u.includes('?') ? '&' : '?') + 't=' + bust();
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
      db.classes = Array.isArray(db.classes) ? db.classes : [];
      return db;
    }catch{ return { classes:[] }; }
  }
  function saveDB(db){ localStorage.setItem('superhond-db', JSON.stringify(db)); }

  // Normaliseer allerlei varianten naar een uniforme "class" rij
  // shape: {id,name,type,thema,strippen,weken,afbeelding,omschrijving,mailblue,status}
  function normalizeClasses(raw){
    const arr =
      Array.isArray(raw)           ? raw :
      Array.isArray(raw?.klassen)  ? raw.klassen :
      Array.isArray(raw?.classes)  ? raw.classes :
      Array.isArray(raw?.items)    ? raw.items :
      Array.isArray(raw?.data)     ? raw.data : [];

    return arr.map(k => ({
      id:          k.id ?? k.klasId ?? k.classId ?? cryptoRandomId(),
      name:        S(k.name ?? k.naam ?? ''),
      type:        S(k.type ?? k.subnaam ?? ''),
      thema:       S(k.thema ?? k.theme ?? ''),
      strippen:    Number(k.strippen ?? k.aantal_strips ?? k.aantalStrippen ?? 0) || 0,
      weken:       Number(k.weken ?? k.geldigheid_weken ?? k.geldigheidsduur ?? 0) || 0,
      afbeelding:  S(k.afbeelding ?? k.image ?? ''),
      omschrijving:S(k.omschrijving ?? k.beschrijving ?? ''),
      mailblue:    S(k.mailblue ?? k.mailBlue ?? ''),
      status:      (S(k.status || 'actief').toLowerCase() === 'inactief') ? 'inactief' : 'actief'
    }));
  }

  function cryptoRandomId(){
    try { return 'cls-' + crypto.randomUUID(); }
    catch { return 'cls-' + Math.random().toString(36).slice(2,10); }
  }

  // merge: extern overschrijft lokale bij gelijke id
  function mergeById(primary=[], secondary=[]){
    const map = new Map(secondary.map(x => [String(x.id), x]));
    for (const p of primary) map.set(String(p.id), p);
    return [...map.values()];
  }

  function escapeHTML(s=''){
    return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;')
      .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }

  function actionsHTML(row){
    const id = encodeURIComponent(row.id);
    return `
      <div class="icon-actions" style="display:flex;gap:.35rem">
        <a class="icon-btn" href="./detail.html?id=${id}" title="Bekijken"><i class="icon icon-view"></i></a>
        <a class="icon-btn" href="./bewerken.html?id=${id}" title="Bewerken"><i class="icon icon-edit"></i></a>
        <button class="icon-btn" data-action="delete" data-id="${escapeHTML(row.id)}" title="Verwijderen">
          <i class="icon icon-del"></i>
        </button>
      </div>
    `;
  }

  function rowHTML(k){
    const statusBadge =
      k.status === 'inactief'
        ? `<span class="badge" style="background:#fee2e2;color:#991b1b">inactief</span>`
        : `<span class="badge">actief</span>`;
    return `
      <tr data-id="${escapeHTML(k.id)}">
        <td><a href="./detail.html?id=${encodeURIComponent(k.id)}">${escapeHTML(k.name || '(zonder naam)')}</a></td>
        <td>${escapeHTML(k.type || '—')}</td>
        <td>${escapeHTML(k.thema || '—')}</td>
        <td>${k.strippen || 0}</td>
        <td>${k.weken || 0}</td>
        <td>${statusBadge}</td>
        <td>${actionsHTML(k)}</td>
      </tr>
    `;
  }

  let ALL = [];

  function renderTable(rows){
    els.tbody.innerHTML = rows.map(rowHTML).join('');
    els.wrap.style.display = rows.length ? '' : 'none';
  }

  function applySearch(rows){
    const q = S(els.zoek.value).toLowerCase();
    if (!q) return rows;
    return rows.filter(k =>
      (k.name || '').toLowerCase().includes(q) ||
      (k.type || '').toLowerCase().includes(q) ||
      (k.thema|| '').toLowerCase().includes(q)
    );
  }

  function bindActions(){
    els.tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="delete"]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      if (!id) return;
      if (!confirm('Klas verwijderen?')) return;

      const db = loadDB();
      db.classes = (db.classes || []).filter(c => String(c.id) !== String(id));
      saveDB(db);

      ALL = ALL.filter(c => String(c.id) !== String(id));
      renderTable(applySearch(ALL));
    });
  }

  async function init(){
    try{
      els.loader.style.display = '';
      els.error.style.display  = 'none';
      els.wrap.style.display   = 'none';

      const ext = await fetchJson(['../data/klassen.json','/data/klassen.json']);
      const extRows = normalizeClasses(ext);

      const db = loadDB();
      const locRows = normalizeClasses({ classes: db.classes });

      ALL = mergeById(extRows, locRows)
        .sort((a,b) => String(a.name).localeCompare(String(b.name)));

      renderTable(ALL);
      els.loader.style.display = 'none';
      els.wrap.style.display   = '';

      els.zoek.addEventListener('input', () => renderTable(applySearch(ALL)));
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
