import {
  initFromConfig,
  fetchSheet,
  getBaseUrl // optioneel, voor debug
} from './sheets.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const collator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });

let alleKaarten = [];

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
  );
}

function toArrayRows(x){
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  if (x && Array.isArray(x.rows)) return x.rows;
  if (x && Array.isArray(x.result)) return x.result;
  return [];
}

function normalize(row){
  const o = {};
  for (const [k, v] of Object.entries(row || {})) {
    o[String(k || '').toLowerCase()] = v;
  }
  return {
    id:        (o.id || '').toString(),
    klant:     (o.klant || '').toString(),
    type:      (o.type || '').toString(),
    credits:   (o.credits || '').toString(),
    gebruikt:  (o.gebruikt || '').toString(),
    geldig:    (o.geldig_tot || '').toString(),
    status:    (o.status || '').toString()
  };
}

function renderKaarten(status = 'ALL') {
  const tb = $('#s-tbody');
  const count = $('#s-count');
  const rows = status === 'ALL'
    ? alleKaarten
    : alleKaarten.filter(k => (k.status || '').toLowerCase() === status.toLowerCase());

  tb.innerHTML = '';
  if (!rows.length) {
    tb.innerHTML = `<tr><td colspan="7" class="muted">Geen kaarten gevonden</td></tr>`;
  } else {
    const frag = document.createDocumentFragment();
    for (const k of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(k.klant)}</td>
        <td>${escapeHtml(k.type)}</td>
        <td>${escapeHtml(k.credits)}</td>
        <td>${escapeHtml(k.gebruikt)}</td>
        <td>${escapeHtml(k.geldig)}</td>
        <td>${escapeHtml(k.status)}</td>
        <td class="nowrap">
          <button class="btn btn-xs" title="Bewerken">✏️</button>
        </td>`;
      frag.appendChild(tr);
    }
    tb.appendChild(frag);
  }
  count.textContent = `${rows.length} kaart${rows.length === 1 ? '' : 'en'}`;
}

async function loadStrippenkaarten(){
  const loader = $('#s-loader');
  const error  = $('#s-error');
  loader.style.display = '';
  error.hidden = true;

  try {
    const raw = await fetchSheet('Strippenkaarten');
    const rows = toArrayRows(raw);
    alleKaarten = rows.map(normalize).sort((a,b) =>
      collator.compare(a.klant, b.klant)
    );
    renderKaarten($('#status')?.value || 'ALL');
  } catch (e) {
    console.error('[Strippenkaarten] laden mislukt:', e);
    error.hidden = false;
    error.textContent = `❌ Laden mislukt: ${e?.message || e}`;
  } finally {
    loader.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await initFromConfig();
  console.info('[Strippenkaarten] exec base =', getBaseUrl?.() || '(onbekend)');
  $('#status')?.addEventListener('change', e => renderKaarten(e.target.value));
  await loadStrippenkaarten();
});
