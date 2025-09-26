(async function () {
  const $ = s => document.querySelector(s);
  const log = (...a) => { try { console.log('[Klant]', ...a); } catch {} };

  const TBL = $('#klanten-tabel');        // <table id="klanten-tabel">
  const STATUS = $('#klantenStatus');     // <div id="klantenStatus">
  const LAND_FILTER = $('#filterLand');   // <select id="filterLand">
  const MIN_HONDEN = $('#filterMinHonden'); // <input id="filterMinHonden">
  const SEARCH = $('#filterZoek');        // <input id="filterZoek">

  function showError(msg, detail) {
    if (STATUS) STATUS.innerHTML =
      `<div class="form-card" style="border-left:4px solid #d83a3a">
         <b>Kon demo-data niet laden:</b> ${msg}<br>
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
    tbody.innerHTML = items.map(k => {
      const honden = (k.honden || []).length;
      const plaats = [k.postcode, k.plaats].filter(Boolean).join(' ');
      return `<tr>
        <td>${(k.voornaam || '')} ${(k.achternaam || '')}</td>
        <td>${k.email || ''}</td>
        <td>${plaats || ''}</td>
        <td style="text-align:right">${honden}</td>
        <td></td>
      </tr>`;
    }).join('') || `<tr><td colspan="5" class="sub">Geen resultaten…</td></tr>`;
  }

  function applyFilters(data) {
    const zoek = (SEARCH?.value || '').toLowerCase().trim();
    const minH = parseInt(MIN_HONDEN?.value || '0', 10) || 0;
    const land = LAND_FILTER?.value || '';

    return data.filter(k => {
      if (land && land !== 'ALL' && (k.land || '').toLowerCase() !== land.toLowerCase()) return false;
      const count = (k.honden || []).length;
      if (count < minH) return false;
      if (zoek) {
        const hay = [k.voornaam, k.achternaam, k.email].join(' ').toLowerCase();
        if (!hay.includes(zoek)) return false;
      }
      return true;
    });
  }

  try {
    if (STATUS) STATUS.textContent = 'Demo-data laden…';
    // pad is absoluut omdat /public de webroot is
    const klanten = await loadJson('/data/klanten.json');

    // Normaliseer velden een tikje, maar raak datums niet aan (Safari is streng)
    const norm = klanten.map(k => ({
      id: k.id || '',
      voornaam: k.voornaam || '',
      achternaam: k.achternaam || '',
      email: k.email || '',
      land: k.land || '',
      postcode: k.postcode || '',
      plaats: k.plaats || '',
      honden: Array.isArray(k.honden) ? k.honden : []
    }));

    const update = () => renderRows(applyFilters(norm));
    [SEARCH, MIN_HONDEN, LAND_FILTER].forEach(el => el && el.addEventListener('input', update));
    update();

    if (STATUS) STATUS.textContent = `Geladen: ${norm.length} klanten ✓`;
    log('OK', norm);
  } catch (e) {
    log('ERR', e);
    showError(e.message || 'Onbekende fout', 'Controleer /data/klanten.json & netwerk');
    if (STATUS) STATUS.classList.add('sub');
  }
})();
