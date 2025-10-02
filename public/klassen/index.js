// /public/klassen/index.js
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  const els = {
    loader: $('#loader'),
    error:  $('#error'),
    wrap:   $('#wrap'),
    tbody:  $('#tabelBody'),
    zoek:   $('#zoek'),
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title:'Klassen', icon:'🏷️', back:'../dashboard/' });
    }
  });

  // Helpers
  function loadDB(){
    try {
      const raw = localStorage.getItem('superhond-db');
      const db  = raw ? JSON.parse(raw) : {};
      db.classes = Array.isArray(db.classes) ? db.classes : [];
      return db;
    }catch { return { classes: [] }; }
  }
  function saveDB(db){
    localStorage.setItem('superhond-db', JSON.stringify(db));
  }

  // Render rij
  function rowHTML(r){
    return `
      <tr data-id="${S(r.id)}">
        <td>${S(r.naam)}</td>
        <td>${S(r.type)}</td>
        <td>${S(r.thema)}</td>
        <td>${r.strippen || 0}</td>
        <td>${r.geldigheidsduur || 0} wkn</td>
        <td>${S(r.status)}</td>
        <td style="white-space:nowrap">
          <a class="btn btn-xs" href="./detail.html?id=${encodeURIComponent(r.id)}">👁️</a>
          <a class="btn btn-xs" href="./bewerken.html?id=${encodeURIComponent(r.id)}">✏️</a>
          <button class="btn btn-xs" data-action="del" data-id="${S(r.id)}">🗑️</button>
        </td>
      </tr>
    `;
  }

  function renderTable(rows){
    els.tbody.innerHTML = rows.map(rowHTML).join('') || `<tr><td colspan="7" class="muted">Geen klassen gevonden.</td></tr>`;
    els.wrap.style.display = '';
  }

  function applySearch(all){
    const q = S(els.zoek.value).toLowerCase();
    if (!q) return all;
    return all.filter(r =>
      (r.naam||'').toLowerCase().includes(q) ||
      (r.type||'').toLowerCase().includes(q) ||
      (r.thema||'').toLowerCase().includes(q)
    );
  }

  function bindActions(all){
    els.tbody.addEventListener('click', e => {
      const btn = e.target.closest('[data-action="del"]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      if (!id) return;

      if (!confirm('Klas verwijderen?')) return;

      const db = loadDB();
      db.classes = db.classes.filter(c => String(c.id)!==String(id));
      saveDB(db);

      const newRows = all.filter(c => String(c.id)!==String(id));
      renderTable(applySearch(newRows));
    });
  }

  async function init(){
    els.loader.style.display = '';
    els.error.style.display  = 'none';
    els.wrap.style.display   = 'none';

    try{
      const db = loadDB();
      const rows = db.classes.sort((a,b)=>S(a.naam).localeCompare(S(b.naam)));

      renderTable(rows);
      els.loader.style.display = 'none';

      els.zoek.addEventListener('input', () => {
        renderTable(applySearch(rows));
      });

      bindActions(rows);
    }catch(e){
      els.loader.style.display = 'none';
      els.error.textContent = '⚠️ Fout bij laden klassen: '+(e.message||e);
      els.error.style.display = '';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
