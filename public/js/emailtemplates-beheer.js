// public/js/emailtemplates-beheer.js

import {
  initFromConfig,
  fetchSheet,
  postAction
} from './sheets.js';
import { SuperhondUI } from './layout.js';
import { loadEmailTemplates } from './emailTemplates.js';

const $ = (s, r = document) => r.querySelector(s);

let templates = [];
let editingId = null;

function renderTable() {
  const tbody = $('#tpl-table tbody');
  if (!templates.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="muted">Geen templates gevonden</td></tr>`;
    return;
  }
  tbody.innerHTML = templates.map(t => `
    <tr data-id="${t.templateId}">
      <td>${t.templateId}</td>
      <td>${t.naam}</td>
      <td>${t.trigger}</td>
      <td>${t.categorie}</td>
      <td>${t.doelgroep}</td>
      <td>${t.automatisch}</td>
      <td class="btn-actions">
        <button class="btn btn-xs act-edit">✏️</button>
        <button class="btn btn-xs danger act-del">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function bindTableActions() {
  const tbody = $('#tpl-table tbody');
  tbody.addEventListener('click', ev => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const tr = btn.closest('tr');
    const id = tr.dataset.id;
    if (btn.classList.contains('act-edit')) {
      startEdit(id);
    } else if (btn.classList.contains('act-del')) {
      deleteTemplate(id);
    }
  });
}

function startEdit(id) {
  editingId = id;
  const tpl = templates.find(t => t.templateId === id);
  if (!tpl) return;
  $('#form-title').textContent = `Edit: ${id}`;
  const form = $('#tpl-form');
  form.templateId.value = tpl.templateId;
  form.naam.value = tpl.naam;
  form.trigger.value = tpl.trigger;
  form.categorie.value = tpl.categorie || '';
  form.doelgroep.value = tpl.doelgroep || '';
  form.automatisch.value = tpl.automatisch || 'ja';
  form.onderwerp.value = tpl.onderwerp || '';
  form.body.value = tpl.body || '';
  form.zichtbaar.value = tpl.zichtbaar ? 'ja' : 'nee';
}

function resetForm() {
  editingId = null;
  $('#form-title').textContent = 'Nieuwe template';
  $('#tpl-form').reset();
}

async function deleteTemplate(id) {
  if (!confirm('Weet je zeker dat je deze template wilt verwijderen?')) return;
  try {
    await postAction('emailtemplate', 'delete', { templateId: id });
    templates = templates.filter(t => t.templateId !== id);
    renderTable();
  } catch (e) {
    alert('Verwijderen mislukt: ' + (e.message || e));
  }
}

async function onSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const fd = new FormData(form);
  const payload = {
    templateId: fd.get('templateId').trim(),
    naam: fd.get('naam').trim(),
    trigger: fd.get('trigger').trim(),
    categorie: fd.get('categorie').trim(),
    doelgroep: fd.get('doelgroep').trim(),
    automatisch: fd.get('automatisch'),
    onderwerp: fd.get('onderwerp').trim(),
    body: fd.get('body').trim(),
    zichtbaar: fd.get('zichtbaar') === 'ja'
  };
  try {
    const res = await postAction('emailtemplate', 'upsert', payload);
    // Upsert: als het bestaat, overschrijf; anders voeg toe
    const existing = templates.find(t => t.templateId === payload.templateId);
    if (existing) {
      Object.assign(existing, payload);
    } else {
      templates.push(payload);
    }
    renderTable();
    resetForm();
  } catch (e) {
    alert('Opslaan mislukt: ' + (e.message || e));
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  SuperhondUI.mount({
    title: 'Beheer Templates',
    icon: '✉️',
    back: '../dashboard/'
  });

  await initFromConfig();

  // Laad de templates (gebruik lokaal indien in testmodus)
  templates = await loadEmailTemplates(true);
  renderTable();
  bindTableActions();

  $('#tpl-form').addEventListener('submit', onSubmit);
  $('#btn-cancel')?.addEventListener('click', () => {
    resetForm();
  });
});
