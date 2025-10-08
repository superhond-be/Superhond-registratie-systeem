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

/* ----------------- Helpers ----------------- */
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

function btn(label, cls='btn', attrs={}) {
  const b = document.createElement('button');
  b.className = cls;
  b.type = attrs.type || 'button';
  b.textContent = label;
  Object.entries(attrs).forEach(([k,v]) => { if(k!=='type') b.setAttribute(k,v); });
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
  const inVn = input('voornaam', vn, { placeholder:'Voornaam', required:true });
  const inAn = input('achternaam', an, { placeholder:'Achternaam', required:true });
  g.append(inVn, inAn);
  tdNaam.append(g);

  const tdMail = document.createElement('td');
  const inMail = input('email', l.email || '', { type:'email', placeholder:'E-mail' });
  tdMail.append(inMail);

  const tdTel = document.createElement('td');
  const inTel = input('telefoon', l.telefoon || '', { placeholder:'Telefoon' });
  tdTel.append(inTel);

  const tdStatus = document.createElement('td');
  const inStatus = input('status', status, { placeholder:'Status' });
  tdStatus.append(inStatus);

  const tdAct = document.createElement('td'); tdAct.className='nowrap';
  const bSave = btn('Opslaan', 'btn btn-primary btn-xs act-save');
  const bCancel= btn('Annuleer','btn btn-secondary btn-xs act-cancel');
  tdAct.append(bSave, bCancel);

  tr.append(tdNaam, tdMail, tdTel, tdStatus, tdAct);
  return tr;
}

/* ----------------- Load & render ----------------- */
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

/* ----------------- Events ----------------- */
els.search?.addEventListener('input', render);
els.refresh?.addEventListener('click', load);

els.form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(els.form);
  const payload = Object.fromEntries(fd.entries());
  if (!required(payload.voornaam) || !required(payload.achternaam)) {
    els.formMsg.textContent = '❌ Voornaam en Achternaam zijn verplicht';
    return;
  }
  if (!emailValid(payload.email) || !phoneValid(payload.telefoon)) {
    els.formMsg.textContent = '❌ Ongeldig e-mail of telefoonnummer';
    return;
  }
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

els.tbody?.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const tr = btn.closest('tr'); const id = tr?.dataset.id;
  if (!id) return;
  const member = CACHE.find(k => k.id === id);

  if (btn.classList.contains('act-edit')) {
    if (editingId && editingId !== id) return; // 1 tegelijk
    editingId = id;
    render();
  }
  else if (btn.classList.contains('act-cancel')) {
    editingId = null;
    render();
  }
  else if (btn.classList.contains('act-save')) {
    // lees inputs
    const vn = $('input[name="voornaam"]', tr)?.value || '';
    const an = $('input[name="achternaam"]', tr)?.value || '';
    const em = $('input[name="email"]', tr)?.value || '';
    const tel = $('input[name="telefoon"]', tr)?.value || '';
    const st = $('input[name="status"]', tr)?.value || '';

    // validatie
    if (!required(vn) || !required(an)) {
      setState('❌ Voornaam en Achternaam zijn verplicht', true); return;
    }
    if (!emailValid(em)) {
      setState('❌ Ongeldig e-mail adres', true); return;
    }
    if (!phoneValid(tel)) {
      setState('❌ Ongeldig telefoonnummer', true); return;
    }

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
      await postAction('Lid', 'delete', { id });
      await load();
    } catch (err) {
      setState('❌ Archiveren mislukt: ' + (err?.message || String(err)), true);
    }
  }
});

/* ----------------- Boot ----------------- */
document.addEventListener('DOMContentLoaded', async () => {
  if (window.SuperhondUI?.mount) SuperhondUI.mount({ title: 'Klanten', icon: '👤' });
  await load();
});
