/*
 * public/js/strippenkaarten.js — met actieknoppen
 */

import {
  initFromConfig,
  fetchSheet,
  postAction
} from './sheets.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const collator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });

let alleKaarten = [];

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
  );
}

function toArrayRows(x) {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  if (x && Array.isArray(x.rows)) return x.rows;
  if (x && Array.isArray(x.result)) return x.result;
  return [];
}

function normalize(row) {
  const o = {};
  for (const [k, v] of Object.entries(row || {})) {
    o[String(k || '').toLowerCase()] = v;
  }
  return {
    id:        (o.id ?? '').toString(),
    klant:     (o.klant ?? '').toString(),
    type:      (o.type ?? '').toString(),
    credits:   (o.credits ?? '').toString(),
    gebruikt:  (o.gebruikt ?? '').toString(),
    geldig:    (o.geldig_tot ?? o.geldig ?? '').toString(),
    status:    (o.status ?? '').toString()
  };
}

function renderKaarten(statusVal = 'ALL') {
  const tb = $('#s-tbody');
  const count = $('#s-count');
  const status = (statusVal || '').toLowerCase();
  let rows = alleKaarten;

  if (status && status !== 'all') {
    rows = rows.filter(k => (k.status || '').toLowerCase() === status);
  }

  tb.innerHTML = '';
  if (!rows.length) {
    tb.innerHTML = `<tr><td colspan="7" class="muted">Geen kaarten gevonden</td></tr>`;
  } else {
    const frag = document.createDocumentFragment();
    for (const k of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(k.klant)}</td>
        <td>${escapeHtml(k.type)}</td>
        <td>${escapeHtml(k.credits)}</td>
        <td>${escapeHtml(k.gebruikt)}</td>
        <td>${escapeHtml(k.geldig)}</td>
        <td>${escapeHtml(k.status)}</td>
        <td class="nowrap">
          <button class="btn btn-xs act-view" data-id="${escapeHtml(k.id)}" title="Bekijken">🔍</button>
          <button class="btn btn-xs act-edit" data-id="${escapeHtml(k.id)}" title="Wijzigen">✏️</button>
          <button class="btn btn-xs act-del"  data-id="${escapeHtml(k.id)}" title="Verwijderen">🗑️</button>
        </td>`;
      frag.appendChild(tr);
    }
    tb.appendChild(frag);
  }
  count.textContent = `${rows.length} kaart${rows.length === 1 ? '' : 'en'}`;
}

function wireActions() {
  const tb = $('#s-tbody');
  if (!tb) return;
  tb.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.classList.contains('act-view')) openView(id);
    else if (btn.classList.contains('act-edit')) openEdit(id);
    else if (btn.classList.contains('act-del')) confirmDelete(id);
  });
}

function openView(id) {
  const k = alleKaarten.find(x => x.id === id);
  if (!k) {
    alert('Kaart niet gevonden');
    return;
  }
  let html = `
    <div><strong>Klant:</strong> ${escapeHtml(k.klant)}</div>
    <div><strong>Type:</strong> ${escapeHtml(k.type)}</div>
    <div><strong>Credits:</strong> ${escapeHtml(k.credits)}</div>
    <div><strong>Gebruikt:</strong> ${escapeHtml(k.gebruikt)}</div>
    <div><strong>Geldig tot:</strong> ${escapeHtml(k.geldig)}</div>
    <div><strong>Status:</strong> ${escapeHtml(k.status)}</div>
  `;
  // gebruik modal zoals eerder in klassen/lessen
  // modal(html, { title: 'Strippenkaart bekijken' });
  alert(html); // tijdelijk
}

function openEdit(id) {
  const k = alleKaarten.find(x => x.id === id);
  if (!k) {
    alert('Kaart niet gevonden');
    return;
  }
  let html = `
    <form id="edit-form">
      <div><label>Klant <input name="klant" value="${escapeHtml(k.klant)}" /></label></div>
      <div><label>Type <input name="type" value="${escapeHtml(k.type)}" /></label></div>
      <div><label>Credits <input name="credits" value="${escapeHtml(k.credits)}" /></label></div>
      <div><label>Gebruikt <input name="gebruikt" value="${escapeHtml(k.gebruikt)}" /></label></div>
      <div><label>Geldig tot <input name="geldig" value="${escapeHtml(k.geldig)}" /></label></div>
      <div>
        <label>Status
          <select name="status">
            <option value="actief" ${k.status === 'actief' ? 'selected' : ''}>actief</option>
            <option value="vol" ${k.status === 'vol' ? 'selected' : ''}>vol</option>
            <option value="verlopen" ${k.status === 'verlopen' ? 'selected' : ''}>verlopen</option>
          </select>
        </label>
      </div>
      <div style="margin-top:1em;">
        <button data-close="1" type="button">Annuleren</button>
        <button type="submit">Opslaan</button>
      </div>
    </form>
  `;
  // modal(html, { title: 'Strippenkaart bewerken' });
  alert('Edit form:\n' + html); // placeholder
}

function confirmDelete(id) {
  if (!confirm('Weet je zeker dat je deze kaart wilt verwijderen?')) return;
  deleteKaart(id);
}

async function deleteKaart(id) {
  try {
    await postAction('strippenkaart', 'delete', { id });
    alleKaarten = alleKaarten.filter(k => k.id !== id);
    renderKaarten($('#status')?.value || 'ALL');
  } catch (err) {
    alert('Verwijderen mislukt: ' + (err?.message || err));
  }
}

// Boot
document.addEventListener('DOMContentLoaded', async () => {
  await initFromConfig();
  $('#status')?.addEventListener('change', e => renderKaarten(e.target.value));

  wireActions();
  renderKaarten('ALL');

  try {
    const raw = await fetchSheet('Strippenkaarten');
    const rows = toArrayRows(raw);
    alleKaarten = rows.map(normalize);
    renderKaarten($('#status')?.value || 'ALL');
  } catch (err) {
    const errEl = $('#s-error');
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = '❌ Fout laden: ' + (err?.message || err);
    }
  }
});
