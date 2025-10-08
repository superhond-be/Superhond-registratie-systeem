/**
 * public/js/agenda.js — Agenda-weergave (week/alles) op dashboard
 * - Haalt lessen via action=getLessen
 * - Vult tellers & tabel
 */

import { fetchAction } from './sheets.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const els = {
  loader:  $('#agenda-loader'),
  error:   $('#agenda-error'),
  tableWrap: $('#agenda-table-wrap'),
  tbody:   $('#agenda-table tbody'),
  dotWeek: $('#tab-week-dot'),
  dotAll:  $('#tab-all-dot'),
  dotNotes:$('#tab-notes-dot'),
  subLessen: $('#lessen-week-sub'),
  badgeLessen: $('#lessen-week-badge')
};

function show(el)   { if (el) el.style.display = ''; }
function hide(el)   { if (el) el.style.display = 'none'; }
function setText(el, txt) { if (el) el.textContent = String(txt); }

/* ===== Datum helpers (week: ma-zo in lokale tijd) ===== */
function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // 0=ma
  date.setHours(0,0,0,0);
  date.setDate(date.getDate() - day);
  return date;
}
function endOfWeek(d = new Date()) {
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end; // exclusief
}
function parseISOorDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return isNaN(d.valueOf()) ? null : d;
}
function fmtDateTime(d) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit'
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

/* ===== Render ===== */
function renderRows(items) {
  if (!els.tbody) return;
  els.tbody.innerHTML = '';
  if (!items.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'muted';
    td.textContent = 'Geen lessen gevonden.';
    tr.appendChild(td);
    els.tbody.appendChild(tr);
    return;
  }
  for (const l of items) {
    const d = parseISOorDate(l.date);
    const tr = document.createElement('tr');

    const naam = l.name || l.title || l.type || 'Les';
    const locatie = l.location || l.locatie || '';
    const trainer = l.trainer || l.trainers || '';

    const tdNaam = document.createElement('td');   tdNaam.textContent = naam;
    const tdDate = document.createElement('td');   tdDate.textContent = d ? fmtDateTime(d) : '—';
    const tdLoc  = document.createElement('td');   tdLoc.textContent  = locatie || '—';
    const tdTr   = document.createElement('td');   tdTr.textContent   = trainer || '—';

    tr.append(tdNaam, tdDate, tdLoc, tdTr);
    els.tbody.appendChild(tr);
  }
}

function updateLessenBadge(n) {
  if (els.badgeLessen) setText(els.badgeLessen, n);
  if (els.subLessen) {
    if (n === 0) setText(els.subLessen, 'geen deze week');
    else if (n === 1) setText(els.subLessen, '1 deze week');
    else setText(els.subLessen, `${n} deze week`);
  }
}

/* ===== Data laden ===== */
async function loadLessen() {
  hide(els.error);
  show(els.loader);
  hide(els.tableWrap);

  try {
    // Haal alle lessen (actief) via moderne action
    const data = await fetchAction('getLessen'); // main.gs → doGet?action=getLessen
    const all = Array.isArray(data) ? data : [];

    // Filter soft-deleted
    const actieve = all.filter(l => !(String(l.archived).toLowerCase() === 'true' || l.archived === true));

    // Sorteer op datum
    actieve.sort((a, b) => {
      const da = parseISOorDate(a.date)?.getTime() ?? 0;
      const db = parseISOorDate(b.date)?.getTime() ?? 0;
      return da - db;
    });

    // Split: week vs alles
    const now = new Date();
    const from = startOfWeek(now), to = endOfWeek(now);
    const thisWeek = actieve.filter(l => {
      const d = parseISOorDate(l.date);
      return d && d >= from && d < to;
    });

    // Update tellers
    setText(els.dotWeek, thisWeek.length);
    setText(els.dotAll, actieve.length);
    setText(els.dotNotes, 0); // (placeholder, geen bron nu)
    updateLessenBadge(thisWeek.length);

    // Initieel: toon week
    renderRows(thisWeek);

    // Tabs wisselen
    initTabsSwitch({ thisWeek, all: actieve });

    hide(els.loader);
    show(els.tableWrap);
  } catch (err) {
    hide(els.loader);
    setText(els.error, 'Fout bij laden van lessen: ' + (err?.message || String(err)));
    show(els.error);
  }
}

function initTabsSwitch(datasets) {
  const tabs = $$('#agenda-tabs .tab');
  function setActive(btn) {
    tabs.forEach(t => {
      const on = t === btn;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.setAttribute('tabindex', on ? '0' : '-1');
    });
  }
  tabs.forEach(t => t.addEventListener('click', () => {
    setActive(t);
    const key = t.getAttribute('data-tab');
    switch (key) {
      case 'week':  renderRows(datasets.thisWeek); break;
      case 'alles': renderRows(datasets.all); break;
      case 'mededelingen': renderRows([]); break; // geen bron nu
    }
  }));
}

/* ===== Boot ===== */
document.addEventListener('DOMContentLoaded', () => {
  loadLessen();
});
