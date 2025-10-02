// Bewerken van een klas
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title:'Klas – Bewerken', icon:'✏️', back:'./' });
    }
  });

  function loadDB(){
    try {
      const raw = localStorage.getItem('superhond-db');
      const db  = raw ? JSON.parse(raw) : {};
      db.classes = Array.isArray(db.classes) ? db.classes : [];
      return db;
    }catch { return { classes: [] }; }
  }
  function saveDB(db){ localStorage.setItem('superhond-db', JSON.stringify(db)); }

  async function init(){
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    const db = loadDB();
    const klas = db.classes.find(c => String(c.id) === String(id));

    if (!klas){
      alert(`Klas met id ${id} niet gevonden.`);
      location.href = './';
      return;
    }

    // velden vullen
    $('#naam').value        = klas.naam || '';
    $('#type').value        = klas.type || '';
    $('#thema').value       = klas.thema || '';
    $('#strippen').value    = klas.strippen || 0;
    $('#geldigheid').value  = klas.geldigheidsduur || 0;
    $('#status').value      = klas.status || 'actief';
    $('#afbeelding').value  = klas.afbeelding || '';
    $('#beschrijving').value= klas.beschrijving || '';

    // submit
    $('#formKlas').addEventListener('submit', e => {
      e.preventDefault();

      klas.naam            = S($('#naam').value);
      klas.type            = S($('#type').value);
      klas.thema           = S($('#thema').value);
      klas.strippen        = Number($('#strippen').value) || 0;
      klas.geldigheidsduur = Number($('#geldigheid').value) || 0;
      klas.status          = S($('#status').value);
      klas.afbeelding      = S($('#afbeelding').value);
      klas.beschrijving    = S($('#beschrijving').value);

      saveDB(db);
      alert('Klas opgeslagen ✅');
      location.href = './detail.html?id=' + encodeURIComponent(klas.id);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
