// /public/klassen/bewerken.js
// v0.22.3 — Klas toevoegen/bewerken
// - LocalStorage-first (bucket: superhond-db.klassen)
// - Optionele store.js integratie (get/set/ensureMigrated)
// - Seed JSON alleen voor initialisatie/lezen
// - Validatie + nette meldingen + live image preview

const $ = (s) => document.querySelector(s);
const S = (v) => String(v ?? '').trim();

document.addEventListener('DOMContentLoaded', () => {
  if (window.SuperhondUI?.mount) {
    SuperhondUI.mount({ title: 'Klas – Bewerken', icon: '✏️', back: './', showApiStatus: false });
  }
});

// ===== Helper utils =====
const escapeHTML = (s='') => String(s)
  .replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;')
  .replaceAll("'",'&#39;');

const toInt = (v, d=0) => {
  const n = Number(S(v));
  return Number.isFinite(n) ? n : d;
};

const uuid = (p='klas') => `${p}-${Math.random().toString(36).slice(2,8)}-${Date.now().toString(36)}`;

// ===== Opslag (fallback) =====
const LS_KEY = 'superhond-db';
function loadDB(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    const db  = raw ? JSON.parse(raw) : {};
    if (!Array.isArray(db.klassen)) db.klassen = [];
    return db;
  }catch{ return { klassen: [] }; }
}
function saveDB(db){ localStorage.setItem(LS_KEY, JSON.stringify(db)); }
function getKlassenLS(){ return loadDB().klassen; }
function setKlassenLS(arr){
  const db = loadDB();
  db.klassen = Array.isArray(arr) ? arr : [];
  saveDB(db);
}

// ===== Optionele store.js =====
let store = {
  getKlassen: getKlassenLS,
  setKlassen: setKlassenLS,
  ensureMigrated: async () => {}
};
(async () => {
  try {
    const m = await import('../js/store.js'); // optioneel
    store.getKlassen = m.getKlassen || getKlassenLS;
    store.setKlassen = m.setKlassen || setKlassenLS;
    store.ensureMigrated = m.ensureMigrated || (async () => {});
  } catch { /* geen store.js → fallback blijft */ }
})();

// ===== Externe seed =====
async function fetchJson(candidates){
  for (const base of candidates){
    try{
      const url = base + (base.includes('?') ? '&' : '?') + 't=' + Date.now();
      const r = await fetch(url, { cache:'no-store' });
      if (!r.ok) continue;
      return await r.json();
    }catch{}
  }
  return null;
}

// ===== Normalisatie =====
// { id, naam, type, thema, strippen, geldigheid_weken, afbeelding, beschrijving, mailblue, status }
function normalizeKlassen(raw){
  const src =
    Array.isArray(raw) ? raw :
    Array.isArray(raw?.klassen) ? raw.klassen :
    Array.isArray(raw?.classes) ? raw.classes :
    Array.isArray(raw?.items)   ? raw.items :
    Array.isArray(raw?.data)    ? raw.data : [];

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

// Lokaal overschrijft seed (zodat bewerkingen winnen)
function mergeLocalOverSeed(localRows=[], seedRows=[]){
  const key = (x) => S(x.id) || `__name__${S(x.naam)}`;
  const map = new Map(seedRows.map(x => [key(x), x]));   // seed eerst
  for (const loc of localRows) map.set(key(loc), loc);   // lokaal overschrijft
  return [...map.values()];
}

// ===== UI refs =====
const els = {
  form:          $('#formKlas'),
  msg:           $('#msg'),
  id:            $('#klasId'),
  naam:          $('#naam'),
  type:          $('#type'),
  thema:         $('#thema'),
  strippen:      $('#strippen'),
  geldigheid:    $('#geldigheid'),
  status:        $('#status'),
  mailblue:      $('#mailblue'),
  afbeelding:    $('#afbeelding'),
  beschrijving:  $('#beschrijving'),
  imgPreview:    $('#imgPreview'),
  btnSave:       $('#btnSave'),
  btnSaveBack:   $('#btnSaveBack'),
  btnDelete:     $('#btnDelete')
};

function showMsg(text, ok=true){
  if (!els.msg) return;
  els.msg.style.display = '';
  els.msg.className = 'card ' + (ok ? '' : 'error');
  els.msg.textContent = text;
}

function hideMsg(){ if (els.msg) els.msg.style.display = 'none'; }

function fillForm(rec){
  if (els.id)            els.id.value = S(rec.id || '');
  if (els.naam)          els.naam.value = S(rec.naam || '');
  if (els.type)          els.type.value = S(rec.type || '');
  if (els.thema)         els.thema.value = S(rec.thema || '');
  if (els.strippen)      els.strippen.value = Number.isFinite(rec.strippen) ? String(rec.strippen) : '0';
  if (els.geldigheid)    els.geldigheid.value = Number.isFinite(rec.geldigheid_weken) ? String(rec.geldigheid_weken) : '0';
  if (els.status)        els.status.value = (S(rec.status) || 'actief') === 'inactief' ? 'inactief' : 'actief';
  if (els.mailblue)      els.mailblue.value = S(rec.mailblue || '');
  if (els.afbeelding)    els.afbeelding.value = S(rec.afbeelding || '');
  if (els.beschrijving)  els.beschrijving.value = S(rec.beschrijving || '');

  if (els.imgPreview){
    const url = S(rec.afbeelding);
    if (url) { els.imgPreview.src = url; els.imgPreview.style.display = ''; }
    else { els.imgPreview.removeAttribute('src'); els.imgPreview.style.display = 'none'; }
  }
}

function readForm(){
  const rec = {
    id:               S(els.id?.value) || uuid(),
    naam:             S(els.naam?.value),
    type:             S(els.type?.value),
    thema:            S(els.thema?.value),
    strippen:         toInt(els.strippen?.value, 0),
    geldigheid_weken: toInt(els.geldigheid?.value, 0),
    afbeelding:       S(els.afbeelding?.value),
    beschrijving:     S(els.beschrijving?.value),
    mailblue:         S(els.mailblue?.value),
    status:           (S(els.status?.value) || 'actief').toLowerCase()
  };
  return rec;
}

function validate(rec){
  if (!rec.naam) return 'Naam is verplicht.';
  if (rec.strippen < 0) return 'Strippen mag niet negatief zijn.';
  if (rec.geldigheid_weken < 0) return 'Geldigheid (weken) mag niet negatief zijn.';
  return null;
}

// Live preview afbeelding
document.addEventListener('input', (e) => {
  if (e.target === els.afbeelding && els.imgPreview) {
    const url = S(els.afbeelding.value);
    if (url) { els.imgPreview.src = url; els.imgPreview.style.display = ''; }
    else { els.imgPreview.removeAttribute('src'); els.imgPreview.style.display = 'none'; }
  }
});

// Persist (create/update)
function persist(rec){
  const items = store.getKlassen();
  const i = items.findIndex(k => String(k.id) === String(rec.id));
  if (i >= 0) items[i] = { ...items[i], ...rec };
  else items.push(rec);
  store.setKlassen(items);
}

// ===== Init =====
async function init(){
  const qs = new URLSearchParams(location.search);
  const editId = S(qs.get('id'));

  try {
    hideMsg();
    els.btnSave && (els.btnSave.disabled = false);
    els.btnSaveBack && (els.btnSaveBack.disabled = false);

    await store.ensureMigrated();

    const [seedRaw] = await Promise.all([
      fetchJson(['../data/klassen.json','/data/klassen.json'])
    ]);
    const seed = normalizeKlassen(seedRaw);
    const local = normalizeKlassen({ klassen: store.getKlassen() });
    const all = mergeLocalOverSeed(local, seed);

    const rec = editId
      ? all.find(k => String(k.id) === editId)
      : {
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

    if (editId && !rec) {
      showMsg(`Klas met id “${escapeHTML(editId)}” niet gevonden.`, false);
    } else {
      hideMsg();
    }

    fillForm(rec);

    // Submit (Opslaan)
    els.form?.addEventListener('submit', (ev) => {
      ev.preventDefault();
      try {
        els.btnSave && (els.btnSave.disabled = true);
        const data = readForm();
        const err = validate(data);
        if (err) { showMsg(err, false); return; }
        persist(data);
        showMsg('✔️ Klas opgeslagen', true);
        // zet id in URL (bij nieuwe)
        if (!editId) history.replaceState(null, '', `?id=${encodeURIComponent(data.id)}`);
        if (els.id) els.id.value = data.id;
      } finally {
        els.btnSave && (els.btnSave.disabled = false);
      }
    });

    // Opslaan & Terug
    els.btnSaveBack?.addEventListener('click', (ev) => {
      ev.preventDefault();
      els.btnSaveBack.disabled = true;
      try {
        const data = readForm();
        const err = validate(data);
        if (err) { showMsg(err, false); els.btnSaveBack.disabled = false; return; }
        persist(data);
        location.href = './';
      } finally {
        // in geval van error laten we hem weer aan
        els.btnSaveBack.disabled = false;
      }
    });

    // Verwijderen
    els.btnDelete?.addEventListener('click', (ev) => {
      ev.preventDefault();
      const idVal = S(els.id?.value);
      if (!idVal) { showMsg('Kan niet verwijderen: geen id.', false); return; }
      if (!confirm('Deze klas verwijderen?')) return;

      const items = store.getKlassen();
      const next = items.filter(k => String(k.id) !== String(idVal));
      store.setKlassen(next);
      location.href = './';
    });

  } catch (e) {
    console.error('[klassen/bewerken] init error:', e);
    showMsg('⚠️ Kon formulier niet initialiseren. ' + (e?.message || e), false);
  }
}

document.addEventListener('DOMContentLoaded', init);
