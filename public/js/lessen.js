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
let lastArchived = null; // { entity:'Les', id, snapshot }

// ───── helpers ─────
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
  try { return new Intl.DateTimeFormat(undefined,{weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(d); }
  catch { return d.toLocaleString(); }
}
function buildIso(dateStr, timeStr) {
  if (!dateStr || !timeStr) return '';
  const local = new Date(`${dateStr}T${timeStr}`);
  if (isNaN(local)) return '';
  return new Date(local.getTime() - local.getTimezoneOffset()*60000).toISOString();
}
function splitIso(iso) {
  const d = parseISO(iso); if (!d) return { date:'', time:'' };
  const pad = (n) => String(n).padStart(2,'0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
  };
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

// ───── render ─────
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
  const inType = mkInput('type', l.type || l.name || l.title || '', 'Type/Naam', true);
  tdType.append(inType);

  const tdDT = document.createElement('td');
  const { date, time } = splitIso(l.date);
  const inDate = mkInput('date', date, 'Datum', true, 'date');
  const inTime = mkInput('time', time, 'Tijd', true, 'time');
  const wrap = document.createElement('div'); wrap.style.display='grid'; wrap.style.gridTemplateColumns='1fr 1fr'; wrap.style.gap='.4rem';
  wrap.append(inDate, inTime); tdDT.append(wrap);

  const tdLoc = document.createElement('td');
  const inLoc = mkInput('location', l.location || l.locatie || '', 'Locatie');
  tdLoc.append(inLoc);

  const tdTr = document.createElement('td');
  const inTr = mkInput('trainer', l.trainer || l.trainers || '', 'Trainer');
  tdTr.append(inTr);

  const tdCap = document.createElement('td');
  const inCap = mkInput('capacity', String(l.capacity ?? 0), 'Cap.', false, 'number'); inCap.querySelector('input').min='0'; inCap.querySelector('input').step='1';
  tdCap.append(inCap);

  const tdAct = document.createElement('td'); tdAct.className='nowrap';
  const bSave = mkBtn('Opslaan','btn btn-primary btn-xs act-save');
  const bCancel= mkBtn('Annuleer','btn btn-secondary btn-xs act-cancel');
  tdAct.append(bSave, bCancel);

  tr.append(tdType, tdDT, tdLoc, tdTr, tdCap, tdAct);
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

// ───── events ─────
els.search?.addEventListener('input', render);
els.refresh?.addEventListener('click', load);

// Toevoegen + inline fouten
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

  const fType = els.form.querySelector('input[name="type"]');
  const fDate = els.form.querySelector('input[name="date"]');
  const fTime = els.form.querySelector('input[name="time"]');
  const fCap  = els.form.querySelector('input[name="capacity"]');

  setFieldError(fType,''); setFieldError(fDate,''); setFieldError(fTime,''); setFieldError(fCap,'');

  let ok = true;
  if (!required(type)) { setFieldError(fType,'Type is verplicht'); ok=false; }
  if (!required(date)) { setFieldError(fDate,'Datum is verplicht'); ok=false; }
  if (!required(time)) { setFieldError(fTime,'Tijd is verplicht'); ok=false; }
  if (capacity !== '' && !nonNegInt(capacity)) { setFieldError(fCap,'Geheel getal ≥ 0'); ok=false; }

  const iso = ok ? buildIso(date, time) : '';
  if (ok && !iso) { setFieldError(fDate,'Ongeldige datum/tijd'); setFieldError(fTime,'Ongeldige datum/tijd'); ok=false; }

  if (!ok) { els.formMsg.textContent = '❌ Corrigeer de gemarkeerde velden'; return; }

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

// Inline bewerken + undo
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

    const iType=$('input[name="type"]', tr), iDate=$('input[name="date"]', tr),
          iTime=$('input[name="time"]', tr), iCap=$('input[name="capacity"]', tr);
    setFieldError(iType,''); setFieldError(iDate,''); setFieldError(iTime,''); setFieldError(iCap,'');

    let ok = true;
    if (!required(type)) { setFieldError(iType,'Verplicht'); ok=false; }
    if (!required(date)) { setFieldError(iDate,'Verplicht'); ok=false; }
    if (!required(time)) { setFieldError(iTime,'Verplicht'); ok=false; }
    if (capacity !== '' && !nonNegInt(capacity)) { setFieldError(iCap,'Geheel getal ≥ 0'); ok=false; }

    const iso = ok ? buildIso(date, time) : '';
    if (ok && !iso) { setFieldError(iDate,'Ongeldige datum/tijd'); setFieldError(iTime,'Ongeldige datum/tijd'); ok=false; }

    if (!ok) { setState('❌ Corrigeer de gemarkeerde velden', true); return; }

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
      lastArchived = { entity:'Les', id, snapshot: { ...l, archived:false } };
      await postAction('Les', 'delete', { id });
      await load();

      if (undoTimer) clearTimeout(undoTimer);
      const t = showToast('Les gearchiveerd', {
        actionLabel: 'Ongedaan maken',
        onAction: async () => {
          if (!lastArchived) return;
          try { await postAction('Les', 'update', lastArchived.snapshot); await load(); }
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
  if (window.SuperhondUI?.mount) SuperhondUI.mount({ title: 'Lessen', icon: '📅' });
  await load();
});
