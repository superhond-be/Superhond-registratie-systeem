// /public/js/honden.js
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
    const res = await fetch('/data/honden.json?b=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const honden = await res.json();

    tbody.innerHTML = honden.length
      ? honden.map(h => `
          <tr>
            <td>${h.naam ?? ''}</td>
            <td>${h.ras ?? ''}</td>
            <td>${h.geboorte || h.geboortedatum || ''}</td>
            <td>${h.eigenaar ?? h.klantNaam ?? ''}</td>
          </tr>`).join('')
      : `<tr><td colspan="4" style="text-align:center;color:#888">Geen honden…</td></tr>`;

    setStatus(`Geladen: ${honden.length} honden ✔️`);
  } catch (e) {
    setStatus('❌ Kon honden niet laden (' + e.message + ')', false);
    tbody.innerHTML = `<tr><td colspan="4">Fout bij laden.</td></tr>`;
    console.error(e);
  }
});
