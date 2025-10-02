// Klas – detail (haalt uit /data/klassen.json + localStorage, toont velden en acties)
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  // Topbar mount
  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title:'Klas – Detail', icon:'📘', back:'./' });
    }
  });

  // ---------- Helpers ----------
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
      const db = raw ? JSON.parse(raw) : {};
      db.klassen = Array.isArray(db.klassen) ? db.klassen : [];   // opslaglaag voor klassen
      return db;
    } catch {
      return { klassen: [] };
    }
  }
  function saveDB(db){ localStorage.setItem('superhond-db', JSON.stringify(db)); }

  function escapeHTML(s=''){
    return String(s)
      .replaceAll('&','&amp;').replaceAll('<','&lt;')
      .replaceAll('>','&gt;').replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }

  // Normaliseer naar uniforme shape
  // { id, naam, type, thema, strippen, geldigheid_weken, afbeelding, beschrijving, mailblue, status }
  function normalizeKlassen(raw) {
    const out = [];
    const arr =
      Array.isArray(raw)           ? raw :
      Array.isArray(raw?.klassen)  ? raw.klassen :
      Array.isArray(raw?.classes)  ? raw.classes :
      Array.isArray(raw?.items)    ? raw.items :
      Array.isArray(raw?.data)     ? raw.data : [];

    for (const k of arr) {
      out.push({
        id:                k.id ?? k.klasId ?? k.classId ?? null,
        naam:              S(k.naam ?? k.name ?? ''),
        type:              S(k.type ?? k.subnaam ?? ''),
        thema:             S(k.thema ?? k.theme ?? ''),
        strippen:          Number(k.strippen ?? k.aantal_strips ?? k.strips ?? 0) || 0,
        geldigheid_weken:  Number(k.geldigheid_weken ?? k.weken ?? k.valid_weeks ?? 0) || 0,
        afbeelding:        S(k.afbeelding ?? k.image ?? ''),
        beschrijving:      S(k.beschrijving ?? k.description ?? ''),
        mailblue:          S(k.mailblue ?? k.mailBlue ?? ''),
        status:            S(k.status ?? 'actief').toLowerCase()
      });
    }
    return out;
  }

  function mergeById(primary=[], secondary=[]) {
    const key = x => S(x.id);
    const map = new Map(secondary.map(x => [key(x), x])); // lokaal eerst
    for (const p of primary) map.set(key(p), p);          // extern overschrijft
    return [...map.values()];
  }

  function labelStatus(s=''){
    const st = S(s).toLowerCase();
    if (!st) return '—';
    return st === 'actief'
      ? `<span class="badge">actief</span>`
      : `<span class="badge" style="background:#fee2e2;color:#991b1b">inactief</span>`;
  }

  // ---------- Render ----------
  function renderDetail(rec) {
    const info = $('#info');
    const nl = (v, postfix='') => v || v === 0 ? escapeHTML(String(v)) + postfix : '—';

    info.innerHTML = `
      <h2 style="margin-top:0">${escapeHTML(rec.naam || '(zonder naam)')}</h2>
      <div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
        <div><strong>Type:</strong> ${nl(rec.type)}</div>
        <div><strong>Thema:</strong> ${nl(rec.thema)}</div>
        <div><strong>Strippen (voor klant):</strong> ${nl(rec.strippen)}</div>
        <div><strong>Geldigheid:</strong> ${nl(rec.geldigheid_weken,' weken')}</div>
        <div><strong>Status:</strong> ${labelStatus(rec.status)}</div>
        <div><strong>MailBlue:</strong> ${nl(rec.mailblue)}</div>
        <div style="grid-column:1/-1"><strong>Beschrijving:</strong><br>${rec.beschrijving ? escapeHTML(rec.beschrijving) : '—'}</div>
        ${
          rec.afbeelding
            ? `<div style="grid-column:1/-1"><strong>Afbeelding:</strong><br>
                 <img src="${escapeHTML(rec.afbeelding)}" alt="Afbeelding van ${escapeHTML(rec.naam)}" style="max-width:100%;height:auto;border:1px solid var(--border);border-radius:8px"/>
               </div>`
            : ''
        }
      </div>
    `;

    // Actieknoppen draden
    const btnEdit = $('#btnEdit');
    if (btnEdit) btnEdit.href = `./bewerken.html?id=${encodeURIComponent(rec.id)}`;

    const btnDel = $('#btnDelete');
    if (btnDel) {
      btnDel.onclick = () => {
        if (!confirm('Deze klas verwijderen? Dit kan niet ongedaan gemaakt worden.')) return;
        const db = loadDB();
        db.klassen = (db.klassen || []).filter(k => String(k.id) !== String(rec.id));
        saveDB(db);
        location.href = './';
      };
    }
  }

  // ---------- Init ----------
  async function init() {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');

    const msg = $('#msg');
    const info = $('#info');

    if (!id) {
      msg.style.display = '';
      msg.className = 'card error';
      msg.textContent = 'Geen id opgegeven.';
      info.innerHTML = '';
      return;
    }

    // 1) extern JSON (optioneel) + 2) lokaal (localStorage)
    const [extRaw, db] = await Promise.all([
      fetchJson(['../data/klassen.json','/data/klassen.json']),
      Promise.resolve(loadDB())
    ]);

    const ext = normalizeKlassen(extRaw);
    const loc = normalizeKlassen({ klassen: db.klassen });

    // Merge → extern (als laatste) overschrijft lokaal met zelfde id
    const all = mergeById(ext, loc);
    const rec = all.find(k => String(k.id) === String(id));

    if (!rec) {
      msg.style.display = '';
      msg.className = 'card error';
      msg.textContent = `Klas met id “${id}” niet gevonden.`;
      info.innerHTML = '';
      return;
    }

    msg.style.display = 'none';
    renderDetail(rec);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
