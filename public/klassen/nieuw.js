// /public/klassen/nieuw.js
// "Nieuwe klas" → opslaan in localStorage (superhond-db.klassen) en terug naar overzicht
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  // UI mount (topbar/footer)
  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title: 'Nieuwe klas', icon: '📦', back: './' });
    }
  });
import { getKlassen, setKlassen, ensureMigrated } from '../js/store.js';

document.addEventListener('DOMContentLoaded', ensureMigrated);

// ...bij opslaan:
const items = getKlassen();
const i = items.findIndex(x => String(x.id) === String(klas.id));
if (i >= 0) items[i] = klas; else items.push(klas);
setKlassen(items);   // <-- alleen deze bucket
  // ---- DB helpers ----
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
  function saveDB(db) {
    localStorage.setItem('superhond-db', JSON.stringify(db));
  }
  function newId() {
    // eenvoudige unieke id
    return 'klas-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6);
  }

  // ---- Form logic ----
  const form = $('#formNieuw');
  const els = {
    naam:        $('#naam'),
    type:        $('#type'),
    thema:       $('#thema'),
    strippen:    $('#strippen'),
    geldigheid:  $('#geldigheid'),
    status:      $('#status'),
    afbeelding:  $('#afbeelding'),
    beschrijving:$('#beschrijving')
  };

  function toInt(v, fallback = 0) {
    const n = Number(S(v));
    return Number.isFinite(n) ? n : fallback;
  }

  form?.addEventListener('submit', (e) => {
    e.preventDefault();

    // minimale validatie
    if (!S(els.naam.value)) {
      alert('Geef een naam op.'); 
      els.naam.focus();
      return;
    }

    const db = loadDB();

    const rec = {
      id:              newId(),
      naam:            S(els.naam.value),
      type:            S(els.type.value),
      thema:           S(els.thema.value),
      strippen:        toInt(els.strippen.value, 0),           // aantal strippen voor klant
      geldigheid_weken:toInt(els.geldigheid.value, 0),         // geldigheid in weken
      status:          S(els.status.value) || 'actief',        // actief / inactief
      afbeelding:      S(els.afbeelding.value),
      beschrijving:    S(els.beschrijving.value),
      // Voor later uitbreiden:
      // mailblue:     '',    // integratieveld gereserveerd
      createdAt:       new Date().toISOString()
    };

    db.klassen.push(rec);
    saveDB(db);

    // optioneel: kleine bevestiging
    // alert('Klas opgeslagen.');

    // terug naar overzicht
    location.href = './';
  });
})();
