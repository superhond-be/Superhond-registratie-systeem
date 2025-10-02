// Klassen – overzicht: laad uit localStorage + (optioneel) ../data/klassen.json
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

  // Topbar/footer mount
  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title: 'Klassen', icon: '📚', back: '../dashboard/' });
    }
  });

  // ---------- Helpers ----------
  function bust(u){ return u + (u.includes('?') ? '&' : '?') + 't=' + Date.now(); }

  async function fetchJson(tryUrls) {
    for (const u of tryUrls) {
      try {
        const r = await fetch(bust(u), { cache:'no-store' });
        if (r.ok) return r.json();
      } catch(_) {}
    }
    return null;
  }

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

  // Normaliseer uiteenlopende vormen → {id,name,type,thema,strippen,valid_weeks,status}
  function normalizeKlassen(raw) {
    if (!raw) return [];
    const arr =
      Array.isArray(raw)            ? raw :
      Array.isArray(raw?.klassen)   ? raw.klassen :
      Array.isArray(raw?.classes)   ? raw.classes :
      Array.isArray(raw?.items)     ? raw.items :
      Array.isArray(raw?.data)      ? raw.data : [];

    const rows = [];
    for (const k of arr) {
      const id      = k.id ?? k.klasId ?? k.classId ?? null;
      const name    = S(k.naam ?? k.name ?? '');
      const type    = S(k.type ?? k.subnaam ?? '');
      const thema   = S(k.thema ?? k.theme ?? '');
      const strip   = Number(k.strippen ?? k.aantal_strippen ?? k.strips ?? 0) || 0;
      const weeks   = Number(k.geldigheid_weken ?? k.geldigheid ?? k.valid_weeks ?? 0) || 0;
      const status  = S(k.status ?? 'actief').toLowerCase(); // 'actief' / 'inactief'
      rows.push({ id, name, type, thema, strippen:strip, valid_weeks:weeks, status });
    }
    return rows;
  }

  // merge op id of (name+type+thema) als noodsleutel
  function uniqueMerge(primary=[], secondary=[]) {
    const key = x => S(x.id) || `${S(x.name)}|${S(x.type)}|${S(x.thema)}`;
    const map = new Map(secondary.map(x => [key(x), x])); // lokaal eerst
    for (const p of primary) map.set(key(p), p);          // extern overschrijft bij zelfde key
    return [...map.values()];
  }

  // ---------- Render ----------
  let ALL_ROWS = [];

  function statusBadge(status) {
    const st = (S(status)||'actief').toLowerCase();
    const cls = st === 'inactief' ? 'badge-status badge-status--inactief'
                                  : 'badge-status badge-status--actief';
    const label = st === 'inactief' ? 'Inactief' : 'Actief';
    return `<span class="${cls}">${label}</span>`;
  }

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
        <button class="icon-btn" data-action="delete" data-id="${r.id}" title="Verwijderen" aria-label="Verwijderen">
          <i class="icon icon-del"></i>
        </button>
      </div>
    `;
  }

  function rowHTML(r) {
    const nameCell = r.id
      ? `<a href="./detail.html?id=${encodeURIComponent(r.id)}">${escapeHTML(r.name || '(zonder naam)')}</a>`
      : escapeHTML(r.name || '(zonder naam)');

    return `
      <tr data-id="${escapeHTML(r.id || '')}">
        <td>${nameCell}</td>
        <td>${escapeHTML(r.type || '—')}</td>
        <td>${escapeHTML(r.thema || '—')}</td>
        <td>${Number.isFinite(r.strippen)? r.strippen : '—'}</td>
        <td>${Number.isFinite(r.valid_weeks)? r.valid_weeks : '—'}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${actionsHTML(r)}</td>
      </tr>
    `;
  }

  function escapeHTML(s=''){
    return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;')
      .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
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
      (r.type || '').toLowerCase().includes(q) ||
      (r.thema|| '').toLowerCase().includes(q)
    );
  }

  function bindActions() {
    els.tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="delete"]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      if (!id) return;

      if (!confirm('Deze klas verwijderen?')) return;

      const db = loadDB();
      db.klassen = (db.klassen || []).filter(k => String(k.id) !== String(id));
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

      // Extern (optioneel demo-json)
      const ext = await fetchJson(['../data/klassen.json', '/data/klassen.json']);
      const extRows = normalizeKlassen(ext);

      // Lokaal
      const db = loadDB();
      const locRows = normalizeKlassen({ klassen: db.klassen });

      // Merge + sort
      const all = uniqueMerge(extRows, locRows)
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
      els.error.textContent    = '⚠️ Kon klassen niet laden. ' + (e.message || e);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
