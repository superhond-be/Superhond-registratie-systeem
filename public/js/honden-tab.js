// public/js/honden-tab.js — v0.27.6
import { initFromConfig, fetchSheet, saveHond } from './sheets.js';

export async function initHondenTab() {
  console.log('[honden-tab] Initialisatie gestart');
  const stateEl = document.getElementById('state-hond');
  const tableBody = document.querySelector('#tbl-hond tbody');
  const refreshBtn = document.getElementById('refresh-hond');
  const searchInput = document.getElementById('search-hond');
  const form = document.getElementById('form-add-hond');
  const msgEl = document.getElementById('form-msg-hond');

  let honden = [];

  function renderTable(data) {
    tableBody.innerHTML = '';
    if (!data?.length) {
      tableBody.innerHTML = `<tr><td colspan="5" class="muted">Geen honden gevonden.</td></tr>`;
      return;
    }
    for (const hond of data) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${hond.naam || ''}</td>
        <td>${hond.ras || ''}</td>
        <td>${hond.geboortedatum || ''}</td>
        <td>${hond.eigenaar_id || ''}</td>
        <td><button class="btn small">✏️</button></td>
      `;
      tableBody.appendChild(tr);
    }
  }

  async function loadData() {
    try {
      stateEl.textContent = '⏳ Laden…';
      await initFromConfig();
      const rows = await fetchSheet('Honden');
      honden = rows;
      renderTable(honden);
      stateEl.textContent = `✅ ${rows.length} honden geladen`;
    } catch (err) {
      console.error('[honden-tab] Fout bij laden:', err);
      stateEl.textContent = '❌ Fout bij laden';
    }
  }

  refreshBtn.addEventListener('click', loadData);

  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = honden.filter(h =>
      (h.naam || '').toLowerCase().includes(term) ||
      (h.chip || '').toLowerCase().includes(term)
    );
    renderTable(filtered);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      msgEl.textContent = '💾 Opslaan…';
      await saveHond(data);
      msgEl.textContent = '✅ Opgeslagen!';
      form.reset();
      await loadData();
    } catch (err) {
      console.error('[honden-tab] Opslaan mislukt:', err);
      msgEl.textContent = '❌ Fout bij opslaan';
    }
  });

  // Eerste load
  await loadData();
  console.log('[honden-tab] Init voltooid');
}
