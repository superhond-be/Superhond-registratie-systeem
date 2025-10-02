// Nieuwe klas toevoegen
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title:'Nieuwe klas', icon:'➕', back:'./' });
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

  function uuid(){
    return 'klas-' + Math.random().toString(36).slice(2,9);
  }

  async function init(){
    $('#formNieuw').addEventListener('submit', e => {
      e.preventDefault();

      const db = loadDB();
      const nieuw = {
        id: uuid(),
        naam: S($('#naam').value),
        type: S($('#type').value),
        thema: S($('#thema').value),
        strippen: Number($('#strippen').value) || 0,
        geldigheidsduur: Number($('#geldigheid').value) || 0,
        status: S($('#status').value),
        afbeelding: S($('#afbeelding').value),
        beschrijving: S($('#beschrijving').value)
      };
      db.classes.push(nieuw);
      saveDB(db);

      alert('Nieuwe klas toegevoegd ✅');
      location.href = './detail.html?id=' + encodeURIComponent(nieuw.id);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
