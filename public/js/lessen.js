/**
 * public/js/lessen.js — Lijst + zoeken + toevoegen + inline bewerken (v0.21.1)
 * Werkt met public/js/sheets.js (proxy-first, retries, timeouts)
 */

import { fetchAction, fetchSheet, postAction, initFromConfig } from '../js/sheets.js';

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

/* ────────────── Utils ────────────── */
function setState(text, kind = 'muted'){
  if (!els.state) return;
  els.state.className = kind; // 'muted' | 'error'
  els.state.textContent = text;
}
function escapeHtml(s='') {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function required(v){ return String(v ?? '').trim().length > 0; }
function nonNegInt(v){ const n = Number(v); return Number.isFinite(n) && n >= 0 && Math.floor(n) === n; }
function parseISO(v){ const d = new Date(v); return isNaN(d) ? null : d; }
function fmtDT(d){
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday:'short', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'
    }).format(d);
  } catch { return d.toLocaleString(); }
}
/* Date 'YYYY-MM-DD' + time 'HH:mm' → ISO in UTC (GAS veilig) */
function buildIso(dateStr, timeStr) {
  if (!dateStr || !timeStr) return '';
  const local = new Date(`${dateStr}T${timeStr}`);
  if (isNaN(local)) return '';
  // normaliseer naar ISO (UTC) maar behoud lokale bedoeling
  return new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString();
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
    (l.trainer || l.trainers || '').toLowerCase().includes(ql) ||
    (l.notes || '').toLowerCase().includes(ql)
  );
}
function debounce(fn, ms = 200) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* Form errors (sluit aan op jouw CSS) */
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

/* Toast integratie (val terug op simpele variant) */
function toast(msg, type='info', { actionLabel, onAction, duration = 10_000 } = {}) {
  if (typeof window.SuperhondToast === 'function') {
    window.SuperhondToast(msg, type, { undo: onAction, duration });
    return { close(){} };
  }
  // fallback
  let cont = document.querySelector('.toast-container');
  if (!cont) {
    cont = document.createElement('div');
    cont.className = 'toast-container';
    document.body.appendChild(cont);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${escapeHtml(msg)}</span>`;
  if (actionLabel && onAction) {
    const b = document.createElement('button');
    b.textContent = actionLabel;
    b.onclick = () => { onAction(); el.remove(); };
    el.appendChild(b);
  }
  const x = document.createElement('button');
  x.setAttribute('aria-label','Sluiten');
  x.textContent = '×';
  x.onclick = () => el.remove();
  el.appendChild(x);
  cont.appendChild(el);
  const t = setTimeout(() => el.remove(), duration);
  return { close(){ clearTimeout(t); el.remove(); } };
}

/* ────────────── Renders ────────────── */
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
      <button class="btn btn-xs act-edit">Bewerk</button>
      <button class="btn btn-xs act-archive">Archiveer</button>
    </td>
  `;
  return tr;
}

function mkInput(name, value='', placeholder='', required=false, type='text'){
  const wrap = document.createElement('div');
  const el = document.createElement('input');
  el.name = name; el.value = value ?? ''; el.placeholder = placeholder;
  el.className = 'input'; el.type = type; if (required) el.required = true;
  wrap.appendChild(el);
  return wrap;
}
function mkBtn(label, cls){ const b=document.createElement('button'); b.type='button'; b.className=cls; b.textContent=label; return b; }

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
  const wrap = document.createElement('div');
  wrap.style.display='grid'; wrap.style.gridTemplateColumns='1fr 1fr'; wrap.style.gap='.4rem';
  wrap.append(inDate, inTime); tdDT.append(wrap);

  const tdLoc = document.createElement('td');
  const inLoc = mkInput('location', l.location || l.locatie || '', 'Locatie');
  tdLoc.append(inLoc);

  const tdTr = document.createElement('td');
  const inTr = mkInput('trainer', l.trainer || l.trainers || '', 'Trainer');
  tdTr.append(inTr);

  const tdCap = document.createElement('td');
  const inCap = mkInput('capacity', String(l.capacity ?? 0), 'Cap.', false, 'number');
  const capInput = inCap.querySelector('input'); capInput.min='0'; capInput.step='1';
  tdCap.append(inCap);

  const tdAct = document.createElement('td'); tdAct.className='nowrap';
  const bSave   = mkBtn('Opslaan','btn btn-xs act-save');
  const bCancel = mkBtn('Annuleer','btn btn-xs act-cancel');
  tdAct.append(bSave, bCancel);

  // Enter in velden -> opslaan
  $$('input', tr).forEach(inp => {
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); bSave.click(); }
    });
  });

  tr.append(tdType, tdDT, tdLoc, tdTr, tdCap, tdAct);
  return tr;
}

/* ────────────── Data flow ────────────── */
async function load() {
  try {
    setState('⏳ Laden…', 'muted');
    await initFromConfig();

    let data = [];
    try {
      data = await fetchAction('getLessen');     // moderne route
    } catch {
      data = await fetchSheet('Lessen');         // fallback
    }

    CACHE = (data || []).filter(l => String(l.archived).toLowerCase() !== 'true');
    CACHE.sort((a,b) => (parseISO(a.date)?.getTime() ?? 0) - (parseISO(b.date)?.getTime() ?? 0));
    render();
    setState(`✅ ${CACHE.length} les${CACHE.length===1?'':'sen'} geladen`, 'muted');
  } catch (err) {
    console.error(err);
    setState('❌ Fout bij laden van lessen: ' + (err?.message || String(err)), 'error');
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

/* ────────────── Events ────────────── */
// Zoeken met debounce
els.search?.addEventListener('input', debounce(render, 150));
els.refresh?.addEventListener('click', load);

// Toevoegen
els.form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors(els.form);

  const fd = new FormData(els.form);
  const type     = (fd.get('type')     || '').toString().trim();
  const trainer  = (fd.get('trainer')  || '').toString().trim();
  const location = (fd.get('location') || '').toString().trim();
  const capacity = (fd.get('capacity') || '').toString().trim();
  const date     = (fd.get('date')     || '').toString().trim();
  const time     = (fd.get('time')     || '').toString().trim();
  const notes    = (fd.get('notes')    || '').toString().trim();

  const iType = els.form.querySelector('input[name="type"]');
  const iDate = els.form.querySelector('input[name="date"]');
  const iTime = els.form.querySelector('input[name="time"]');
  const iCap  = els.form.querySelector('input[name="capacity"]');

  let ok = true;
  if (!required(type)) { setFieldError(iType,'Type is verplicht'); ok=false; }
  if (!required(date)) { setFieldError(iDate,'Datum is verplicht'); ok=false; }
  if (!required(time)) { setFieldError(iTime,'Tijd is verplicht'); ok=false; }
  if (capacity !== '' && !nonNegInt(capacity)) { setFieldError(iCap,'Geheel getal ≥ 0'); ok=false; }

  const iso = ok ? buildIso(date, time) : '';
  if (ok && !iso) { setFieldError(iDate,'Ongeldige datum/tijd'); setFieldError(iTime,'Ongeldige datum/tijd'); ok=false; }

  if (!ok) { els.formMsg.textContent = '❌ Corrigeer de gemarkeerde velden'; els.formMsg.className = 'error'; return; }

  try {
    els.formMsg.textContent = '⏳ Opslaan…'; els.formMsg.className = 'muted';
    await postAction('Les', 'add', { type, trainer, location, capacity:Number(capacity||0), notes, date: iso });
    els.form.reset();
    els.formMsg.textContent = '✅ Toegevoegd';
    await load();
    toast('Les toegevoegd','ok');
  } catch (err) {
    els.formMsg.textContent = '❌ ' + (err?.message || String(err));
    els.formMsg.className = 'error';
  }
});

// Inline acties
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
    const type     = $('input[name="type"]', tr)?.value || '';
    const date     = $('input[name="date"]', tr)?.value || '';
    const time     = $('input[name="time"]', tr)?.value || '';
    const location = $('input[name="location"]', tr)?.value || '';
    const trainer  = $('input[name="trainer"]', tr)?.value || '';
    const capacity = $('input[name="capacity"]', tr)?.value || '';

    clearErrors(tr);
    let ok = true;
    if (!required(type)) { setFieldError($('input[name="type"]', tr),'Verplicht'); ok=false; }
    if (!required(date)) { setFieldError($('input[name="date"]', tr),'Verplicht'); ok=false; }
    if (!required(time)) { setFieldError($('input[name="time"]', tr),'Verplicht'); ok=false; }
    if (capacity !== '' && !nonNegInt(capacity)) { setFieldError($('input[name="capacity"]', tr),'Geheel getal ≥ 0'); ok=false; }

    const iso = ok ? buildIso(date, time) : '';
    if (ok && !iso) { setFieldError($('input[name="date"]', tr),'Ongeldige datum/tijd'); setFieldError($('input[name="time"]', tr),'Ongeldige datum/tijd'); ok=false; }
    if (!ok) { setState('❌ Corrigeer de gemarkeerde velden', 'error'); return; }

    btn.disabled = true; const oldLabel = btn.textContent; btn.textContent = 'Opslaan…';
    try {
      await postAction('Les', 'update', {
        id, type, trainer, location, capacity: Number(capacity||0), date: iso
      });
      editingId = null;
      await load();
      toast('Wijzigingen opgeslagen','ok');
    } catch (err) {
      setState('❌ Opslaan mislukt: ' + (err?.message || String(err)), 'error');
      btn.disabled = false; btn.textContent = oldLabel;
    }
  }
  else if (btn.classList.contains('act-archive')) {
    if (!confirm('Archiveer deze les?')) return;
    try {
      lastArchived = { entity:'Les', id, snapshot: { ...l, archived:false } };
      await postAction('Les', 'delete', { id });
      await load();

      if (undoTimer) clearTimeout(undoTimer);
      const t = toast('Les gearchiveerd', 'info', {
        actionLabel: 'Ongedaan',
        onAction: async () => {
          if (!lastArchived) return;
          try { await postAction('Les','update', lastArchived.snapshot); await load(); toast('Hersteld','ok'); }
          catch (e) { setState('❌ Ongedaan maken faalde: ' + (e?.message || e), 'error'); }
          finally { lastArchived = null; }
        },
        duration: 10_000
      });
      undoTimer = setTimeout(() => { lastArchived = null; t?.close?.(); }, 10_000);
    } catch (err) {
      setState('❌ Archiveren mislukt: ' + (err?.message || String(err)), 'error');
    }
  }
});

/* ────────────── Boot ────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // Uniforme topbar (subpage = blauw) + back naar dashboard
  if (window.SuperhondUI?.mount) {
    document.body.classList.add('subpage');
    SuperhondUI.mount({ title: 'Lessen', icon: '📅', back: '../dashboard/' });
  }
  await load();
});
