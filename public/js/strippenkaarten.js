/**
 * public/js/strippenkaarten.js — met modal acties & validatie
 */

import {
  initFromConfig,
  fetchSheet,
  postAction
} from './sheets.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const collator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });

let alleKaarten = [];

// ─── Helpers ───
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])
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

// ─── Rendering ───
function renderKaarten(statusVal = 'ALL') {
  const tb = $('#s-tbody');
  const countEl = $('#s-count');
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
  countEl.textContent = `${rows.length} kaart${rows.length === 1 ? '' : 'en'}`;
}

// ─── Modals ───
function ensureModalRoot() {
  let root = document.getElementById('modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'modal-root';
    document.body.appendChild(root);
  }
  return root;
}

function closeModal() {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
}

function modal(contentHTML, { title = '' } = {}) {
  ensureModalRoot();
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="sh-overlay" data-close="1" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="sh-modal">
        <div class="sh-head">
          <span>${escapeHtml(title)}</span>
          <button class="sh-close" type="button" data-close="1">✕</button>
        </div>
        <div class="sh-body">${contentHTML}</div>
      </div>
    </div>`;
  root.querySelector('.sh-overlay').addEventListener('click', (e) => {
    if (e.target?.dataset?.close === '1') closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  }, { once: true });
}

// ─── Actiehandlers ───
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

// Bekijken
function openView(id) {
  const k = alleKaarten.find(x => x.id === id);
  if (!k) {
    alert('Kaart niet gevonden');
    return;
  }
  const html = `
    <div><strong>Klant:</strong> ${escapeHtml(k.klant)}</div>
    <div><strong>Type:</strong> ${escapeHtml(k.type)}</div>
    <div><strong>Credits:</strong> ${escapeHtml(k.credits)}</div>
    <div><strong>Gebruikt:</strong> ${escapeHtml(k.gebruikt)}</div>
    <div><strong>Geldig tot:</strong> ${escapeHtml(k.geldig)}</div>
    <div><strong>Status:</strong> ${escapeHtml(k.status)}</div>
  `;
  modal(html, { title: 'Strippenkaart bekijken' });
}

// Bewerken
function openEdit(id) {
  const k = alleKaarten.find(x => x.id === id);
  if (!k) {
    alert('Kaart niet gevonden');
    return;
  }
  const html = `
    <form id="edit-form">
      <div class="row"><div class="key">Klant</div><div><input name="klant" value="${escapeHtml(k.klant)}" required></div></div>
      <div class="row"><div class="key">Type</div><div><input name="type" value="${escapeHtml(k.type)}"></div></div>
      <div class="row"><div class="key">Credits</div><div><input name="credits" value="${escapeHtml(k.credits)}"></div></div>
      <div class="row"><div class="key">Gebruikt</div><div><input name="gebruikt" value="${escapeHtml(k.gebruikt)}"></div></div>
      <div class="row"><div class="key">Geldig tot</div><div><input name="geldig" value="${escapeHtml(k.geldig)}"></div></div>
      <div class="row"><div class="key">Status</div><div>
        <select name="status">
          <option value="actief" ${k.status === 'actief' ? 'selected' : ''}>actief</option>
          <option value="vol" ${k.status === 'vol' ? 'selected' : ''}>vol</option>
          <option value="verlopen" ${k.status === 'verlopen' ? 'selected' : ''}>verlopen</option>
        </select>
      </div></div>
      <div class="sh-foot" style="margin-top:1rem;">
        <button type="button" data-close="1">Annuleren</button>
        <button type="submit">Opslaan</button>
      </div>
    </form>
  `;
  modal(html, { title: 'Strippenkaart bewerken' });

  const form = document.getElementById('edit-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      id,
      klant:    String(fd.get('klant') || '').trim(),
      type:     String(fd.get('type') || '').trim(),
      credits:  String(fd.get('credits') || '').trim(),
      gebruikt: String(fd.get('gebruikt') || '').trim(),
      geldig:   String(fd.get('geldig') || '').trim(),
      status:   String(fd.get('status') || '').trim(),
    };

    // eenvoudige validatie
    if (!payload.klant) {
      alert('Klant is verplicht');
      return;
    }

    try {
      await postAction('strippenkaart', 'update', payload);
      // update lokaal object
      Object.assign(k, normalize(payload));
      renderKaarten($('#status')?.value || 'ALL');
      closeModal();
    } catch (err) {
      alert('Opslaan mislukt: ' + (err?.message || err));
    }
  });
}

// Verwijderen
function confirmDelete(id) {
  if (!confirm('Weet je zeker dat je deze kaart wilt verwijderen?')) return;
  deleteKaart(id);
}

async function deleteKaart(id) {
  try {
    await postAction('strippenkaart', 'delete', { id });
    alleKaarten = alleKaarten.filter(k => k.id !== id);
    renderKaarten($('#status')?.value || 'ALL');
    closeModal();
  } catch (err) {
    alert('Verwijderen mislukt: ' + (err?.message || err));
  }
}

// ─── Boot / init ───
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Strippenkaarten] Initialiseren');
  await initFromConfig();
  $('#status')?.addEventListener('change', e => renderKaarten(e.target.value));

  wireActions();
  renderKaarten('ALL');

  try {
    const raw = await fetchSheet('Strippenkaarten');
    const rows = toArrayRows(raw);
    alleKaarten = rows.map(normalize);
    console.log('[Strippenkaarten] geladen kaarten:', alleKaarten.length);
    renderKaarten($('#status')?.value || 'ALL');
  } catch (err) {
    const errEl = $('#s-error');
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = '❌ Fout laden: ' + (err?.message || err);
    }
    console.error('[Strippenkaarten] fout bij laden:', err);
  }
});
