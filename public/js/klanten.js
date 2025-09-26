// /public/js/klanten.js — Klantenlijst met honden-telling + filters
(function () {
  // --- Elementen ---
  const TBL_BODY   = document.querySelector('#klantenTable tbody');
  const STATUS_EL  = document.getElementById('dataStatus');
  const zoekInput  = document.getElementById('zoekInput');
  const minDogs    = document.getElementById('minDogs');
  const landFilter = document.getElementById('landFilter');

  // --- Data buffers ---
  let KLANTEN = [];
  let HONDEN  = [];
  let HONDEN_PER_KLANT = {};

  // --- Helpers ---
  const setStatus = (txt, ok = true) => {
    if (!STATUS_EL) return;
    STATUS_EL.textContent = txt;
    STATUS_EL.style.color = ok ? '#1f2328' : '#b42318';
  };

  const keyName = k => `${k.voornaam || ''} ${k.achternaam || ''}`.trim();
  const fmtPlaats = k => [k.postcode, k.plaats].filter(Boolean).join(' ');

  const buildHondenTeller = () => {
    HONDEN_PER_KLANT = HONDEN.reduce((acc, h) => {
      const id = h.klantId;
      if (!id) return acc;
      acc[id] = (acc[id] || 0) + 1;
      return acc;
    }, {});
  };

  // --- Loaders ---
  const loadJson = async (url) => {
    const r = await fetch(url + '?b=' + Date.now());
    if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
    return r.json();
  };

  const initData = async () => {
    setStatus('Data laden…');
    try {
      // Absolute paden, want we zitten op /klanten/
      const [k, h] = await Promise.all([
        loadJson('/data/klanten.json'),
        loadJson('/data/honden.json'),
      ]);
      KLANTEN = Array.isArray(k) ? k : [];
      HONDEN  = Array.isArray(h) ? h : [];
      buildHondenTeller();
      setStatus(`Geladen: ${KLANTEN.length} klanten, ${HONDEN.length} honden ✔️`);
    } catch (e) {
      setStatus('❌ Kon demo-data niet laden: ' + e.message, false);
      KLANTEN = [];
      HONDEN  = [];
      HONDEN_PER_KLANT = {};
    }
  };

  // --- Filtering + Render ---
  const getFiltered = () => {
    const zoek = (zoekInput?.value || '').toLowerCase();
    const min  = parseInt(minDogs?.value || '0', 10);
    const land = landFilter?.value || '';

    return KLANTEN.filter(k => {
      const naam  = keyName(k).toLowerCase();
      const mail  = (k.email || '').toLowerCase();
      const dogs  = HONDEN_PER_KLANT[k.id] || 0;

      const matchZoek = naam.includes(zoek) || mail.includes(zoek);
      const matchDogs = dogs >= min;
      const matchLand = !land || k.land === land;

      return matchZoek && matchDogs && matchLand;
    });
  };

  const render = () => {
    if (!TBL_BODY) return;
    const data = getFiltered();

    TBL_BODY.innerHTML = data.map(k => {
      const dogs = HONDEN_PER_KLANT[k.id] || 0;
      return `
        <tr>
          <td>${keyName(k)}<div class="sub">${k.land || ''}</div></td>
          <td>${k.email || ''}</td>
          <td>${fmtPlaats(k)}</td>
          <td style="text-align:center">${dogs}</td>
          <td>
            <button class="btn btn-small" data-edit="${k.id}">✏️ Bewerken</button>
            <button class="btn btn-small" data-del="${k.id}">🗑️ Verwijderen</button>
          </td>
        </tr>
      `;
    }).join('') || `
      <tr>
        <td colspan="5" style="text-align:center;color:#888">Geen resultaten…</td>
      </tr>
    `;
  };

  // --- Events ---
  [zoekInput, minDogs, landFilter].forEach(el => el && el.addEventListener('input', render));

  // --- Init ---
  (async function start() {
    await initData();
    render();
  })();
})();
