// /public/lessenreeks/index.js — robuuste loader + duidelijke fouten
(() => {
  const $ = s => document.querySelector(s);
  const S = v => String(v ?? '').trim();

  const els = {
    loader: $('#loader'),
    error:  $('#error'),
    wrap:   $('#wrap'),
    tbody:  document.querySelector('#tabel tbody'),
    zoek:   $('#zoek'),
  };

  // Topbar mount
  document.addEventListener('DOMContentLoaded', () => {
    if (window.SuperhondUI?.mount) {
      SuperhondUI.mount({ title: 'Lessenreeksen', icon: '📦', back: '../dashboard/' });
    }
  });

  // ----------- helpers -----------
  const bust = u => u + (u.includes('?') ? '&' : '?') + 't=' + Date.now();
  const euro = n => (n == null || isNaN(n)) ? '—'
    : new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(Number(n));
  const escapeHTML = (s='') => String(s)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#39;');

  async function fetchJson(tryUrls, timeoutMs=4000) {
    const ctrl = new AbortController();
    const to = setTimeout(()=>ctrl.abort(), timeoutMs);
    try {
      for (const u of tryUrls) {
        try {
          const r = await fetch(bust(u), { cache:'no-store', signal: ctrl.signal });
          if (r.ok) { clearTimeout(to); return r.json(); }
        } catch (_err) { /* volgende url proberen */ }
      }
      clearTimeout(to);
      return null;
    } catch (err) {
      clearTimeout(to);
      return null;
    }
  }

  function loadDB() {
    try {
      const raw = localStorage.getItem('superhond-db');
      const db  = raw ? JSON.parse(raw) : {};
      db.series = Array.isArray(db.series) ? db.series : [];
      return db;
    } catch {
      return { series: [] };
    }
  }

  function normalizeSeries(raw) {
    if (!raw) return [];
    const arr =
      Array.isArray(raw) ? raw :
      Array.isArray(raw?.reeksen) ? raw.reeksen :
      Array.isArray(raw?.series) ? raw.series :
      Array.isArray(raw?.items)  ? raw.items  :
      Array.isArray(raw?.data)   ? raw.data   : [];

    return arr.map(r => {
      const id   = r.id ?? r.reeksId ?? r.seriesId ?? null;
      const pkg  = r.packageName ?? r.pakket ?? r.pkg ?? r.naam ?? r.name ?? '';
      const ser  = r.seriesName  ?? r.reeks   ?? r.serie ?? '';
      const name = S([pkg, ser].filter(Boolean).join(' — ')) || S(r.naam || r.name || '');
      const thema= r.theme ?? r.thema ?? '';
      const cnt  = Number(r.count ?? r.aantal ?? r.lessonsCount ??
                    (Array.isArray(r.lessen) ? r.lessen.length :
                     Array.isArray(r.lessons)? r.lessons.length : 0)) || 0;
      const price= Number(r.price ?? r.prijs ?? r.prijs_excl ?? 0);
      const rec  = r.recurrence || r.herhaling || {};
      const startTime   = S(rec.startTime || r.startTime || '');
      const durationMin = Number(rec.durationMin ?? r.durationMin ?? 0) || 0;
      const endTime     = (startTime && durationMin>0) ? addMinutes(startTime, durationMin) : '';
      const status = S(r.status || 'actief').toLowerCase();
      return { id, name, thema, count: cnt, price, startTime, endTime, status };
    });
  }

  function addMinutes(hhmm='00:00', m=0){
    const [hStr, mStr] = String(hhmm).split(':');
    const base = (Number(hStr||0)*60 + Number(mStr||0) + Number(m||0));
    const hh = Math.floor(((base%1440)+1440)%1440/60);
    const mm = ((base%60)+60)%60;
    const pad = n=>String(n).padStart(2,'0');
    return `${pad(hh)}:${pad(mm)}`;
  }

  function mergeById(primary=[], secondary=[]){
    const key = x => S(x.id) || S(x.name);
    const map = new Map(secondary.map(x=>[key(x),x])); // lokaal eerst
    for (const p of primary) map.set(key(p), p);       // extern overschrijft
    return [...map.values()];
  }

  // ----------- render -----------
  function actionsHTML(r){
    if (!r.id) return '';
    const idEnc = encodeURIComponent(r.id);
    return `
      <div class="icon-actions">
        <a class="icon-btn" href="./detail.html?id=${idEnc}" title="Bekijken"><i class="icon">👁</i></a>
        <a class="icon-btn" href="./bewerken.html?id=${idEnc}" title="Bewerken"><i class="icon">✏️</i></a>
        <button class="icon-btn" data-action="delete" data-id="${escapeHTML(r.id)}" title="Verwijderen"><i class="icon">🗑</i></button>
      </div>
    `;
  }
  function rowHTML(r){
    const tijd = (r.startTime && r.endTime) ? `${r.startTime} — ${r.endTime}` : '—';
    return `
      <tr>
        <td>${r.id ? `<a href="./detail.html?id=${encodeURIComponent(r.id)}">${escapeHTML(r.name)}</a>` : escapeHTML(r.name)}</td>
        <td>${escapeHTML(r.thema || '—')}</td>
        <td>${tijd}</td>
        <td>${r.count || 0}</td>
        <td style="text-align:right">${(r.price || r.price===0) ? euro(r.price) : '—'}</td>
        <td>${actionsHTML(r)}</td>
      </tr>
    `;
  }
  function renderTable(rows){
    els.tbody.innerHTML = rows.map(rowHTML).join('') || '';
    els.loader.style.display = 'none';
    els.wrap.style.display = rows.length ? '' : '';
    if (!rows.length) {
      // toon lege staat
      els.tbody.innerHTML = `<tr><td colspan="6" class="muted">Geen reeksen gevonden.</td></tr>`;
    }
  }

  function bindDelete(rows){
    els.tbody.addEventListener('click', (e)=>{
      const btn = e.target.closest('[data-action="delete"]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      if (!id) return;
      if (!confirm('Deze lessenreeks verwijderen?')) return;

      const db = loadDB();
      db.series = (db.series||[]).filter(s => String(s.id) !== String(id));
      localStorage.setItem('superhond-db', JSON.stringify(db));

      const next = rows.filter(r => String(r.id) !== String(id));
      renderTable(next);
    });
  }

  // ----------- init -----------
  async function init(){
    try{
      els.loader.style.display = '';
      els.error.style.display  = 'none';
      els.wrap.style.display   = 'none';

      const [ext, db] = await Promise.all([
        fetchJson(['../data/lessenreeksen.json','/data/lessenreeksen.json']),
        Promise.resolve(loadDB())
      ]);

      const extRows = normalizeSeries(ext);
      const locRows = normalizeSeries({ series: db.series });
      const all = mergeById(extRows, locRows)
        .sort((a,b)=>String(a.name).localeCompare(String(b.name)));

      renderTable(all);

      // zoek
      els.zoek?.addEventListener('input', ()=>{
        const q = S(els.zoek.value).toLowerCase();
        const f = !q ? all : all.filter(r =>
          (r.name||'').toLowerCase().includes(q) ||
          (r.thema||'').toLowerCase().includes(q)
        );
        renderTable(f);
      });

      bindDelete(all);

    }catch(err){
      els.loader.style.display = 'none';
      els.error.style.display  = '';
      els.error.textContent    = '⚠️ Fout bij laden: ' + (err?.message || err);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
