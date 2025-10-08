import { fetchAction, postAction, initFromConfig } from './sheets.js';

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
let lastArchived = null; // { entity:'Hond', id, snapshot }

// ───── shared UI helpers (errors + toast) ─────
function setState(txt, isError = false) {
  if (!els.state) return;
  els.state.textContent = txt;
  els.state.classList.toggle('error', isError);
}
function escapeHtml(s='') {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmtDate(s) { if (!s) return '—'; const d = new Date(s); return isNaN(d) ? '—' : d.toLocaleDateString(); }
function required(v) { return String(v ?? '').trim().length > 0; }
function validDate(s) { if (!s) return true; const d = new Date(s); return !isNaN(d); }

function setFieldError(input, message = '') {
  if (!input) return;
  let hint = input.nextElementSibling;
  const need = message && message.length;
  if (!hint || !hint.classList.contains('field-error')) {
    hint = document.createElement('div');
    hint.className = 'field-error';
    hint.style.color = '#b91c1c';
    hint.style.fontSize = '.85rem';
    hint.style.marginTop = '.25rem';
    input.insertAdjacentElement('afterend', hint);
  }
  hint.textContent = message || '';
  hint.style.display = need ? '' : 'none';
  input.classList.toggle('input-error', !!need);
}

function ensureToastStyles() {
  if (document.getElementById('toast-styles')) return;
  const s = document.createElement('style');
  s.id = 'toast-styles';
  s.textContent = `
  .toast-wrap{position:fixed;left:50%;transform:translateX(-50%);bottom:16px;z-index:9999;display:flex;gap:.5rem;flex-direction:column;align-items:center}
  .toast{background:#111827;color:#fff;padding:.6rem .9rem;border-radius:.5rem;box-shadow:0 6px 18px rgba(0,0,0,.25);display:flex;gap:.75rem;align-items:center;max-width:90vw}
  .toast button{background:#fff;color:#111827;border:none;border-radius:.35rem;padding:.35rem .6rem;cursor:pointer}
  .toast .muted{opacity:.8}
  `;
  document.head.appendChild(s);
}
function showToast(msg, { actionLabel, onAction, duration = 10_000 } = {}) {
  ensureToastStyles();
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
  const el = document.createElement('div'); el.className = 'toast';
  const span = document.createElement('span'); span.textContent = msg; el.appendChild(span);
  let timer; const close = () => { clearTimeout(timer); el.remove(); };
  if (actionLabel && onAction) {
    const btn = document.createElement('button'); btn.textContent = actionLabel;
    btn.addEventListener('click', () => { onAction(); close(); });
    el.appendChild(btn);
  } else {
    const m = document.createElement('span'); m.className = 'muted'; m.textContent = ' '; el.appendChild(m);
  }
  const x = document.createElement('button'); x.textContent = '×'; x.setAttribute('aria-label','Sluiten'); x.addEventListener('click', close); el.appendChild(x);
  document.body.querySelector('.toast-wrap').appendChild(el);
  timer = setTimeout(close, duration);
  return { close };
}

// ───── list helpers ─────
function filterRows(list, q) {
  const ql = (q || '').trim().toLowerCase();
  if (!ql) return list;
  return list.filter(h =>
    (h.name || '').toLowerCase().includes(ql) ||
    (h.breed || '').toLowerCase().includes(ql) ||
    (h.ownerId || '').toLowerCase().includes(ql)
  );
}

// ───── render ─────
function displayRow(h) {
  const tr = document.createElement('tr');
  tr.dataset.id = h.id || '';
  tr.innerHTML = `
    <td>${escapeHtml(h.name || '—')}</td>
    <td>${escapeHtml(h.breed || '—')}</td>
    <td>${escapeHtml(fmtDate(h.birthdate))}</td>
    <td>${escapeHtml(h.ownerId || '—')}</td>
    <td class="nowrap">
      <button class="btn btn-secondary btn-xs act-edit">Bewerk</button>
      <button class="btn btn-danger btn-xs act-archive">Archiveer</button>
    </td>
  `;
  return tr;
}
function editRow(h) {
  const tr = document.createElement('tr');
  tr.dataset.id = h.id || '';

  const tdName = document.createElement('td');
  const inName = mkInput('name', h.name || '', 'Naam', true);
  tdName.append(inName);

  const tdBreed = document.createElement('td');
  const inBreed = mkInput('breed', h.breed || '', 'Ras');
  tdBreed.append(inBreed);

  const tdBirth = document.createElement('td');
  const inBirth = mkInput('birthdate', (h.birthdate || '').slice(0,10), 'Geboortedatum', false, 'date');
  tdBirth.append(inBirth);

  const tdOwner = document.createElement('td');
  const inOwner = mkInput('ownerId', h.ownerId || '', 'Eigenaar (Lid-id)', true);
  tdOwner.append(inOwner);

  const tdAct = document.createElement('td'); tdAct.className='nowrap';
  const bSave = mkBtn('Opslaan','btn btn-primary btn-xs act-save');
  const bCancel= mkBtn('Annuleer','btn btn-secondary btn-xs act-cancel');
  tdAct.append(bSave, bCancel);

  tr.append(tdName, tdBreed, tdBirth, tdOwner, tdAct);
  return tr;
}
function mkInput(name, value='', placeholder='', required=false, type='text'){
  const w = document.createElement('div');
  const el = document.createElement('input');
  el.name = name; el.value = value ?? ''; el.placeholder = placeholder;
  el.className = 'input'; el.type = type; if (required) el.required = true;
  w.appendChild(el);
  return w;
}
function mkBtn(label, cls){ const b=document.createElement('button'); b.type='button'; b.className=cls; b.textContent=label; return b; }

// ───── data flow ─────
async function load() {
  try {
    setState('⏳ Laden…');
    await initFromConfig();
    const data = await fetchAction('getHonden');
    CACHE = (data || []).filter(h => String(h.archived).toLowerCase() !== 'true');
    render();
    setState(`✔️ ${CACHE.length} honden`);
  } catch (err) {
    console.error(err);
    setState('Fout bij laden van honden: ' + (err?.message || String(err)), true);
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
  for (const h of list) {
    const tr = (editingId && editingId === h.id) ? editRow(h) : displayRow(h);
    els.tbody.appendChild(tr);
  }
}

// ───── events ─────
els.search?.addEventListener('input', render);
els.refresh?.addEventListener('click', load);

// Toevoegen met inline errors
els.form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(els.form);
  const payload = Object.fromEntries(fd.entries());

  const fName  = els.form.querySelector('input[name="name"]');
  const fOwner = els.form.querySelector('input[name="ownerId"]');
  const fBirth = els.form.querySelector('input[name="birthdate"]');

  setFieldError(fName,''); setFieldError(fOwner,''); setFieldError(fBirth,'');

  let ok = true;
  if (!required(payload.name))     { setFieldError(fName,'Naam is verplicht'); ok=false; }
  if (!required(payload.ownerId))  { setFieldError(fOwner,'Eigenaar ID is verplicht'); ok=false; }
  if (!validDate(payload.birthdate)) { setFieldError(fBirth,'Ongeldige datum'); ok=false; }

  if (!ok) { els.formMsg.textContent = '❌ Corrigeer de gemarkeerde velden'; return; }

  try {
    els.formMsg.textContent = 'Opslaan…';
    await postAction('Hond', 'add', payload);
    els.form.reset();
    els.formMsg.textContent = '✔️ Toegevoegd';
    await load();
  } catch (err) {
    els.formMsg.textContent = '❌ ' + (err?.message || String(err));
  }
});

// Inline acties + undo
els.tbody?.addEventListener('click', async (e) => {
  const btn = e.target.closest('button'); if (!btn) return;
  const tr = btn.closest('tr'); const id = tr?.dataset.id; if (!id) return;
  const h = CACHE.find(x => x.id === id);

  if (btn.classList.contains('act-edit')) {
    if (editingId && editingId !== id) return;
    editingId = id; render();
  }
  else if (btn.classList.contains('act-cancel')) {
    editingId = null; render();
  }
  else if (btn.classList.contains('act-save')) {
    const name  = $('input[name="name"]', tr)?.value || '';
    const breed = $('input[name="breed"]', tr)?.value || '';
    const birth = $('input[name="birthdate"]', tr)?.value || '';
    const owner = $('input[name="ownerId"]', tr)?.value || '';

    const iName=$('input[name="name"]', tr), iBirth=$('input[name="birthdate"]', tr), iOwner=$('input[name="ownerId"]', tr);
    setFieldError(iName,''); setFieldError(iBirth,''); setFieldError(iOwner,'');

    let ok = true;
    if (!required(name)) { setFieldError(iName,'Verplicht'); ok=false; }
    if (!required(owner)) { setFieldError(iOwner,'Verplicht'); ok=false; }
    if (!validDate(birth)) { setFieldError(iBirth,'Ongeldige datum'); ok=false; }
    if (!ok) { setState('❌ Corrigeer de gemarkeerde velden', true); return; }

    btn.disabled = true; btn.textContent = 'Opslaan…';
    try {
      await postAction('Hond', 'update', { id, name, breed, birthdate: birth, ownerId: owner });
      editingId = null;
      await load();
    } catch (err) {
      setState('❌ Opslaan mislukt: ' + (err?.message || String(err)), true);
      btn.disabled = false; btn.textContent = 'Opslaan';
    }
  }
  else if (btn.classList.contains('act-archive')) {
    if (!confirm('Archiveer deze hond?')) return;
    try {
      lastArchived = { entity:'Hond', id, snapshot: { ...h, archived:false } };
      await postAction('Hond', 'delete', { id });
      await load();

      if (undoTimer) clearTimeout(undoTimer);
      const t = showToast('Hond gearchiveerd', {
        actionLabel: 'Ongedaan maken',
        onAction: async () => {
          if (!lastArchived) return;
          try { await postAction('Hond', 'update', lastArchived.snapshot); await load(); }
          catch (e) { setState('❌ Ongedaan maken faalde: ' + (e?.message || e), true); }
          finally { lastArchived = null; }
        },
        duration: 10_000
      });
      undoTimer = setTimeout(() => { lastArchived = null; t?.close?.(); }, 10_000);
    } catch (err) {
      setState('❌ Archiveren mislukt: ' + (err?.message || String(err)), true);
    }
  }
});

// Boot
document.addEventListener('DOMContentLoaded', async () => {
  if (window.SuperhondUI?.mount) SuperhondUI.mount({ title: 'Honden', icon: '🐶' });
  await load();
});
