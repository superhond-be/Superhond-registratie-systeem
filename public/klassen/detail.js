// /public/klassen/detail.js
// v0.22.2 — Klas detail (seed JSON + localStorage/store.js) met veilige rendering

(() => {
  const $ = (s) => document.querySelector(s);
  const S = (v) => String(v ?? '').trim();

  // ----- UI mount -----
  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title: 'Klas – Detail', icon: '📘', back: './' });
    }
  });

  // ----- kleine utils -----
  const escapeHTML = (s = '') =>
    String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  async function fetchJson(candidates) {
    for (const base of candidates) {
      try {
        const url = base + (base.includes('?') ? '&' : '?') + 't=' + Date.now();
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) continue;
        return await r.json();
      } catch { /* volgende proberen */ }
    }
    return null;
  }

  // ----- opslag: fallback + optionele store.js -----
  const LS_KEY = 'superhond-db';
  function loadDB() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const db = raw ? JSON.parse(raw) : {};
      if (!Array.isArray(db.klassen)) db.klassen = [];
      return db;
    } catch {
      return { klassen: [] };
    }
  }
  function saveDB(db) {
    localStorage.setItem(LS_KEY, JSON.stringify(db));
  }

  let store = {
    getKlassen: () => loadDB().klassen,
    setKlassen: (arr) => {
      const db = loadDB();
      db.klassen = Array.isArray(arr) ? arr : [];
      saveDB(db);
    },
    ensureMigrated: async () => {}
  };

  // Dynamische import indien aanwezig
  (async () => {
    try {
      const m = await import('../js/store.js');
      store.getKlassen = m.getKlassen || store.getKlassen;
      store.setKlassen = m.setKlassen || store.setKlassen;
      store.ensureMigrated = m.ensureMigrated || store.ensureMigrated;
    } catch { /* geen store.js → prima */ }
  })();

  // ----- normalisatie -----
  // { id, naam, type, thema, strippen, geldigheid_weken, afbeelding, beschrijving, mailblue, status }
  function normalizeKlassen(raw) {
    const src =
      Array.isArray(raw) ? raw :
      Array.isArray(raw?.klassen) ? raw.klassen :
      Array.isArray(raw?.classes) ? raw.classes :
      Array.isArray(raw?.items) ? raw.items :
      Array.isArray(raw?.data) ? raw.data : [];

    return src.map((k) => ({
      id:               k.id ?? k.klasId ?? k.classId ?? null,
      naam:             S(k.naam ?? k.name ?? ''),
      type:             S(k.type ?? k.subnaam ?? ''),
      thema:            S(k.thema ?? k.theme ?? ''),
      strippen:         Number(k.strippen ?? k.aantal_strips ?? k.strips ?? 0) || 0,
      geldigheid_weken: Number(k.geldigheid_weken ?? k.weken ?? k.valid_weeks ?? 0) || 0,
      afbeelding:       S(k.afbeelding ?? k.image ?? ''),
      beschrijving:     S(k.beschrijving ?? k.description ?? ''),
      mailblue:         S(k.mailblue ?? k.mailBlue ?? ''),
      status:           (S(k.status ?? '').toLowerCase() || 'actief')
    }));
  }

  // local overschrijft seed (zodat bewerkingen winnen)
  function mergeById(localRows = [], seedRows = []) {
    const key = (x) => S(x.id) || `__name__${S(x.naam)}`;
    const map = new Map(seedRows.map((x) => [key(x), x])); // seed eerst
    for (const loc of localRows) map.set(key(loc), loc);   // lokaal overschrijft
    return [...map.values()];
  }

  function labelStatus(s = '') {
    const st = S(s).toLowerCase();
    if (!st) return '—';
    return st === 'actief'
      ? '<span class="badge" style="background:#ecfdf5;color:#065f46">actief</span>'
      : '<span class="badge" style="background:#fee2e2;color:#991b1b">inactief</span>';
  }

  // ----- render -----
  function renderDetail(rec) {
    const info = $('#info');
    const safe = (v, postfix = '') => (v || v === 0 ? `${escapeHTML(String(v))}${postfix}` : '—');

    info.innerHTML = `
      <h2 style="margin-top:0">${escapeHTML(rec.naam || '(zonder naam)')}</h2>
      <div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
        <div><strong>Type:</strong> ${safe(rec.type)}</div>
        <div><strong>Thema:</strong> ${safe(rec.thema)}</div>
        <div><strong>Strippen (voor klant):</strong> ${safe(rec.strippen)}</div>
        <div><strong>Geldigheid:</strong> ${safe(rec.geldigheid_weken, ' weken')}</div>
        <div><strong>Status:</strong> ${labelStatus(rec.status)}</div>
        <div><strong>MailBlue:</strong> ${safe(rec.mailblue)}</div>
        <div style="grid-column:1/-1"><strong>Beschrijving:</strong><br>${rec.beschrijving ? escapeHTML(rec.beschrijving) : '—'}</div>
        ${
          rec.afbeelding
            ? `<div style="grid-column:1/-1"><strong>Afbeelding:</strong><br>
                 <img src="${escapeHTML(rec.afbeelding)}" alt="Afbeelding van ${escapeHTML(rec.naam || 'klas')}"
                      style="max-width:100%;height:auto;border:1px solid var(--border,#e5e7eb);border-radius:8px"/>
               </div>`
            : ''
        }
      </div>
    `;

    // Acties
    const btnEdit = $('#btnEdit');
    if (btnEdit) btnEdit.href = `./nieuw.html?id=${encodeURIComponent(rec.id)}`;

    const btnDel = $('#btnDelete');
    if (btnDel) {
      btnDel.onclick = () => {
        if (!confirm('Deze klas verwijderen? Dit kan niet ongedaan gemaakt worden.')) return;
        const items = store.getKlassen();
        const next = items.filter((k) => String(k.id) !== String(rec.id));
        store.setKlassen(next);
        location.href = './';
      };
    }
  }

  // ----- init -----
  async function init() {
    const msg = $('#msg');
    const info = $('#info');

    const params = new URLSearchParams(location.search);
    const id = params.get('id');

    if (!id) {
      msg.style.display = '';
      msg.className = 'card error';
      msg.textContent = 'Geen id opgegeven.';
      info.innerHTML = '';
      return;
    }

    try {
      msg.style.display = '';
      msg.className = 'card muted';
      msg.textContent = '⏳ Laden…';

      await store.ensureMigrated();

      // seed + local
      const [seedRaw] = await Promise.all([
        fetchJson(['../data/klassen.json', '/data/klassen.json'])
      ]);

      const seed = normalizeKlassen(seedRaw);
      const local = normalizeKlassen({ klassen: store.getKlassen() });

      const all = mergeById(local, seed); // lokaal overschrijft seed
      const rec = all.find((k) => String(k.id) === String(id));

      if (!rec) {
        msg.style.display = '';
        msg.className = 'card error';
        msg.textContent = `Klas met id “${id}” niet gevonden.`;
        info.innerHTML = '';
        return;
      }

      msg.style.display = 'none';
      renderDetail(rec);
    } catch (e) {
      console.error('[klassen/detail] load error:', e);
      msg.style.display = '';
      msg.className = 'card error';
      msg.textContent = '⚠️ Kon de klas niet laden. ' + (e?.message || e);
      info.innerHTML = '';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
