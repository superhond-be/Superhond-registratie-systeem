// Klassen – overzicht
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  const els = {
    loader: $('#loader'),
    error:  $('#error'),
    wrap:   $('#wrap'),
    tbody:  $('#tabel tbody'),
    zoek:   $('#zoek'),
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title: 'Klassen', icon: '📚', back: '../dashboard/' });
    }
  });

  function loadDB() {
    try {
      const raw = localStorage.getItem('superhond-db');
      const db  = raw ? JSON.parse(raw) : {};
      db.klassen = Array.isArray(db.klassen) ? db.klassen : [];
      return db;
    } catch {
      return { klassen: [] };
    }
  }

  function saveDB(db){ localStorage.setItem('superhond-db', JSON.stringify(db)); }

  function escapeHTML(s=''){
    return String(s)
      .replaceAll('&','&amp;').replaceAll('<','&lt;')
      .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }

  function rowHTML(r) {
    return `
      <tr data-id="${escapeHTML(r.id || '')}">
        <td>${escapeHTML(r.naam)}</td>
        <td>${escapeHTML(r.type || '—')}</td>
        <td>${escapeHTML(r.thema || '—')}</td>
        <td>${r.strippen || 0}</td>
        <td>${r.geldigheid_weken || 0}</td>
        <td>${escapeHTML(r.status || 'actief')}</td>
        <td>
          <a class="btn btn-xs" href="./detail.html?id=${encodeURIComponent(r.id)}">👁️</a>
          <a class="btn btn-xs" href="./bewerken.html?id=${encodeURIComponent(r.id)}">✏️</a>
          <button class="btn btn-xs" data-action="delete" data-id="${escapeHTML(r.id)}">🗑️</button>
        </td>
      </tr>
    `;
  }

  function renderTable(rows) {
    els.tbody.innerHTML = rows.map(rowHTML).join('');
    els.wrap.style.display = rows.length ? '' : 'none';
  }

  function applySearch(allRows) {
    const q = S(els.zoek?.value).toLowerCase();
    if (!q) return allRows;
    return allRows.filter(r =>
      (r.naam || '').toLowerCase().includes(q) ||
      (r.type || '').toLowerCase().includes(q) ||
      (r.thema|| '').toLowerCase().includes(q)
    );
  }

  function bindActions(db) {
    els.tbody.addEventListener('click', e => {
      const btn = e.target.closest('[data-action="delete"]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      if (!id) return;

      if (!confirm('Deze klas verwijderen?')) return;

      db.klassen = db.klassen.filter(k => String(k.id) !== String(id));
      saveDB(db);
      renderTable(applySearch(db.klassen));
    });
  }

  function init() {
    els.loader.style.display = '';
    els.error.style.display  = 'none';
    els.wrap.style.display   = 'none';

    const db = loadDB();
    const all = db.klassen.sort((a,b) => String(a.naam).localeCompare(String(b.naam)));

    renderTable(all);
    els.loader.style.display = 'none';
    els.wrap.style.display   = '';

    els.zoek?.addEventListener('input', () => renderTable(applySearch(all)));

    bindActions(db);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
