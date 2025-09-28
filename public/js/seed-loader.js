/* Superhond – seed loader v0.1
 * Doel: /public/data/seed.json inlezen en
 * - clients/honden in memory beschikbaar maken
 * - optioneel: downloads genereren voor klanten.json & honden.json
 */

(() => {
  const state = {
    klanten: [],
    honden: [],
    loadedAt: null
  };

  const $ = (sel) => document.querySelector(sel);
  const el = {
    status: $('#seed-status'),
    btnImport: $('#seed-import'),
    btnDlK: $('#seed-dl-klanten'),
    btnDlH: $('#seed-dl-honden')
  };

  function setStatus(msg, ok = true) {
    if (!el.status) return;
    el.status.textContent = msg;
    el.status.className = ok ? 'ok' : 'err';
  }

  async function loadSeed() {
    setStatus('Seed laden…');
    try {
      const r = await fetch('/data/seed.json?b=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();

      if (!Array.isArray(j.klanten) || !Array.isArray(j.honden)) {
        throw new Error('seed.json mist velden: klanten[] en/of honden[]');
      }

      state.klanten = j.klanten;
      state.honden = j.honden;
      state.loadedAt = new Date().toISOString();

      // optioneel: zet in localStorage zodat klanten.js/honden.js dit kunnen gebruiken wanneer gewenst
      localStorage.setItem('superhond.seed.klanten', JSON.stringify(state.klanten));
      localStorage.setItem('superhond.seed.honden', JSON.stringify(state.honden));
      localStorage.setItem('superhond.seed.loadedAt', state.loadedAt);

      // enable download knoppen
      if (el.btnDlK) el.btnDlK.disabled = false;
      if (el.btnDlH) el.btnDlH.disabled = false;

      setStatus(`Seed geladen ✓  (klanten: ${state.klanten.length}, honden: ${state.honden.length})`);
    } catch (e) {
      console.error(e);
      setStatus('Fout bij laden van seed.json — check pad/JSON', false);
    }
  }

  function downloadJSON(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = filename;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  }

  function exportKlanten() {
    if (!state.klanten.length) return setStatus('Geen klanten in geheugen — importeer eerst.', false);
    downloadJSON('klanten.json', state.klanten);
  }

  function exportHonden() {
    if (!state.honden.length) return setStatus('Geen honden in geheugen — importeer eerst.', false);
    downloadJSON('honden.json', state.honden);
  }

  // expose voor andere modules (optioneel)
  window.SuperhondSeed = {
    load: loadSeed,
    getKlanten: () => state.klanten.slice(),
    getHonden: () => state.honden.slice(),
    loadedAt: () => state.loadedAt,
    exportKlanten,
    exportHonden
  };

  // events (indien knoppen aanwezig zijn)
  if (el.btnImport) el.btnImport.addEventListener('click', loadSeed);
  if (el.btnDlK) el.btnDlK.addEventListener('click', exportKlanten);
  if (el.btnDlH) el.btnDlH.addEventListener('click', exportHonden);
})();
