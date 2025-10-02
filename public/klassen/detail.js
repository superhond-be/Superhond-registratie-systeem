// Detail van een klas
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title:'Klas – Detail', icon:'🏷️', back:'./' });
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

  async function init(){
    const params = new URLSearchParams(location.search);
    const id = params.get('id');

    const info = $('#info');
    const msg  = $('#msg');

    const db = loadDB();
    const klas = db.classes.find(c => String(c.id) === String(id));

    if (!klas){
      msg.style.display = '';
      msg.className = 'card error';
      msg.textContent = `⚠️ Klas met id ${id} niet gevonden.`;
      info.innerHTML = '';
      return;
    }

    msg.style.display = 'none';

    info.innerHTML = `
      <h2 style="margin-top:0">${S(klas.naam)}</h2>
      <div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px">
        <div><strong>Type:</strong> ${S(klas.type)}</div>
        <div><strong>Thema:</strong> ${S(klas.thema)}</div>
        <div><strong>Aantal strippen:</strong> ${klas.strippen || 0}</div>
        <div><strong>Geldigheidsduur:</strong> ${klas.geldigheidsduur || 0} weken</div>
        <div><strong>Status:</strong> ${S(klas.status || '—')}</div>
      </div>

      <div style="margin-top:12px">
        <strong>Beschrijving:</strong><br>
        <p>${S(klas.beschrijving || '—')}</p>
      </div>

      ${klas.afbeelding ? `<img src="${S(klas.afbeelding)}" alt="Afbeelding van ${S(klas.naam)}" style="max-width:200px;margin-top:12px">` : ''}
    `;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
