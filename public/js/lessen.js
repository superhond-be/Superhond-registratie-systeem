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
function required(v) { return String(v ?? '').trim().length > 0; }
function nonNegInt(v) { const n = Number(v); return Number.isFinite(n) && n >= 0 && Math.floor(n) === n; }
function parseISO(v){ const d = new Date(v); return isNaN(d)?null:d; }
function fmtDT(d) {
  try {
    return new Intl.DateTimeFormat(undefined, { weekday:'short', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }).format(d);
  } catch { return d.toLocaleString(); }
}
/** Bouw ISO van lokale date+time (UTC) */
function buildIso(dateStr, timeStr) {
  if (!dateStr || !timeStr) return '';
  const local = new Date(`${dateStr}T${timeStr}`);
  if (isNaN(local)) return '';
  return new Date(local.getTime() - local.getTimezoneOffset()*60000).toISOString();
}
/** Split ISO naar yyyy-mm-dd + HH:MM lokale tijd */
function splitIso(iso) {
  const d = parseISO(iso); if (!d) return { date:'', time:'' };
  const pad = (n) => String(n).padStart(2,'0');
  const y = d.getFullYear(), m = pad(d.getMonth()+1), da = pad(d.getDate());
  const hh = pad(d.getHours()), mm = pad(d.getMinutes());
  return { date: `${y}-${m}-${da}`, time: `${hh}:${mm}` };
}

function filterRows(list, q) {
  const ql = (q || '').trim().toLowerCase();
  if (!ql) return list;
  return list.filter(l =>
    (l.type || l.name || l.title || '').toLowerCase().includes(ql) ||
    (l.location || l.locatie || '').toLowerCase().includes(ql) ||
    (l.trainer || l.trainers || '').toLowerCase().includes(ql)
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
function displayRow(l) {
  const tr = document.createElement('tr');
  tr.dataset.id = l.id || '';
  const d = parseISO(l.date);
  const name = l.name || l.title || l.type || 'Les';
  const cap = (l.capacity ?? '') === '' ? '—' : String(l.capacity);
  const loc = l.location || l.locatie || '—';
  const trainer = l.trainer || l.trainers || '—';
  tr.innerHTML = `
    <td>${escapeHtml(name)}</td>
    <td>${d ? escapeHtml(fmtDT(d)) : '—'}</td>
    <td>${escapeHtml(loc)}</td>
    <td>${escapeHtml(trainer)}</td>
    <td>${escapeHtml(cap)}</td>
    <td class="nowrap">
      <button class="btn btn-secondary btn-xs act-edit">Bewerk</button>
      <button class="btn btn-danger btn-xs act-archive">Archiveer</button>
    </td>
  `;
  return tr;
}

function editRow(l) {
  const tr = document.createElement('tr');
  tr.dataset.id = l.id || '';

  const tdType = document.createElement('td');
  const inType = input('type', l.type || l.name || l.title || '', { required:true, placeholder:'Type/Naam' });
  tdType.append(inType);

  const tdDT = document.createElement('td');
  const { date, time } = splitIso(l.date);
  const inDate = input('date', date, { type:'date', required:true });
  const inTime = input('time', time, { type:'time', required:true });
  const wrap = document.createElement('div'); wrap.style.display='grid'; wrap.style.gridTemplateColumns='1fr 1fr'; wrap.style.gap='.4rem';
  wrap.append(inDate, inTime); tdDT.append(wrap);

  const tdLoc = document.createElement('td');
  const inLoc = input('location', l.location || l.locatie || '', { placeholder:'Locatie' });
  tdLoc.append(inLoc);

  const tdTr = document.createElement('td');
  const inTr = input('trainer', l.trainer || l.trainers || '', { placeholder:'Trainer' });
  tdTr.append(inTr);

  const tdCap = document.createElement('td');
  const inCap = input('capacity', String(l.capacity ?? 0), { type:'number', placeholder:'Cap.', });
  inCap.min = '0'; inCap.step = '1';
  tdCap.append(inCap);

  const tdAct = document.createElement('td'); tdAct.className='nowrap';
  const bSave = btn('Opslaan', 'btn btn-primary btn-xs act-save');
  const bCancel= btn('Annuleer','btn btn-secondary btn-xs act-cancel');
  tdAct.append(bSave, bCancel);

  tr.append(tdType, tdDT, tdLoc, tdTr, tdCap, tdAct);
  return tr;
}

/* ----------------- Load & render ----------------- */
async function load() {
  try {
    setState('⏳ Laden…');
    await initFromConfig();
    const data = await fetchAction('getLessen');
    CACHE = (data || []).filter(l => String(l.archived).toLowerCase() !== 'true');
    CACHE.sort((a,b) => (parseISO(a.date)?.getTime() ?? 0) - (parseISO(b.date)?.getTime() ?? 0));
    render();
    setState(`✔️ ${CACHE.length} lessen`);
  } catch (err) {
    console.error(err);
    setState('Fout bij laden van lessen: ' + (err?.message || String(err)), true);
  }
}

function render() {
  if (!els.tbody) return;
  els.tbody.innerHTML = '';
  const list = filterRows(CACHE, els.search?.value || '');
  if (!list.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" class="muted">Geen resultaten.</td>`;
    els.tbody.appendChild(tr);
    return;
  }
  for (const l of list) {
    const tr = (editingId && editingId === l.id) ? editRow(l) : displayRow(l);
    els.tbody.appendChild(tr);
  }
}

/* ----------------- Events ----------------- */
els.search?.addEventListener('input', render);
els.refresh?.addEventListener('click', load);

els.form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(els.form);
  const type = fd.get('type') || '';
  const trainer = fd.get('trainer') || '';
  const location = fd.get('location') || '';
  const capacity = fd.get('capacity') || '';
  const date = fd.get('date') || '';
  const time = fd.get('time') || '';
  const notes = fd.get('notes') || '';

  if (!required(type)) { els.formMsg.textContent = '❌ Type is verplicht'; return; }
  if (!required(date) || !required(time)) { els.formMsg.textContent = '❌ Datum en tijd zijn verplicht'; return; }
  if (capacity !== '' && !nonNegInt(capacity)) { els.formMsg.textContent = '❌ Capaciteit moet een geheel getal ≥ 0 zijn'; return; }

  const iso = buildIso(date, time);
  if (!iso) { els.formMsg.textContent = '❌ Ongeldige datum/tijd'; return; }

  try {
    els.formMsg.textContent = 'Opslaan…';
    await postAction('Les', 'add', { type, trainer, location, capacity:Number(capacity||0), notes, date: iso });
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
  const l = CACHE.find(x => x.id === id);

  if (btn.classList.contains('act-edit')) {
    if (editingId && editingId !== id) return;
    editingId = id; render();
  }
  else if (btn.classList.contains('act-cancel')) {
    editingId = null; render();
  }
  else if (btn.classList.contains('act-save')) {
    const type = $('input[name="type"]', tr)?.value || '';
    const date = $('input[name="date"]', tr)?.value || '';
    const time = $('input[name="time"]', tr)?.value || '';
    const location = $('input[name="location"]', tr)?.value || '';
    const trainer = $('input[name="trainer"]', tr)?.value || '';
    const capacity = $('input[name="capacity"]', tr)?.value || '';

    if (!required(type)) { setState('❌ Type is verplicht', true); return; }
    if (!required(date) || !required(time)) { setState('❌ Datum en tijd verplicht', true); return; }
    if (capacity !== '' && !nonNegInt(capacity)) { setState('❌ Capaciteit moet een geheel getal ≥ 0 zijn', true); return; }

    const iso = buildIso(date, time);
    if (!iso) { setState('❌ Ongeldige datum/tijd', true); return; }

    btn.disabled = true; btn.textContent = 'Opslaan…';
    try {
      await postAction('Les', 'update', { id, type, trainer, location, capacity: Number(capacity||0), date: iso });
      editingId = null;
      await load();
    } catch (err) {
      setState('❌ Opslaan mislukt: ' + (err?.message || String(err)), true);
      btn.disabled = false; btn.textContent = 'Opslaan';
    }
  }
  else if (btn.classList.contains('act-archive')) {
    if (!confirm('Archiveer deze les?')) return;
    try {
      await postAction('Les', 'delete', { id });
      await load();
    } catch (err) {
      setState('❌ Archiveren mislukt: ' + (err?.message || String(err)), true);
    }
  }
});

/* ----------------- Boot ----------------- */
document.addEventListener('DOMContentLoaded', async () => {
  if (window.SuperhondUI?.mount) SuperhondUI.mount({ title: 'Lessen', icon: '📅' });
  await load();
});
