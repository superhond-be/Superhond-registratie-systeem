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

function fmtDate(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString(); } catch { return s; }
}

function row(h) {
  const tr = document.createElement('tr');
  tr.dataset.id = h.id || '';
  tr.innerHTML = `
    <td>${escapeHtml(h.name || '—')}</td>
    <td>${escapeHtml(h.breed || '—')}</td>
    <td>${escapeHtml(fmtDate(h.birthdate))}</td>
    <td>${escapeHtml(h.ownerId || '—')}</td>
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
  return list.filter(h =>
    (h.name || '').toLowerCase().includes(ql) ||
    (h.breed || '').toLowerCase().includes(ql) ||
    (h.ownerId || '').toLowerCase().includes(ql)
  );
}

async function load() {
  try {
    setState('⏳ Laden…');
    await initFromConfig();
    const data = await fetchAction('getHonden');
    const active = (data || []).filter(h => String(h.archived).toLowerCase() !== 'true');
    render(active);
    setState(`✔️ ${active.length} honden`);
  } catch (err) {
    console.error(err);
    setState('Fout bij laden van honden: ' + (err?.message || String(err)), true);
  }
}

function render(list) {
  if (!els.tbody) return;
  els.tbody.innerHTML = '';
  const q = els.search?.value || '';
  const filtered = filterRows(list, q);
  if (!filtered.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" class="muted">Geen resultaten.</td>`;
    els.tbody.appendChild(tr);
    return;
  }
  for (const h of filtered) {
    els.tbody.appendChild(row(h));
  }
  // bind archive knoppen
  $$('.act-archive').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.closest('tr')?.dataset.id;
      if (!id) return;
      if (!confirm('Archiveer deze hond?')) return;
      try {
        await postAction('Hond', 'delete', { id });
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
  const payload = Object.fromEntries(fd.entries());
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

// Boot
document.addEventListener('DOMContentLoaded', async () => {
  if (window.SuperhondUI?.mount) {
    SuperhondUI.mount({ title: 'Honden', icon: '🐶' });
  }
  await load();
});
