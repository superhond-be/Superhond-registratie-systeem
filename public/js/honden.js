(async function () {
  const $ = s => document.querySelector(s);
  const STATUS = $('#hondenStatus');   // <div id="hondenStatus">
  const TBL = $('#honden-tabel');      // <table id="honden-tabel">

  function showError(msg, detail) {
    if (STATUS) STATUS.innerHTML =
      `<div class="form-card" style="border-left:4px solid #d83a3a">
         <b>Kon honden niet laden:</b> ${msg}<br>
         <span class="sub">${detail || ''}</span>
       </div>`;
  }

  async function loadJson(url) {
    const u = `${url}${url.includes('?') ? '&' : '?'}b=${Date.now()}`;
    const r = await fetch(u);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  function renderRows(items) {
    const tbody = TBL && TBL.tBodies[0];
    if (!tbody) return;
    tbody.innerHTML = items.map(h => `
      <tr>
        <td>${h.naam || ''}</td>
        <td>${h.ras || ''}</td>
        <td>${h.geboortedatum || ''}</td>
        <td>${h.eigenaar || ''}</td>
      </tr>
    `).join('') || `<tr><td colspan="4" class="sub">Geen resultaten…</td></tr>`;
  }

  try {
    if (STATUS) STATUS.textContent = 'Demo-data laden…';
    const honden = await loadJson('/data/honden.json');

    const norm = honden.map(h => ({
      naam: h.naam || '',
      ras: h.ras || '',
      geboortedatum: h.geboortedatum || '',  // laat string ongemoeid
      eigenaar: h.eigenaar || ''
    }));

    renderRows(norm);
    if (STATUS) STATUS.textContent = `Geladen: ${norm.length} honden ✓`;
  } catch (e) {
    showError(e.message || 'Onbekende fout', 'Controleer /data/honden.json & netwerk');
  }
})();
