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

let CACHE = [];        // laatst geladen actieve leden
let editingId = null;  // slechts 1 rij tegelijk in edit
let undoTimer = null;  // timeout-id voor undo toast
let lastArchived = null; // { entity:'Lid', id, snapshot }

// ────────────────────────── UI helpers ──────────────────────────
function setState(txt, isError = false) {
  if (!els.state) return;
  els.state.textContent = txt;
  els.state.classList.toggle('error', isError);
}

function escapeHtml(s='') {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function filterRows(list, q) {
  const ql = (q || '').trim().toLowerCase();
  if (!ql) return list;
  return list.filter(k =>
    ((k.naam || `${k.voornaam ?? ''} ${k.achternaam ?? ''}` || '').toLowerCase().includes(ql)) ||
    ((k.email || '').toLowerCase().includes(ql)) ||
    ((k.telefoon || '').toLowerCase().includes(ql))
  );
}

function emailValid(s='') {
  if (!s) return true; // email is optioneel
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}
function phoneValid(s='') {
  if (!s) return true; // optioneel
  return /^[0-9+() \-./]{6,}$/.test(s.trim());
}
function required(v) {
  return String(v ?? '').trim().length > 0;
}

// Inline error labels
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

// Toast (met optional undo)
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
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  const span = document.createElement('span');
  span.textContent = msg;
  el.appendChild(span);

  let timer;
  const close = () => { clearTimeout(timer); el.remove(); };
  if (actionLabel && onAction) {
    const btn = document.createElement('button');
    btn.textContent = actionLabel;
    btn.addEventListener('click', () => { onAction(); close(); });
    el.appendChild(btn);
  } else {
    const m = document.createElement('span'); m.className = 'muted'; m.textContent = ' ';
    el.appendChild(m);
  }
  const x = document.createElement('button'); x.textContent = '×';
  x.setAttribute('aria-label','Sluiten');
  el.appendChild(x);
  x.addEventListener('click', close);

  wrap.appendChild(el);
  timer = setTimeout(close, duration);
  return { close };
}

// ────────────────────────── Row renders ──────────────────────────
function displayRow(l) {
  const tr = document.createElement('tr');
  tr.dataset.id = l.id || '';
  const naam = l.naam || `${l.voornaam ?? ''} ${l.achternaam ?? ''}`.trim() || '—';
  tr.innerHTML = `
    <td>${escapeHtml(naam)}</td>
    <td>${escapeHtml(l.email || '—')}</td>
    <td>${escapeHtml(l.telefoon || '—')}</td>
    <td>${escapeHtml(l.status || '—')}</td>
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
  const vn = l.voornaam || '';
  const an = l.achternaam || '';
  const status = l.status || 'actief';

  const tdNaam = document.createElement('td');
  const g = document.createElement('div'); g.style.display='grid'; g.style.gridTemplateColumns='1fr 1fr'; g.style.gap='.4rem';
  const inVn = mkInput('voornaam', vn, 'Voornaam', true);
  const inAn = mkInput('achternaam', an, 'Achternaam', true);
  g.append(inVn, inAn);
  tdNaam.append(g);

  const tdMail = document.createElement('td');
  const inMail = mkInput('email', l.email || '', 'E-mail', false, 'email');
  tdMail.append(inMail);

  const tdTel = document.createElement('td');
  const inTel = mkInput('telefoon', l.telefoon || '', 'Telefoon');
  tdTel.append(inTel);

  const tdStatus = document.createElement('td');
  const inStatus = mkInput('status', status, 'Status');
  tdStatus.append(inStatus);

  const tdAct = document.createElement('td'); tdAct.className='nowrap';
  const bSave = mkBtn('Opslaan','btn btn-primary btn-xs act-save');
  const bCancel= mkBtn('Annuleer','btn btn-secondary btn-xs act-cancel');
  tdAct.append(bSave, bCancel);

  tr.append(tdNaam, tdMail, tdTel, tdStatus, tdAct);
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

// ────────────────────────── Load & render ──────────────────────────
async function load() {
  try {
    setState('⏳ Laden…');
    await initFromConfig();
    const data = await fetchAction('getLeden');
    CACHE = (data || []).filter(k => String(k.archived).toLowerCase() !== 'true');
    render();
    setState(`✔️ ${CACHE.length} leden`);
  } catch (err) {
    console.error(err);
    setState('Fout bij laden van leden: ' + (err?.message || String(err)), true);
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

// ────────────────────────── Events ──────────────────────────
els.search?.addEventListener('input', render);
els.refresh?.addEventListener('click', load);

// Toevoegformulier + inline fouten
els.form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(els.form);
  const payload = Object.fromEntries(fd.entries());

  // velden
  const fVn = els.form.querySelector('input[name="voornaam"]');
  const fAn = els.form.querySelector('input[name="achternaam"]');
  const fEm = els.form.querySelector('input[name="email"]');
  const fTel= els.form.querySelector('input[name="telefoon"]');

  let ok = true;
  setFieldError(fVn,''); setFieldError(fAn,''); setFieldError(fEm,''); setFieldError(fTel,'');

  if (!required(payload.voornaam)) { setFieldError(fVn, 'Voornaam is verplicht'); ok = false; }
  if (!required(payload.achternaam)) { setFieldError(fAn, 'Achternaam is verplicht'); ok = false; }
  if (!emailValid(payload.email)) { setFieldError(fEm, 'Ongeldig e-mail adres'); ok = false; }
  if (!phoneValid(payload.telefoon)) { setFieldError(fTel, 'Ongeldig telefoonnummer'); ok = false; }

  if (!ok) { els.formMsg.textContent = '❌ Corrigeer de gemarkeerde velden'; return; }

  try {
    els.formMsg.textContent = 'Opslaan…';
    await postAction('Lid', 'add', payload);
    els.form.reset();
    els.formMsg.textContent = '✔️ Toegevoegd';
    await load();
  } catch (err) {
    els.formMsg.textContent = '❌ ' + (err?.message || String(err));
  }
});

// Tabelacties (edit/save/cancel/archive + undo)
els.tbody?.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const tr = btn.closest('tr'); const id = tr?.dataset.id;
  if (!id) return;

  const member = CACHE.find(k => k.id === id);

  if (btn.classList.contains('act-edit')) {
    if (editingId && editingId !== id) return; // 1 tegelijk
    editingId = id; render();
  }
  else if (btn.classList.contains('act-cancel')) {
    editingId = null; render();
  }
  else if (btn.classList.contains('act-save')) {
    const vn = $('input[name="voornaam"]', tr)?.value || '';
    const an = $('input[name="achternaam"]', tr)?.value || '';
    const em = $('input[name="email"]', tr)?.value || '';
    const tel= $('input[name="telefoon"]', tr)?.value || '';
    const st = $('input[name="status"]', tr)?.value || '';

    // inline errors
    const ivn=$('input[name="voornaam"]', tr), ian=$('input[name="achternaam"]', tr),
          iem=$('input[name="email"]', tr),     itel=$('input[name="telefoon"]', tr);
    setFieldError(ivn,''); setFieldError(ian,''); setFieldError(iem,''); setFieldError(itel,'');

    let ok = true;
    if (!required(vn)) { setFieldError(ivn,'Verplicht'); ok=false; }
    if (!required(an)) { setFieldError(ian,'Verplicht'); ok=false; }
    if (!emailValid(em)) { setFieldError(iem,'Ongeldig e-mail'); ok=false; }
    if (!phoneValid(tel)) { setFieldError(itel,'Ongeldig telefoon'); ok=false; }
    if (!ok) { setState('❌ Corrigeer de gemarkeerde velden', true); return; }

    btn.disabled = true; btn.textContent = 'Opslaan…';
    try {
      await postAction('Lid', 'update', { id, voornaam: vn, achternaam: an, email: em, telefoon: tel, status: st });
      editingId = null;
      await load();
    } catch (err) {
      setState('❌ Opslaan mislukt: ' + (err?.message || String(err)), true);
      btn.disabled = false; btn.textContent = 'Opslaan';
    }
  }
  else if (btn.classList.contains('act-archive')) {
    if (!confirm('Archiveer dit lid?')) return;
    try {
      // snapshot voor undo
      lastArchived = { entity: 'Lid', id, snapshot: { ...member, archived: false } };
      await postAction('Lid', 'delete', { id });
      await load();

      // Toast met undo
      if (undoTimer) clearTimeout(undoTimer);
      const t = showToast('Lid gearchiveerd', {
        actionLabel: 'Ongedaan maken',
        onAction: async () => {
          if (!lastArchived) return;
          try { await postAction('Lid', 'update', lastArchived.snapshot); await load(); }
          catch (e) { setState('❌ Ongedaan maken faalde: ' + (e?.message || e), true); }
          finally { lastArchived = null; }
        },
        duration: 10_000
      });
      // automatische reset van snapshot na timeout
      undoTimer = setTimeout(() => { lastArchived = null; t?.close?.(); }, 10_000);
    } catch (err) {
      setState('❌ Archiveren mislukt: ' + (err?.message || String(err)), true);
    }
  }
});

// ────────────────────────── Boot ──────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (window.SuperhondUI?.mount) SuperhondUI.mount({ title: 'Klanten', icon: '👤' });
  await load();
});
