/**
 * public/js/lessen.js — Lijst + zoeken + toevoegen (v0.26.0)
 * Verbeterde versie, consistent met layout.js
 */

import {
  initFromConfig,
  fetchSheet,
  saveLes,
  postAction
} from './sheets.js';

import {
  actionBtns,
  wireActionHandlers
} from './actions.js';

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function toast(msg, type = 'info') {
  if (typeof window.SuperhondToast === 'function') {
    window.SuperhondToast(msg, type);
  } else {
    console[(type === 'error' ? 'error' : 'log')](msg);
  }
}

function setState(text, kind = 'muted') {
  const el = $('#state');
  if (!el) return;
  el.className = kind;
  el.textContent = text;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function clearErrors(form) {
  $$('.input-error', form).forEach(el => el.classList.remove('input-error'));
  $$('.field-error', form).forEach(el => el.remove());
}

function setFieldError(input, msg) {
  if (!input) return;
  input.classList.add('input-error');
  const hint = document.createElement('div');
  hint.className = 'field-error';
  hint.textContent = msg;
  input.insertAdjacentElement('afterend', hint);
}

function fmtDateISOtoLocal(iso) {
  const s = String(iso || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function fmtTimeToHHMM(t) {
  const s = String(t || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return s;
  const hh = String(m[1]).padStart(2, '0');
  const mm = m[2];
  return `${hh}:${mm}`;
}

// Data & logica

const TIMEOUT_MS = 20000;
const collator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });

let allRows = [];
let viewRows = [];
let lastAbort = null;

function toArrayRows(x) {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  if (x && Array.isArray(x.rows)) return x.rows;
  if (x && Array.isArray(x.result)) return x.result;
  if (x && x.ok === true && Array.isArray(x.data)) return x.data;
  return [];
}

function normalizeRow(row) {
  const o = Object.create(null);
  for (const [k, v] of Object.entries(row || {})) {
    o[String(k).toLowerCase()] = v;
  }
  return {
    id:       (o.id ?? o['id.'] ?? o.col1 ?? '').toString(),
    type:     (o.type ?? o.naam ?? '').toString(),
    naam:     (o.naam ?? o.type ?? '').toString(),
    date:     (o.date ?? o.datum ?? '').toString(),
    time:     (o.time ?? o.tijd ?? '').toString(),
    trainer:  (o.trainer ?? '').toString(),
    location: (o.location ?? o.locatie ?? '').toString(),
    capacity: (o.capacity ?? o.cap ?? '').toString(),
    notes:    (o.notes ?? o.notities ?? '').toString(),
    status:   (o.status ?? '').toString()
  };
}

function rowMatchesQuery(row, q) {
  if (!q) return true;
  const hay = [
    row.naam || row.type, row.trainer, row.location, row.notes, row.status, row.date, row.time
  ].map(x => String(x || '').toLowerCase()).join(' ');
  return hay.includes(q);
}

function renderTable(rows) {
  const tb = $('#tbl tbody');
  if (!tb) return;
  tb.innerHTML = '';

  if (!rows.length) {
    tb.innerHTML = `<tr><td colspan="6" class="muted">Geen resultaten.</td></tr>`;
    return;
  }

  const frag = document.createDocumentFragment();
  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.naam || r.type || '')}</td>
      <td class="nowrap">${escapeHtml(fmtDateISOtoLocal(r.date))} ${escapeHtml(fmtTimeToHHMM(r.time))}</td>
      <td>${escapeHtml(r.trainer)}</td>
      <td>${escapeHtml(r.location)}</td>
      <td>${escapeHtml(r.status)}</td>
      <td class="nowrap">${actionBtns({ id: r.id, entity: 'les' })}</td>
    `;
    frag.appendChild(tr);
  }
  tb.appendChild(frag);
}

const doFilter = debounce(() => {
  const q = String($('#search')?.value || '').trim().toLowerCase();
  viewRows = allRows.filter(r => rowMatchesQuery(r, q));
  renderTable(viewRows);
}, 150);

// Modals & acties

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

function modal(contentHTML, { title = 'Details' } = {}) {
  ensureModalRoot();
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <style>
      #modal-root .sh-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.35); display: flex; align-items: center; justify-content: center; z-index: 1000 }
      #modal-root .sh-modal { background: #fff; border-radius: 12px; min-width: 300px; max-width: 720px; width: clamp(300px, 92vw, 720px); box-shadow: 0 10px 30px rgba(0,0,0,.2) }
      #modal-root .sh-head { display: flex; align-items: center; justify-content: space-between; padding: .8rem 1rem; border-bottom: 1px solid #e5e7eb; font-weight: 700 }
      #modal-root .sh-body { padding: 1rem }
      #modal-root .sh-close { appearance: none; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; padding: .3rem .6rem; cursor: pointer }
      #modal-root .sh-overlay[data-close] { cursor: pointer }
      #modal-root .row { display: grid; grid-template-columns: 180px 1fr; gap: .35rem .75rem; margin: .15rem 0 }
      #modal-root .key { color: #6b7280 }
      #modal-root .input, #modal-root select, #modal-root textarea { width: 100%; padding: .45rem .55rem; border: 1px solid #cbd5e1; border-radius: 8px }
      #modal-root .btn { border: 1px solid #cbd5e1; border-radius: 8px; padding: .4rem .7rem; cursor: pointer }
      #modal-root .btn.primary { background: #2563eb; color: #fff; border-color: #2563eb }
      #modal-root .btn.danger { background: #ef4444; color: #fff; border-color: #ef4444 }
      @media (max-width: 560px) { #modal-root .row { grid-template-columns: 1fr } }
    </style>
    <div class="sh-overlay" data-close="1" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="sh-modal" role="document">
        <div class="sh-head">
          <span>${escapeHtml(title)}</span>
          <button class="sh-close" type="button" data-close="1" aria-label="Sluiten">✕</button>
        </div>
        <div class="sh-body">${contentHTML}</div>
      </div>
    </div>`;
  root.querySelector('.sh-overlay').addEventListener('click', e => {
    if (e.target?.dataset?.close === '1') closeModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); }, { once: true });
}

// View / Edit / Delete

function openLesView(id) {
  const r = allRows.find(x => String(x.id) === String(id));
  if (!r) {
    toast('Les niet gevonden', 'error');
    return;
  }
  const html = `
    <div class="row"><div class="key">Naam</div><div>${escapeHtml(r.naam || r.type || '—')}</div></div>
    <div class="row"><div class="key">Datum</div><div>${escapeHtml(fmtDateISOtoLocal(r.date) || '—')}</div></div>
    <div class="row"><div class="key">Tijd</div><div>${escapeHtml(fmtTimeToHHMM(r.time) || '—')}</div></div>
    <div class="row"><div class="key">Trainer</div><div>${escapeHtml(r.trainer || '—')}</div></div>
    <div class="row"><div class="key">Locatie</div><div>${escapeHtml(r.location || '—')}</div></div>
    <div class="row"><div class="key">Capaciteit</div><div>${escapeHtml(r.capacity || '—')}</div></div>
    <div class="row"><div class="key">Status</div><div>${escapeHtml(r.status || '—')}</div></div>
    <div class="row"><div class="key">Notities</div><div>${escapeHtml(r.notes || '—')}</div></div>
    <div class="row"><div class="key">ID</div><div><code>${escapeHtml(r.id || '')}</code></div></div>
  `;
  modal(html, { title: 'Les bekijken' });
}

function openLesEdit(id) {
  const r = allRows.find(x => String(x.id) === String(id));
  if (!r) {
    toast('Les niet gevonden', 'error');
    return;
  }

  const html = `
    <form id="edit-form">
      <div class="row"><div class="key">Naam</div><div><input class="input" name="naam" value="${escapeHtml(r.naam || r.type || '')}" required></div></div>
      <div class="row"><div class="key">Datum</div><div><input class="input" name="date" type="date" value="${escapeHtml(r.date || '')}"></div></div>
      <div class="row"><div class="key">Tijd</div><div><input class="input" name="time" type="time" value="${escapeHtml(fmtTimeToHHMM(r.time) || '')}"></div></div>
      <div class="row"><div class="key">Trainer</div><div><input class="input" name="trainer" value="${escapeHtml(r.trainer || '')}"></div></div>
      <div class="row"><div class="key">Locatie</div><div><input class="input" name="location" value="${escapeHtml(r.location || '')}"></div></div>
      <div class="row"><div class="key">Capaciteit</div><div><input class="input" name="capacity" type="number" min="0" step="1" value="${escapeHtml(r.capacity || '')}"></div></div>
      <div class="row"><div class="key">Status</div><div>
        <select class="input" name="status">
          <option value="actief" ${r.status === 'actief' ? 'selected' : ''}>actief</option>
          <option value="inactief" ${r.status === 'inactief' ? 'selected' : ''}>inactief</option>
        </select>
      </div></div>
      <div class="row"><div class="key">Notities</div><div><textarea class="input" name="notes" rows="3">${escapeHtml(r.notes || '')}</textarea></div></div>
      <div class="sh-foot">
        <button type="button" class="btn" data-close="1">Annuleren</button>
        <button type="submit" class="btn primary">Opslaan</button>
      </div>
    </form>`;
  modal(html, { title: 'Les wijzigen' });

  const form = document.getElementById('edit-form');
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const payload = {
      id: r.id,
      naam:     String(fd.get('naam') || '').trim(),
      type:     String(fd.get('naam') || '').trim(),
      date:     String(fd.get('date') || '').trim(),
      time:     String(fd.get('time') || '').trim(),
      trainer:  String(fd.get('trainer') || '').trim(),
      location: String(fd.get('location') || '').trim(),
      capacity: String(fd.get('capacity') || '').trim(),
      notes:    String(fd.get('notes') || '').trim(),
      status:   String(fd.get('status') || '').trim() || 'actief'
    };

    // Validatie
    let hasErr = false;
    if (!payload.naam) {
      setFieldError(form.querySelector('[name="naam"],[name="type"]'), 'Naam is verplicht');
      hasErr = true;
    }
    if (payload.date && !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
      setFieldError(form.querySelector('[name="date"]'), 'Ongeldige datum');
      hasErr = true;
    }
    if (payload.time && !/^\d{1,2}:\d{2}$/.test(payload.time)) {
      setFieldError(form.querySelector('[name="time"]'), 'Ongeldige tijd');
      hasErr = true;
    }
    if (payload.capacity && !/^\d+$/.test(payload.capacity)) {
      setFieldError(form.querySelector('[name="capacity"]'), 'Capaciteit moet integer zijn');
      hasErr = true;
    }
    if (hasErr) return;

    try {
      await postAction('les', 'update', payload);
      Object.assign(r, normalizeRow(payload));
      renderTable(allRows.filter(r => rowMatchesQuery(r, String($('#search')?.value || '').toLowerCase()));
      closeModal();
      toast('Wijzigingen opgeslagen', 'ok');
    } catch (err) {
      console.error(err);
      toast('Opslaan mislukt: ' + (err?.message || err), 'error');
    }
  });
}

async function deleteLes(id) {
  const r = allRows.find(x => String(x.id) === String(id));
  if (!r) {
    toast('Les niet gevonden', 'error');
    return;
  }
  if (!confirm(`Weet je zeker dat je "${r.naam || r.type || 'deze les'}" wilt verwijderen?`)) return;

  try {
    await postAction('les', 'delete', { id });
    allRows = allRows.filter(x => String(x.id) !== String(id));
    renderTable(allRows.filter(r => rowMatchesQuery(r, String($('#search')?.value || '').toLowerCase()));
    toast('Les verwijderd', 'ok');
  } catch (err) {
    console.error(err);
    toast('Verwijderen mislukt: ' + (err?.message || err), 'error');
  }
}

async function refresh() {
  if (lastAbort) lastAbort.abort();
  const ac = new AbortController();
  lastAbort = ac;

  setState('⏳ Laden…', 'muted');
  try {
    const raw = await fetchSheet('Lessen', { timeout: TIMEOUT_MS, signal: ac.signal });
    const rows = toArrayRows(raw);
    allRows = rows.map(normalizeRow);

    allRows.sort((a, b) => {
      const aKey = `${a.date || ''} ${fmtTimeToHHMM(a.time || '')}`;
      const bKey = `${b.date || ''} ${fmtTimeToHHMM(b.time || '')}`;
      const cmp = aKey.localeCompare(bKey);
      return cmp || collator.compare(a.naam || a.type || '', b.naam || b.type || '');
    });

    viewRows = allRows.filter(r => rowMatchesQuery(r, String($('#search')?.value || '').toLowerCase()));
    renderTable(viewRows);

    setState(`✅ ${viewRows.length} les${viewRows.length === 1 ? '' : 'sen'} geladen`, 'muted');
    window.SuperhondUI?.setOnline?.(true);
  } catch (err) {
    if (err?.name === 'AbortError') return;
    console.error(err);
    setState(`❌ Fout bij laden: ${err?.message || err}`, 'error');
    toast('Laden mislukt', 'error');
    window.SuperhondUI?.setOnline?.(false);
  }
}

function ensureStatusSelectDefault() {
  const sel = $('#form-add [name="status"]');
  if (!sel || sel.tagName !== 'SELECT') return;
  if (!sel.options || sel.options.length === 0) {
    ['actief','inactief'].forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      sel.appendChild(o);
    });
  }
  if (!sel.value) sel.value = 'actief';
}

function wireAddFormValidation() {
  const form = $('#form-add');
  if (!form) return;
  const btn = form.querySelector('[type="submit"]') || form.querySelector('button');
  if (btn) btn.type = 'submit';
  const naam = form.querySelector('[name="naam"], [name="type"]');
  const date = form.querySelector('[name="date"]');
  const time = form.querySelector('[name="time"]');

  function validate() {
    const hasName = !!String(naam?.value || '').trim();
    const okDate = !date?.value || /^\d{4}-\d{2}-\d{2}$/.test(date.value);
    const okTime = !time?.value || /^\d{1,2}:\d{2}$/.test(time.value);
    const ok = hasName && okDate && okTime;
    btn && (btn.disabled = !ok);
    return ok;
  }
  ['input','change','blur'].forEach(ev => {
    naam?.addEventListener(ev, validate);
    date?.addEventListener(ev, validate);
    time?.addEventListener(ev, validate);
  });
  validate();
}

async function onSubmitAdd(e) {
  e.preventDefault();
  const form = e.currentTarget;
  clearErrors(form);
  const fd = new FormData(form);

  const naam     = String(fd.get('naam') || '').trim();
  const type     = naam;
  const date     = String(fd.get('date') || '').trim();
  const time     = String(fd.get('time') || '').trim();
  const trainer  = String(fd.get('trainer') || '').trim();
  const location = String(fd.get('location') || '').trim();
  const capacity = String(fd.get('capacity') || '').trim();
  const notes    = String(fd.get('notes') || '').trim();
  const status   = String(fd.get('status') || '').trim() || 'actief';

  let hasErr = false;
  if (!naam) {
    setFieldError(form.querySelector('[name="naam"],[name="type"]'), 'Naam is verplicht');
    hasErr = true;
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    setFieldError(form.querySelector('[name="date"]'), 'Ongeldige datum');
    hasErr = true;
  }
  if (time && !/^\d{1,2}:\d{2}$/.test(time)) {
    setFieldError(form.querySelector('[name="time"]'), 'Ongeldige tijd');
    hasErr = true;
  }
  if (capacity && !/^\d+$/.test(capacity)) {
    setFieldError(form.querySelector('[name="capacity"]'), 'Capaciteit moet integer zijn');
    hasErr = true;
  }
  if (hasErr) return;

  const payload = { naam, type, date, time, trainer, location, capacity, notes, status };

  const msg = $('#form-msg');
  if (msg) {
    msg.className = 'muted';
    msg.textContent = '⏳ Opslaan…';
  }

  try {
    const res = await saveLes(payload);
    const id = res?.id || '';
    toast('✅ Les opgeslagen', 'ok');

    const nieuw = normalizeRow({ id, ...payload });
    allRows.push(nieuw);
    allRows.sort((a, b) => {
      const aKey = `${a.date || ''} ${fmtTimeToHHMM(a.time || '')}`;
      const bKey = `${b.date || ''} ${fmtTimeToHHMM(b.time || '')}`;
      const cmp = aKey.localeCompare(bKey);
      return cmp || collator.compare(a.naam || a.type || '', b.naam || b.type || '');
    });
    viewRows = allRows.filter(r => rowMatchesQuery(r, String($('#search')?.value || '').toLowerCase()));
    renderTable(viewRows);

    if (msg) {
      msg.textContent = `✅ Bewaard (id: ${id})`;
    }
    form.reset();
    const first = form.querySelector('input, select, textarea');
    first && first.focus();
  } catch (err) {
    console.error(err);
    if (msg) {
      msg.className = 'error';
      msg.textContent = `❌ Opslaan mislukt: ${err?.message || err}`;
    }
    toast('Opslaan mislukt', 'error');
  }
}

async function main() {
  // Topbar / mount
  if (window.SuperhondUI?.mount) {
    window.SuperhondUI.mount({ title: 'Lessen', icon: '📅', back: '../dashboard/' });
  }

  await initFromConfig();

  ensureStatusSelectDefault();
  wireAddFormValidation();

  $('#refresh')?.addEventListener('click', refresh);
  $('#search')?.addEventListener('input', doFilter);
  $('#form-add')?.addEventListener('submit', onSubmitAdd);

  wireActionHandlers('#tbl', {
    view:   id => openLesView(id),
    edit:   id => openLesEdit(id),
    delete: id => deleteLes(id),
  });

  await refresh();
  $$('#form-add input').forEach(inp => {
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        $('#form-add')?.requestSubmit();
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', main, { once: true });
