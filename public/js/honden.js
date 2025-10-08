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

/* ----------------- Helpers ----------------- */
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

function filterRows(list, q) {
  const ql = (q || '').trim().toLowerCase();
  if (!ql) return list;
  return list.filter(h =>
    (h.name || '').toLowerCase().includes(ql) ||
    (h.breed || '').toLowerCase().includes(ql) ||
    (h.ownerId || '').toLowerCase().includes(ql)
  );
}

function btn(label, cls='btn', attrs={}) {
  const b = document.createElement('button'); b.className = cls; b.type = attrs.type || 'button';
  b.textContent = label; Object.entries(attrs).forEach(([k,v]) => { if(k!=='type') b.setAttribute(k,v); });
  return b;
}
function input(name, value='', { type='text', required=false, placeholder='' }={}) {
  const el = document.createElement('input');
  el.name = name; el.value = value ?? '';
  el.className = 'input';
  el.type = type;
  if (placeholder) el.placeholder = placeholder;
  if (required) el.required = true;
  return el;
}

/* ----------------- Row render ----------------- */
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
  const inName = input('name', h.name || '', { required:true, placeholder:'Naam' });
  tdName.append(inName);

  const tdBreed = document.createElement('td');
  const inBreed = input('breed', h.breed || '', { placeholder:'Ras' });
  tdBreed.append(inBreed);

  const tdBirth = document.createElement('td');
  const inBirth = input('birthdate', (h.birthdate || '').slice(0,10), { type:'date' });
  tdBirth.append(inBirth);

  const tdOwner = document.createElement('td');
  const inOwner = input('ownerId', h.ownerId || '', { required:true, placeholder:'Lid-id' });
  tdOwner.append(inOwner);

  const tdAct = document.createElement('td'); tdAct.className='nowrap';
  const bSave = btn('Opslaan', 'btn btn-primary btn-xs act-save');
  const bCancel= btn('Annuleer','btn btn-secondary btn-xs act-cancel');
  tdAct.append(bSave, bCancel);

  tr.append(tdName, tdBreed, tdBirth, tdOwner, tdAct);
  return tr;
}

/* ----------------- Load & render ----------------- */
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

/* ----------------- Events ----------------- */
els.search?.addEventListener('input', render);
els.refresh?.addEventListener('click', load);

els.form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(els.form);
  const payload = Object.fromEntries(fd.entries());
  if (!required(payload.name) || !required(payload.ownerId)) {
    els.formMsg.textContent = '❌ Naam en Eigenaar ID zijn verplicht';
    return;
  }
  if (!validDate(payload.birthdate)) {
    els.formMsg.textContent = '❌ Ongeldige geboortedatum';
    return;
  }
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

    if (!required(name) || !required(owner)) { setState('❌ Naam en Eigenaar ID verplicht', true); return; }
    if (!validDate(birth)) { setState('❌ Ongeldige geboortedatum', true); return; }

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
      await postAction('Hond', 'delete', { id });
      await load();
    } catch (err) {
      setState('❌ Archiveren mislukt: ' + (err?.message || String(err)), true);
    }
  }
});

/* ----------------- Boot ----------------- */
document.addEventListener('DOMContentLoaded', async () => {
  if (window.SuperhondUI?.mount) SuperhondUI.mount({ title: 'Honden', icon: '🐶' });
  await load();
});
