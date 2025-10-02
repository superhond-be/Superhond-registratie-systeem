// Klas – bewerken/toevoegen (localStorage-first, externe JSON alleen voor initialisatie/lezen)
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  // Topbar
  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title:'Klas – Bewerken', icon:'✏️', back:'./' });
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
      db.klassen = Array.isArray(db.klassen) ? db.klassen : [];
      return db;
    } catch {
      return { klassen: [] };
    }
  }
  function saveDB(db){ localStorage.setItem('superhond-db', JSON.stringify(db)); }

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
        status:            (S(k.status ?? 'actief') || 'actief').toLowerCase()
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

  function uuid(){
    return 'klas-' + Math.random().toString(36).slice(2,8) + '-' + Date.now().toString(36);
  }

  // ---------- UI wires ----------
  const els = {
    form: $('#formKlas'),
    msg:  $('#msg'),
    id:   $('#klasId'),
    naam: $('#naam'),
    type: $('#type'),
    thema: $('#thema'),
    strippen: $('#strippen'),
    geldigheid: $('#geldigheid'),
    status: $('#status'),
    mailblue: $('#mailblue'),
    afbeelding: $('#afbeelding'),
    beschrijving: $('#beschrijving'),
    imgPreview: $('#imgPreview'),
    btnSave: $('#btnSave'),
    btnSaveBack: $('#btnSaveBack'),
    btnDelete: $('#btnDelete')
  };

  function showMsg(text, ok=true){
    els.msg.style.display = '';
    els.msg.className = 'card ' + (ok ? '' : 'error');
    els.msg.textContent = text;
  }

  function fillForm(rec){
    els.id.value = S(rec.id || '');
    els.naam.value = S(rec.naam || '');
    els.type.value = S(rec.type || '');
    els.thema.value = S(rec.thema || '');
    els.strippen.value = Number.isFinite(rec.strippen) ? String(rec.strippen) : '0';
    els.geldigheid.value = Number.isFinite(rec.geldigheid_weken) ? String(rec.geldigheid_weken) : '0';
    els.status.value = (S(rec.status) || 'actief') === 'inactief' ? 'inactief' : 'actief';
    els.mailblue.value = S(rec.mailblue || '');
    els.afbeelding.value = S(rec.afbeelding || '');
    els.beschrijving.value = S(rec.beschrijving || '');

    if (S(rec.afbeelding)) {
      els.imgPreview.src = rec.afbeelding;
      els.imgPreview.style.display = '';
    } else {
      els.imgPreview.removeAttribute('src');
      els.imgPreview.style.display = 'none';
    }
  }

  function readForm(){
    const strippen = Number(els.strippen.value);
    const geldigheid = Number(els.geldigheid.value);

    return {
      id: S(els.id.value) || uuid(),
      naam: S(els.naam.value),
      type: S(els.type.value),
      thema: S(els.thema.value),
      strippen: Number.isFinite(strippen) ? strippen : 0,
      geldigheid_weken: Number.isFinite(geldigheid) ? geldigheid : 0,
      afbeelding: S(els.afbeelding.value),
      beschrijving: S(els.beschrijving.value),
      mailblue: S(els.mailblue.value),
      status: (S(els.status.value) || 'actief').toLowerCase()
    };
  }

  function validate(rec){
    if (!rec.naam) return 'Naam is verplicht.';
    if (rec.strippen < 0) return 'Strippen mag niet negatief zijn.';
    if (rec.geldigheid_weken < 0) return 'Geldigheid (weken) mag niet negatief zijn.';
    return null;
  }

  // Live preview afbeelding
  document.addEventListener('input', (e) => {
    if (e.target === els.afbeelding) {
      const url = S(els.afbeelding.value);
      if (url) {
        els.imgPreview.src = url;
        els.imgPreview.style.display = '';
      } else {
        els.imgPreview.removeAttribute('src');
        els.imgPreview.style.display = 'none';
      }
    }
  });

  // Save handlers
  function persist(rec){
    const db = loadDB();
    const i = db.klassen.findIndex(k => String(k.id) === String(rec.id));
    if (i >= 0) db.klassen[i] = rec;
    else db.klassen.push(rec);
    saveDB(db);
  }

  async function init(){
    // id uit URL
    const params = new URLSearchParams(location.search);
    const id = params.get('id');

    // laad externe + lokale data
    const [extRaw, db] = await Promise.all([
      fetchJson(['../data/klassen.json','/data/klassen.json']),
      Promise.resolve(loadDB())
    ]);

    const ext = normalizeKlassen(extRaw);
    const loc = normalizeKlassen({ klassen: db.klassen });
    const all = mergeById(ext, loc);

    // bestaand record of nieuw
    const rec = id ? all.find(k => String(k.id) === String(id)) : {
      id: '',
      naam: '',
      type: '',
      thema: '',
      strippen: 0,
      geldigheid_weken: 0,
      afbeelding: '',
      beschrijving: '',
      mailblue: '',
      status: 'actief'
    };

    if (id && !rec) {
      showMsg(`Klas met id “${id}” niet gevonden.`, false);
    } else {
      els.msg.style.display = 'none';
    }

    fillForm(rec);

    // Submit (Opslaan)
    els.form?.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const data = readForm();
      const err = validate(data);
      if (err) return showMsg(err, false);

      persist(data);
      showMsg('Klas opgeslagen ✔️', true);
      // id invullen wanneer nieuw
      els.id.value = data.id;
      history.replaceState(null, '', `?id=${encodeURIComponent(data.id)}`);
    });

    // Opslaan & Terug
    els.btnSaveBack?.addEventListener('click', (ev) => {
      ev.preventDefault();
      const data = readForm();
      const err = validate(data);
      if (err) return showMsg(err, false);
      persist(data);
      location.href = './';
    });

    // Verwijderen
    els.btnDelete?.addEventListener('click', (ev) => {
      ev.preventDefault();
      const idVal = S(els.id.value);
      if (!idVal) return showMsg('Kan niet verwijderen: geen id.', false);
      if (!confirm('Deze klas verwijderen?')) return;

      const db2 = loadDB();
      db2.klassen = (db2.klassen || []).filter(k => String(k.id) !== String(idVal));
      saveDB(db2);
      location.href = './';
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
