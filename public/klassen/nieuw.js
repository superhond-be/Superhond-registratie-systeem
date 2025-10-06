// /public/klassen/nieuw.js
// v0.22.1 — Nieuwe klas (met optionele store.js integratie + localStorage fallback)

const $ = (s) => document.querySelector(s);
const S = (v) => String(v ?? '').trim();

// ---------- UI helpers ----------
function show(el, on = true) { if (el) el.style.display = on ? '' : 'none'; }
function msg(el, text = '') { if (!el) return; el.textContent = text; show(el, !!text); }
function toInt(v, fallback = 0) {
  const n = Number(S(v));
  return Number.isFinite(n) ? n : fallback;
}
function newId(prefix = 'klas') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ---------- Fallback opslag (localStorage bucket) ----------
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
function getKlassenLS() { return loadDB().klassen; }
function setKlassenLS(arr) {
  const db = loadDB();
  db.klassen = Array.isArray(arr) ? arr : [];
  saveDB(db);
}

// ---------- Optionele store.js (als aanwezig) ----------
let store = {
  getKlassen: getKlassenLS,
  setKlassen: setKlassenLS,
  ensureMigrated: async () => {}
};
(async () => {
  try {
    // Dynamische import — werkt alleen als /public/js/store.js bestaat
    const m = await import('../js/store.js');
    store.getKlassen = m.getKlassen || getKlassenLS;
    store.setKlassen = m.setKlassen || setKlassenLS;
    store.ensureMigrated = m.ensureMigrated || (async () => {});
  } catch {
    // geen store.js — fallback blijft actief
  }
})();

// ---------- Mount topbar/footer ----------
document.addEventListener('DOMContentLoaded', () => {
  if (window.SuperhondUI?.mount) {
    window.SuperhondUI.mount({ title: 'Nieuwe klas', icon: '📚', back: './', showApiStatus: true });
  }
});

// ---------- Form & elementen ----------
const form = $('#formNieuw');
const els = {
  loading:  $('#loading'),
  error:    $('#error'),
  success:  $('#success'),

  naam:         $('#fld-naam') || $('#naam'),
  type:         $('#fld-type') || $('#type'),
  thema:        $('#fld-thema') || $('#thema'),
  strippen:     $('#fld-strippen') || $('#strippen'),
  geldigheid:   $('#fld-geldigheid') || $('#geldigheid'),
  status:       $('#fld-status') || $('#status'),
  afbeelding:   $('#fld-afbeelding') || $('#afbeelding'),
  beschrijving: $('#fld-beschrijving') || $('#beschrijving'),

  btnSave:      $('#btn-save')
};

// ---------- Edit-mode als ?id=… aanwezig ----------
const qs = new URLSearchParams(location.search);
const editId = S(qs.get('id') || '');

// Prefill bij bewerken
async function prefillIfEdit() {
  await store.ensureMigrated();
  if (!editId) return;

  const items = store.getKlassen();
  const rec = items.find(r => String(r.id) === editId);
  if (!rec) return;

  if (els.naam)         els.naam.value = rec.naam || '';
  if (els.type)         els.type.value = rec.type || '';
  if (els.thema)        els.thema.value = rec.thema || '';
  if (els.strippen)     els.strippen.value = rec.strippen ?? 0;
  if (els.geldigheid)   els.geldigheid.value = rec.geldigheid_weken ?? 0;
  if (els.status)       els.status.value = rec.status || 'actief';
  if (els.afbeelding)   els.afbeelding.value = rec.afbeelding || '';
  if (els.beschrijving) els.beschrijving.value = rec.beschrijving || '';
}
prefillIfEdit();

// ---------- Submit ----------
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg(els.error, ''); msg(els.success, ''); show(els.loading, true);
  if (els.btnSave) els.btnSave.disabled = true;

  try {
    // minimumeisen
    if (!S(els.naam?.value)) {
      throw new Error('Geef een naam op.');
    }

    await store.ensureMigrated();

    // record opbouwen
    const rec = {
      id: editId || newId('klas'),
      naam: S(els.naam?.value),
      type: S(els.type?.value),
      thema: S(els.thema?.value),
      strippen: toInt(els.strippen?.value, 0),             // aantal strippen in de reeks
      geldigheid_weken: toInt(els.geldigheid?.value, 0),   // geldig in weken
      status: S(els.status?.value) || 'actief',            // actief / inactief
      afbeelding: S(els.afbeelding?.value),
      beschrijving: S(els.beschrijving?.value),
      createdAt: new Date().toISOString()
    };

    // opslaan (update of nieuw)
    const items = store.getKlassen();
    const i = items.findIndex(x => String(x.id) === rec.id);
    if (i >= 0) items[i] = { ...items[i], ...rec };
    else items.push(rec);
    store.setKlassen(items);

    msg(els.success, editId ? 'Klas bijgewerkt.' : 'Klas opgeslagen.');
    // korte delay voor UX, dan terug
    setTimeout(() => { location.href = './'; }, 600);
  } catch (err) {
    console.error('[klassen/nieuw] fout:', err);
    msg(els.error, '❌ ' + (err?.message || 'Onbekende fout'));
  } finally {
    show(els.loading, false);
    if (els.btnSave) els.btnSave.disabled = false;
  }
});
