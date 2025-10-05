/* v0.19.0 – Hondenlijst via Google Apps Script API (i.p.v. /data/*.json) */
(async () => {
  // 👇 jouw Apps Script Web-App URL (/exec)
  const API_BASE = "https://script.google.com/macros/s/AKfycbzZP5jnYyjzOzrXaZfg1KL5UMqBFXVfIyyC14YYsyCaVbREPdAQPm_cxVvagM-0nP3cWg/exec";

  const body   = document.querySelector('#honden-tbody');
  const meta   = document.querySelector('#honden-meta');
  const loader = document.querySelector('#honden-loader');
  const err    = document.querySelector('#honden-error');

  const showLoader = v => { if (loader) loader.hidden = !v; };
  const showErr = m => { if (err){ err.textContent = m; err.hidden = false; } };

  async function apiGet(mode, params = {}) {
    const usp = new URLSearchParams({ mode, t: Date.now(), ...params });
    const res = await fetch(`${API_BASE}?${usp.toString()}`, { method: 'GET' });
    const txt = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let j; try { j = JSON.parse(txt); } catch { throw new Error('Geen geldige JSON (check ?mode)'); }
    if (!j.ok) throw new Error(j.error || 'Onbekende fout');
    return j.data; // array uit de Sheet
  }

  // Normalisatie helpers (Sheet → UI-model)
  function normKlant(k) {
    const full = String(k.naam || '').trim();
    const [voornaam, ...rest] = full.split(/\s+/);
    const achternaam = rest.join(' ');
    let plaats = '';
    if (k.adres) {
      const parts = String(k.adres).split(',');
      plaats = (parts[1] || parts[0] || '').trim();
    }
    return { id: k.id || '', voornaam, achternaam, plaats };
  }
  function normHond(h) {
    return {
      id: h.id || '',
      eigenaarId: h.eigenaar_id || h.eigenaarId || '',
      naam: h.naam || '',
      ras: h.ras || '',
      geboortedatum: h.geboortedatum || ''
    };
  }

  try {
    showLoader(true);

    // 👉 rechtstreeks naar je Apps Script back-end
    const [dogsRaw, klantenRaw] = await Promise.all([
      apiGet('honden'),
      apiGet('klanten')
    ]);

    const dogs = dogsRaw.map(normHond);
    const klanten = klantenRaw.map(normKlant);
    const kById = Object.fromEntries(klanten.map(k => [k.id, k]));

    body.innerHTML = dogs.map(h => {
      const e = kById[h.eigenaarId];
      const eigenaarNaam = e ? `${e.voornaam || ''} ${e.achternaam || ''}`.trim() : '—';
      const plaats = e?.plaats || '';
      return `
        <tr>
          <td><a href="/honden/detail.html?id=${h.id}"><strong>${h.naam || '—'}</strong></a></td>
          <td>${h.ras || '—'}</td>
          <td>${h.geboortedatum || '—'}</td>
          <td>${
            e
              ? `<a href="/klanten/detail.html?id=${e.id}">${eigenaarNaam || '(naam onbekend)'}</a> <small class="muted">${plaats}</small>`
              : '—'
          }</td>
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
