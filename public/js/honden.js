/* v0.18.9 – Hondenlijst met klikbare eigenaar + link naar honddetail */
(async () => {
  const body   = document.querySelector('#honden-tbody');
  const meta   = document.querySelector('#honden-meta');
  const loader = document.querySelector('#honden-loader');
  const err    = document.querySelector('#honden-error');

  const showLoader = v => { if (loader) loader.hidden = !v; };
  const showErr = m => { if (err){ err.textContent = m; err.hidden = false; } };

  try {
    showLoader(true);
    const [hRes, kRes] = await Promise.all([
      fetch('/data/honden.json?b='+Date.now(), {cache:'no-store'}),
      fetch('/data/klanten.json?b='+Date.now(), {cache:'no-store'})
    ]);
    if (!hRes.ok || !kRes.ok) throw new Error('Kon data niet laden');

    const [dogs, klanten] = await Promise.all([hRes.json(), kRes.json()]);
    const kById = Object.fromEntries(klanten.map(k => [k.id, k]));

    body.innerHTML = dogs.map(h => {
      const e = kById[h.eigenaarId];
      const eigenaarNaam = e ? `${e.voornaam} ${e.achternaam}` : '—';
      const plaats = e?.plaats || '';
      return `
        <tr>
          <td><a href="/honden/detail.html?id=${h.id}"><strong>${h.naam}</strong></a></td>
          <td>${h.ras || '—'}</td>
          <td>${h.geboortedatum || '—'}</td>
          <td>${e
              ? `<a href="/klanten/detail.html?id=${e.id}">${eigenaarNaam}</a> <small class="muted">${plaats}</small>`
              : '—'}</td>
        </tr>`;
    }).join('');

    if (meta) meta.textContent = `Geladen: ${dogs.length} honden ✓`;
    showLoader(false);
  } catch (e) {
    console.error(e);
    showLoader(false);
    showErr('Fout bij laden van honden.');
  }
})();
