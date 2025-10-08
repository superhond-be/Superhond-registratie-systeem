import { fetchAction, postAction, initFromConfig } from './sheets.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const els = {
  state: $('#state'),
  tbody: $('#tbl tbody'),
  search: $('#search'),
  refresh: $('#refresh'),
  form: $('#form-add'),
  formMsg: $('#form-msg')
};

function setState(txt, isError = false) {
  if (!els.state) return;
  els.state.textContent = txt;
  els.state.classList.toggle('error', isError);
}

function parseISO(v) { const d = new Date(v); return isNaN(d) ? null : d; }
function fmtDT(d) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday:'short', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'
    }).format(d);
  } catch { return d.toLocaleString(); }
}

function row(l) {
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
    <td><button class="btn btn-danger btn-xs act-archive">Archiveer</button></td>
  `;
  return tr;
}
function escapeHtml(s='') {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function filterRows(list, q) {
  const ql = q.trim().toLowerCase();
  if (!ql) return list;
  return list.filter(l =>
    (l.name || l.title || l.type || '').toLowerCase().includes(ql) ||
    (l.location || l.locatie || '').toLowerCase().includes(ql) ||
    (l.trainer || l.trainers || '').toLowerCase().includes(ql)
  );
}

async function load() {
  try {
    setState('⏳ Laden…');
    await initFromConfig();
    const data = await fetchAction('getLessen');
    const active = (data || []).filter(l => String(l.archived).toLowerCase() !== 'true');
    // sorteer op datum
    active.sort((a, b) => (parseISO(a.date)?.getTime() ?? 0) - (parseISO(b.date)?.getTime() ?? 0));
    render(active);
    setState(`✔️ ${active.length} lessen`);
  } catch (err) {
    console.error(err);
    setState('Fout bij laden van lessen: ' + (err?.message || String(err)), true);
  }
}

function render(list) {
  if (!els.tbody) return;
  els.tbody.innerHTML = '';
  const q = els.search?.value || '';
  const filtered = filterRows(list, q);
  if (!filtered.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" class="muted">Geen resultaten.</td>`;
    els.tbody.appendChild(tr);
    return;
  }
  for (const l of filtered) {
    els.tbody.appendChild(row(l));
  }
  // bind archive knoppen
  $$('.act-archive').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.closest('tr')?.dataset.id;
      if (!id) return;
      if (!confirm('Archiveer deze les?')) return;
      try {
        await postAction('Les', 'delete', { id });
        await load();
      } catch (e) {
        alert('Archiveren mislukt: ' + (e?.message || e));
      }
    });
  });
}

els.search?.addEventListener('input', () => load());
els.refresh?.addEventListener('click', () => load());

els.form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(els.form);
  // Maak ISO datetime (UTC) van date + time; laat locatie/trainer/type netjes door
  const date = fd.get('date');
  const time = fd.get('time');
  let iso = '';
  if (date && time) {
    const local = new Date(`${date}T${time}`);
    iso = new Date(local.getTime() - (local.getTimezoneOffset() * 60000)).toISOString();
  }
  const payload = {
    type: fd.get('type') || '',
    trainer: fd.get('trainer') || '',
    capacity: Number(fd.get('capacity') || 0),
    location: fd.get('location') || '',
    notes: fd.get('notes') || '',
    date: iso
  };
  try {
    els.formMsg.textContent = 'Opslaan…';
    await postAction('Les', 'add', payload);
    els.form.reset();
    els.formMsg.textContent = '✔️ Toegevoegd';
    await load();
  } catch (err) {
    els.formMsg.textContent = '❌ ' + (err?.message || String(err));
  }
});

// Boot
document.addEventListener('DOMContentLoaded', async () => {
  if (window.SuperhondUI?.mount) {
    SuperhondUI.mount({ title: 'Lessen', icon: '📅' });
  }
  await load();
});
