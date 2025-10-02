// Klas – Detail
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title:'Klas – Detail', icon:'📚', back:'./' });
    }
  });

  const bust = () => (Date.now());
  async function fetchJson(tryUrls){
    for (const u of tryUrls){
      try{
        const url = u + (u.includes('?')?'&':'?') + 't=' + bust();
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

  function normalizeClasses(raw){
    const arr =
      Array.isArray(raw) ? raw :
      Array.isArray(raw?.klassen) ? raw.klassen :
      Array.isArray(raw?.classes) ? raw.classes :
      Array.isArray(raw?.items) ? raw.items :
      Array.isArray(raw?.data) ? raw.data : [];

    return arr.map(k => ({
      id: S(k.id ?? k.klasId ?? k.classId ?? ''),
      name: S(k.name ?? k.naam ?? ''),
      type: S(k.type ?? k.subnaam ?? ''),
      thema: S(k.thema ?? k.theme ?? ''),
      strippen: Number(k.strippen ?? k.aantal_strips ?? k.aantalStrippen ?? 0) || 0,
      weken: Number(k.weken ?? k.geldigheid_weken ?? k.geldigheidsduur ?? 0) || 0,
      afbeelding: S(k.afbeelding ?? k.image ?? ''),
      omschrijving: S(k.omschrijving ?? k.beschrijving ?? ''),
      mailblue: S(k.mailblue ?? k.mailBlue ?? ''),
      status: (S(k.status || 'actief').toLowerCase() === 'inactief') ? 'inactief' : 'actief'
    }));
  }

  function escapeHTML(s=''){
    return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;')
      .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }

  async function init(){
    const box = $('#box'); const msg = $('#msg'); const edit = $('#btnEdit');
    const id = new URLSearchParams(location.search).get('id');

    const [ext, db] = await Promise.all([
      fetchJson(['../data/klassen.json','/data/klassen.json']),
      Promise.resolve(loadDB())
    ]);

    const all = [
      ...normalizeClasses(ext),
      ...normalizeClasses({ classes: db.classes })
    ];

    const rec = all.find(x => String(x.id) === String(id));
    if (!rec){
      msg.style.display = '';
      msg.className = 'card error';
      msg.textContent = 'Klas niet gevonden.';
      box.style.display = 'none';
      return;
    }

    edit.href = `./bewerken.html?id=${encodeURIComponent(rec.id)}`;

    box.innerHTML = `
      <h2 style="margin-top:0">${escapeHTML(rec.name || '(zonder naam)')}</h2>
      <div class="grid" style="display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
        <div><strong>Type:</strong> ${escapeHTML(rec.type || '—')}</div>
        <div><strong>Thema:</strong> ${escapeHTML(rec.thema || '—')}</div>
        <div><strong>Strippen (voor klant):</strong> ${rec.strippen || 0}</div>
        <div><strong>Geldigheid (weken):</strong> ${rec.weken || 0}</div>
        <div><strong>Status:</strong> ${escapeHTML(rec.status)}</div>
        <div><strong>MailBlue:</strong> ${escapeHTML(rec.mailblue || '—')}</div>
      </div>
      ${rec.afbeelding ? `<p style="margin-top:10px"><img src="${escapeHTML(rec.afbeelding)}" alt="" style="max-width:320px;border:1px solid #e5e7eb;border-radius:8px"/></p>`:''}
      <p style="white-space:pre-wrap">${escapeHTML(rec.omschrijving || '')}</p>
    `;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
