/**
 * public/js/lessenreeksen.js — lijst + zoeken + acties voor lessenreeksen
 */

import {
  initFromConfig,
  fetchSheet,
  postAction
} from './sheets.js';
import { SuperhondUI } from './layout.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const collator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });

let allReeksen = [];
let viewReeksen = [];

/** Sanitize/escape HTML */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])
  );
}

/** Converteer verschillende vormen van respons naar een array van rijen */
function toArrayRows(x) {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  if (x && Array.isArray(x.rows)) return x.rows;
  if (x && Array.isArray(x.result)) return x.result;
  return [];
}

/** Normaliseer een “reeks” rij naar een intern object */
function normalize(row) {
  const o = {};
  for (const [k, v] of Object.entries(row || {})) {
    o[String(k || '').toLowerCase()] = v;
  }
  return {
    id:        (o.id ?? '').toString(),
    actief:    (o.actief ?? '').toString(),
    naam:      (o.naam ?? '').toString(),
    thema:     (o.thema ?? '').toString(),
    tijd:      (o.tijd ?? '').toString(),
    aantal:    (o.aantal ?? '').toString(),
    prijs:     (o.prijs ?? '').toString()
    // je kunt hier meer velden toevoegen naargelang je sheetstructuur
  };
}

/** Bepaalt of een reeks overeenkomt met de zoekopdracht */
function rowMatches(r, q) {
  if (!q) return true;
  const hay = [
    r.naam,
    r.thema,
    r.tijd,
    r.prijs
  ].map(x => String(x || '').toLowerCase()).join(' ');
  return hay.includes(q);
}

/** Rendert de tabel van reeksen volgens de viewReeksen-lijst */
function renderTable(rows) {
  const tb = $('#tabel tbody');
  if (!tb) return;
  tb.innerHTML = '';

  if (!rows.length) {
    tb.innerHTML = `<tr><td colspan="7" class="muted">Geen reeksen gevonden.</td></tr>`;
    return;
  }

  const frag = document.createDocumentFragment();
  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.dataset.id = r.id;
    tr.innerHTML = `
      <td>${escapeHtml(r.actief)}</td>
      <td>${escapeHtml(r.naam)}</td>
      <td>${escapeHtml(r.thema)}</td>
      <td>${escapeHtml(r.tijd)}</td>
      <td>${escapeHtml(r.aantal)}</td>
      <td>${escapeHtml(r.prijs)}</td>
      <td class="nowrap">
        <button class="btn btn-xs act-view" data-id="${escapeHtml(r.id)}" title="Bekijken">🔍</button>
        <button class="btn btn-xs act-edit" data-id="${escapeHtml(r.id)}" title="Wijzigen">✏️</button>
        <button class="btn btn-xs act-del"  data-id="${escapeHtml(r.id)}" title="Verwijderen">🗑️</button>
      </td>`;
    frag.appendChild(tr);
  }
  tb.appendChild(frag);
}

/** Filterfunctie op zoekveld */
function applyFilter() {
  const q = String($('#zoek')?.value || '').trim().toLowerCase();
  viewReeksen = allReeksen.filter(r => rowMatches(r, q));
  renderTable(viewReeksen);
}

/** Verbind de actieknoppen (view, edit, delete) */
function wireActionHandlers() {
  const tbl = $('#tabel');
  if (!tbl) return;
  tbl.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.classList.contains('act-view')) {
      openView(id);
    } else if (btn.classList.contains('act-edit')) {
      openEdit(id);
    } else if (btn.classList.contains('act-del')) {
      confirmDelete(id);
    }
  });
}

/** Modal bekijken */
function openView(id) {
  const r = allReeksen.find(x => x.id === id);
  if (!r) {
    alert('Reeks niet gevonden');
    return;
  }
  const html = `
    <div><strong>Naam:</strong> ${escapeHtml(r.naam)}</div>
    <div><strong>Thema:</strong> ${escapeHtml(r.thema)}</div>
    <div><strong>Tijd:</strong> ${escapeHtml(r.tijd)}</div>
    <div><strong>Aantal lessen:</strong> ${escapeHtml(r.aantal)}</div>
    <div><strong>Prijs:</strong> ${escapeHtml(r.prijs)}</div>
    <div><strong>Actief:</strong> ${escapeHtml(r.actief)}</div>
  `;
  modal(html, { title: 'Reeks bekijken' });
}

/** Modal bewerken */
function openEdit(id) {
  const r = allReeksen.find(x => x.id === id);
  if (!r) {
    alert('Reeks niet gevonden');
    return;
  }
  const html = `
    <form id="edit-form">
      <div class="row"><div class="key">Naam</div><div><input name="naam" value="${escapeHtml(r.naam)}" required></div></div>
      <div class="row"><div class="key">Thema</div><div><input name="thema" value="${escapeHtml(r.thema)}"></div></div>
      <div class="row"><div class="key">Tijd</div><div><input name="tijd" value="${escapeHtml(r.tijd)}"></div></div>
      <div class="row"><div class="key">Aantal lessen</div><div><input name="aantal" value="${escapeHtml(r.aantal)}" type="number" min="0"></div></div>
      <div class="row"><div class="key">Prijs</div><div><input name="prijs" value="${escapeHtml(r.prijs)}" type="number" step="0.01"></div></div>
      <div class="row"><div class="key">Actief</div><div>
        <input name="actief" type="checkbox" ${r.actief === 'true' ? 'checked' : ''}/>
      </div></div>
      <div class="sh-foot" style="margin-top:1rem;">
        <button type="button" data-close="1">Annuleren</button>
        <button type="submit">Opslaan</button>
      </div>
    </form>
  `;
  modal(html, { title: 'Reeks bewerken' });

  const form = document.getElementById('edit-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      id,
      naam:  String(fd.get('naam') || '').trim(),
      thema: String(fd.get('thema') || '').trim(),
      tijd:  String(fd.get('tijd') || '').trim(),
      aantal: String(fd.get('aantal') || '').trim(),
      prijs: String(fd.get('prijs') || '').trim(),
      actief: fd.get('actief') ? 'true' : 'false'
    };

    // Basisvalidatie
    if (!payload.naam) {
      alert('Naam is verplicht');
      return;
    }

    try {
      await postAction('lessenreeks', 'update', payload);
      Object.assign(r, normalize(payload));
      applyFilter();
      closeModal();
    } catch (err) {
      alert('Opslaan mislukt: ' + (err?.message || err));
    }
  });
}

/** Verwijderen met bevestiging */
function confirmDelete(id) {
  if (!confirm('Weet je zeker dat je deze reeks wilt verwijderen?')) return;
  deleteReeks(id);
}

async function deleteReeks(id) {
  try {
    await postAction('lessenreeks', 'delete', { id });
    allReeksen = allReeksen.filter(r => r.id !== id);
    applyFilter();
  } catch (err) {
    alert('Verwijderen mislukt: ' + (err?.message || err));
  }
}

/** Modal functie (kopiëren van eerdere modules) */
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

// — Boot / initialisatie —
document.addEventListener('DOMContentLoaded', async () => {
  SuperhondUI.mount({
    title: 'Lessenreeksen',
    icon: '📦',
    back: '../dashboard/',
    home: false
  });

  await initFromConfig();

  $('#zoek')?.addEventListener('input', applyFilter);

  wireActionHandlers();

  // Initiële weergave
  renderTable([]);

  try {
    const raw = await fetchSheet('LessenReeksen'); // of juiste sheetnaam
    const rows = toArrayRows(raw);
    allReeksen = rows.map(normalize).sort((a, b) => collator.compare(a.naam, b.naam));
    applyFilter();
  } catch (err) {
    const errEl = $('#error');
    if (errEl) {
      errEl.style.display = '';
      errEl.textContent = '❌ Fout laden: ' + (err?.message || err);
    }
    console.error('[lessenreeksen] Fout laden:', err);
    SuperhondUI.setOnline(false);
  }
});
