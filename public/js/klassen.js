/**
 * public/js/klassen.js — Lijst + zoeken + inline bewerken + toevoegen (v0.21.1)
 * Werkt met public/js/sheets.js (proxy-first, timeouts, retries)
 */

import {
  fetchAction, fetchSheet, postAction, initFromConfig
} from '../js/sheets.js';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const els = {
  state:   $('#state'),
  tbody:   $('#tbl tbody'),
  search:  $('#search'),
  refresh: $('#refresh'),
  form:    $('#form-add'),
  formMsg: $('#form-msg')
};

let CACHE = [];
let editingId = null;
let undoTimer = null;
let lastArchived = null; // { entity:'Klas', id, snapshot }

/* ────────────── Helpers ────────────── */
function setState(txt, kind = 'muted') {
  if (!els.state) return;
  els.state.className = kind; // 'muted' | 'error'
  els.state.textContent = txt;
}
function escapeHtml(s='') {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function required(v) { return String(v ?? '').trim().length > 0; }
function norm(s) { return String(s ?? '').trim().toLowerCase(); }

function filterRows(list, q) {
  const ql = norm(q);
  if (!ql) return list;
  return list.filter(k =>
    norm(k.naam).includes(ql) ||
    norm(k.niveau).includes(ql) ||
    norm(k.trainer).includes(ql) ||
    norm(k.status).includes(ql)
  );
}

function debounce(fn, ms = 200) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* Inline form errors (CSS-classes uit style.css) */
function clearErrors(root = document) {
  $$('.input-error', root).forEach(el => el.classList.remove('input-error'));
  $$('.field-error', root).forEach(el => el.remove());
}
function setFieldError(input, message = '') {
  if (!input) return;
  input.classList.toggle('input-error', !!message);
  let hint = input.nextElementSibling;
  if (!hint || !hint.classList.contains('field-error')) {
    hint = document.createElement('div');
    hint.className = 'field-error';
    input.insertAdjacentElement('afterend', hint);
  }
  hint.textContent = message || '';
  hint.style.display = message ? '' : 'none';
}

/* Toast (compatible met jouw CSS/toast.js) */
function showToast(msg, type = 'info', undoCallback = null, duration = 10_000) {
  if (typeof window.SuperhondToast === 'function') {
    window.SuperhondToast(msg, type, { undo: undoCallback, duration });
    return { close: () => {} };
  }
  // simpele fallback
  let cont = document.querySelector('.toast-container');
  if (!cont) {
    cont = document.createElement('div');
    cont.className = 'toast-container';
    document.body.appendChild(cont);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${escapeHtml(msg)}</span>`;
  if (undoCallback) {
    const b = document.createElement('button');
    b.textContent = 'Ongedaan';
    b.onclick = () => { undoCallback(); el.remove(); };
    el.appendChild(b);
  }
  const x = document.createElement('button');
  x.setAttribute('aria-label', 'Sluiten');
  x.textContent = '×';
  x.onclick = () => el.remove();
  el.appendChild(x);
  cont.appendChild(el);
  const timer = setTimeout(() => el.remove(), duration);
  return { close: () => { clearTimeout(timer); el.remove(); } };
}

/* ────────────── Row renders ────────────── */
function displayRow(k) {
  const tr = document.createElement('tr');
  tr.dataset.id = k.id || '';
  tr.innerHTML = `
    <td>${escapeHtml(k.naam || '—')}</td>
    <td>${escapeHtml(k.niveau || '—')}</td>
    <td>${escapeHtml(k.trainer || '—')}</td>
    <td>${escapeHtml(k.status || '—')}</td>
    <td class="nowrap">
      <button class="btn btn-xs act-edit">Bewerk</button>
      <button class="btn btn-xs act-archive">Archiveer</button>
    </td>
  `;
  return tr;
}

function mkInput(name, value='', placeholder='', isRequired=false, type='text'){
  const wrap = document.createElement('div');
  const el = document.createElement('input');
  el.name = name; el.value = value ?? ''; el.placeholder = placeholder;
  el.className = 'input'; el.type = type; el.autocomplete = 'off';
  if (isRequired) el.required = true;
  wrap.appendChild(el);
  return wrap;
}
function mkBtn(label, cls){ const b=document.createElement('button'); b.type='button'; b.className=cls; b.textContent=label; return b; }

function editRow(k) {
  const tr = document.createElement('tr');
  tr.dataset.id = k.id || '';

  const tdNaam   = document.createElement('td');
  const inNaam   = mkInput('naam', k.naam || '', 'Naam', true);
  tdNaam.append(inNaam);

  const tdNiv    = document.createElement('td');
  const inNiveau = mkInput('niveau', k.niveau || '', 'Niveau');
  tdNiv.append(inNiveau);

  const tdTr     = document.createElement('td');
  const inTrainer= mkInput('trainer', k.trainer || '', 'Trainer');
  tdTr.append(inTrainer);

  const tdSt     = document.createElement('td');
  const inStatus = mkInput('status', k.status || 'actief', 'Status (actief/inactief)');
  tdSt.append(inStatus);

  const tdAct = document.createElement('td'); tdAct.className='nowrap';
  const bSave   = mkBtn('Opslaan','btn btn-xs act-save');
  const bCancel = mkBtn('Annuleer','btn btn-xs act-cancel');
  tdAct.append(bSave, bCancel);

  // Enter in een van de velden → opslaan
  $$('input', tr).forEach(inp => {
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        bSave.click();
      }
    });
  });

  tr.append(tdNaam, tdNiv, tdTr, tdSt, tdAct);
  return tr;
}

/* ────────────── Data load/render ────────────── */
async function load() {
  try {
    setState('⏳ Laden…', 'muted');
    await initFromConfig();

    let data = [];
    try {
      // Moderne action indien beschikbaar
      data = await fetchAction('getKlassen');
    } catch {
      // Fallback op legacy tab
      data = await fetchSheet('Klassen');
    }

    CACHE = (data || []).filter(k => norm(k.archived) !== 'true');
    render();
    setState(`✅ ${CACHE.length} klas${CACHE.length===1?'':'sen'} geladen`, 'muted');
  } catch (err) {
    console.error(err);
    setState('❌ Fout bij laden van klassen: ' + (err?.message || String(err)), 'error');
  }
}

function render() {
  if (!els.tbody) return;
  els.tbody.innerHTML = '';
  const list = filterRows(CACHE, els.search?.value || '');
  if (!list.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" class="muted">Geen resultaten.</td>`;
    els.tbody.appendChild(tr);
    return;
  }
  for (const k of list) {
    const tr = (editingId && editingId === k.id) ? editRow(k) : displayRow(k);
    els.tbody.appendChild(tr);
  }
}

/* ────────────── Events ────────────── */
// Zoeken met debounce
const doFilter = debounce(render, 150);
els.search?.addEventListener('input', doFilter);
els.refresh?.addEventListener('click', load);

// Toevoegen
els.form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors(els.form);

  const fd = new FormData(els.form);
  const payload = Object.fromEntries(fd.entries());

  const fNaam   = els.form.querySelector('input[name="naam"]');
  const fStatus = els.form.querySelector('input[name="status"]');

  let ok = true;
  if (!required(payload.naam)) { setFieldError(fNaam,'Naam is verplicht'); ok=false; }
  if (!payload.status) payload.status = 'actief';
  if (!ok) {
    els.formMsg.textContent = '❌ Corrigeer de gemarkeerde velden';
    els.formMsg.className = 'error';
    return;
  }

  try {
    els.formMsg.textContent = '⏳ Opslaan…';
    els.formMsg.className = 'muted';

    await postAction('Klas', 'add', payload);
    els.form.reset();
    els.formMsg.textContent = '✅ Toegevoegd';
    await load();
    showToast('Klas toegevoegd', 'ok');
  } catch (err) {
    els.formMsg.textContent = '❌ ' + (err?.message || String(err));
    els.formMsg.className = 'error';
  }
});

// Tabelacties (edit/save/cancel/archive + undo)
els.tbody?.addEventListener('click', async (e) => {
  const btn = e.target.closest('button'); if (!btn) return;
  const tr = btn.closest('tr'); const id = tr?.dataset.id; if (!id) return;
  const item = CACHE.find(k => k.id === id);

  if (btn.classList.contains('act-edit')) {
    if (editingId && editingId !== id) return;
    editingId = id; render();
  }
  else if (btn.classList.contains('act-cancel')) {
    editingId = null; render();
  }
  else if (btn.classList.contains('act-save')) {
    const naam    = $('input[name="naam"]', tr)?.value || '';
    const niveau  = $('input[name="niveau"]', tr)?.value || '';
    const trainer = $('input[name="trainer"]', tr)?.value || '';
    const status  = $('input[name="status"]', tr)?.value || '';

    clearErrors(tr);
    let ok = true;
    if (!required(naam))  { setFieldError($('input[name="naam"]', tr),'Verplicht'); ok=false; }
    if (!ok) { setState('❌ Corrigeer de gemarkeerde velden', 'error'); return; }

    btn.disabled = true; const oldLabel = btn.textContent; btn.textContent = 'Opslaan…';
    try {
      await postAction('Klas', 'update', { id, naam, niveau, trainer, status });
      editingId = null;
      await load();
      showToast('Wijzigingen opgeslagen', 'ok');
    } catch (err) {
      setState('❌ Opslaan mislukt: ' + (err?.message || String(err)), 'error');
      btn.disabled = false; btn.textContent = oldLabel;
    }
  }
  else if (btn.classList.contains('act-archive')) {
    if (!confirm('Archiveer deze klas?')) return;
    try {
      lastArchived = { entity:'Klas', id, snapshot: { ...item, archived:false } };
      await postAction('Klas', 'delete', { id });
      await load();

      if (undoTimer) clearTimeout(undoTimer);
      const t = showToast('Klas gearchiveerd', 'info', async () => {
        if (!lastArchived) return;
        try { await postAction('Klas','update', lastArchived.snapshot); await load(); showToast('Hersteld', 'ok'); }
        catch (e) { setState('❌ Ongedaan maken faalde: ' + (e?.message || e), 'error'); }
        finally { lastArchived = null; }
      }, 10_000);
      undoTimer = setTimeout(() => { lastArchived = null; t?.close?.(); }, 10_000);
    } catch (err) {
      setState('❌ Archiveren mislukt: ' + (err?.message || String(err)), 'error');
    }
  }
});

/* ────────────── Boot ────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // Uniforme topbar (subpage = blauw) + terugknop naar dashboard
  if (window.SuperhondUI?.mount) {
    document.body.classList.add('subpage');
    SuperhondUI.mount({ title: 'Klassen', icon: '📚', back: '../dashboard/' });
  }
  await load();
});
