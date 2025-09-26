// Honden: laad honden + klanten en toon gekoppelde eigenaar
document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('hondenStatus');
  const tbody = document.querySelector('#honden-tabel tbody');

  const setStatus = (msg, ok = true) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = ok ? '#1f2328' : '#b42318';
  };

  try {
    setStatus('Honden laden…');

    // Laad beide datasets (absolute paden om caching/pad-issues te vermijden)
    const [resHonden, resKlanten] = await Promise.all([
      fetch('/data/honden.json?b=' + Date.now()),
      fetch('/data/klanten.json?b=' + Date.now())
    ]);
    if (!resHonden.ok) throw new Error('Kon honden.json niet laden (HTTP ' + resHonden.status + ')');
    if (!resKlanten.ok) throw new Error('Kon klanten.json niet laden (HTTP ' + resKlanten.status + ')');

    const [honden, klanten] = await Promise.all([resHonden.json(), resKlanten.json()]);

    // Map klanten op id → weergavenaam
    const klantNaam = new Map(
      klanten.map(k => [k.id, `${k.voornaam} ${k.achternaam}`.trim()])
    );

    // Render tabel
    tbody.innerHTML = honden.length
      ? honden.map(h => {
          const eigenaar = klantNaam.get(h.klantId) || '—';
          return `
            <tr>
              <td>${h.naam ?? ''}</td>
              <td>${h.ras ?? ''}</td>
              <td>${h.geboorte || h.geboortedatum || ''}</td>
              <td>${eigenaar}</td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="4" style="text-align:center;color:#888">Geen honden…</td></tr>`;

    setStatus(`Geladen: ${honden.length} honden ✔️`);
  } catch (e) {
    console.error(e);
    setStatus('❌ Kon honden niet laden: ' + e.message, false);
    if (tbody) tbody.innerHTML = `<tr><td colspan="4">Fout bij laden.</td></tr>`;
  }
});
