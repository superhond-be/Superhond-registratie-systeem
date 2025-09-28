/* v0.18.7 – Hondenlijst (Superhond UI) */
(async () => {
  const body   = document.querySelector('#honden-tbody');
  const meta   = document.querySelector('#honden-meta');
  const loader = document.querySelector('#honden-loader');
  const err    = document.querySelector('#honden-error');

  const showLoader = v => loader.hidden = !v;
  const showErr = m => { err.textContent = m; err.hidden = false; };

  try {
    showLoader(true);
    const [hRes, kRes] = await Promise.all([
      fetch('/data/honden.json',  { cache:'no-store' }),
      fetch('/data/klanten.json', { cache:'no-store' })
    ]);
    if (!hRes.ok || !kRes.ok) throw new Error('Kon data niet laden');

    const [dogs, klanten] = await Promise.all([hRes.json(), kRes.json()]);
    const kById = Object.fromEntries(klanten.map(k => [k.id, k]));

    body.innerHTML = dogs.map(h => {
      const e = kById[h.eigenaarId];
      const eigenaar = e ? `${e.voornaam} ${e.achternaam}` : '—';
      const plaats = e?.plaats ? `<small class="muted"> ${e.plaats}</small>` : '';
      return `<tr>
        <td><strong>${h.naam}</strong></td>
        <td>${h.ras}</td>
        <td>${h.geboortedatum}</td>
        <td>${eigenaar}${plaats}</td>
      </tr>`;
    }).join('');

    meta.textContent = `Geladen: ${dogs.length} honden ✓`;
    showLoader(false);
  } catch (e) {
    console.error(e);
    showLoader(false);
    showErr('Fout bij laden van honden.');
  }
})();
