// public/js/klantagenda.js

import { initFromConfig, fetchSheet } from './sheets.js';
import { loadEmailTemplates, listTemplates, getTemplateById, renderTemplate } from './emailTemplates.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function toArrayRows(x) {
  if (Array.isArray(x)) return x;
  if (x?.data && Array.isArray(x.data)) return x.data;
  if (x?.rows && Array.isArray(x.rows)) return x.rows;
  if (x?.result && Array.isArray(x.result)) return x.result;
  return [];
}

function normalizeLes(r) {
  const o = Object.fromEntries(
    Object.entries(r || {}).map(([k, v]) => [String(k || '').toLowerCase(), v])
  );
  return {
    id: (o.id ?? '').toString(),
    lesnaam: (o.naam ?? '').toString(),
    datum: (o.datum ?? '').toString(),
    tijd: (o.tijd ?? '').toString(),
    locatie: (o.locatie ?? '').toString(),
    groep: (o.groep ?? '').toString()
  };
}

function normalizeMed(r) {
  const o = Object.fromEntries(
    Object.entries(r || {}).map(([k, v]) => [String(k || '').toLowerCase(), v])
  );
  return {
    id: (o.id ?? '').toString(),
    inhoud: (o.inhoud ?? '').toString(),
    datum: (o.datum ?? '').toString(),
    tijd: (o.tijd ?? '').toString(),
    targetLes: (o.targetles ?? '').toString(),
    doelgroep: (o.doelgroep ?? '').toString(),
    categorie: (o.categorie ?? '').toString(),
    prioriteit: (o.prioriteit ?? '').toString(),
    link: (o.link ?? '').toString(),
    zichtbaar: String(o.zichtbaar ?? '').toLowerCase() !== 'nee',
    templateId: (o.templateid ?? '').toString()  // optioneel: bewaar gekozen template
  };
}

const currentFilters = { categorie: '', prioriteit: '' };

/** Filter mededelingen volgens criteria */
function filterMededelingen(meds, opt) {
  const now = new Date();
  return (meds || []).filter(m => {
    if (!m.zichtbaar) return false;
    if (opt.lesId && m.targetLes && m.targetLes !== opt.lesId) return false;
    if (opt.dag && m.datum && m.datum !== opt.dag) return false;
    if (opt.categorie && m.categorie && m.categorie !== opt.categorie) return false;
    if (opt.prioriteit && m.prioriteit && m.prioriteit !== opt.prioriteit) return false;
    if (m.datum) {
      const dt = new Date(`${m.datum}T${m.tijd || '00:00'}`);
      if (dt < now) return false;
    }
    return true;
  });
}

/** Render agenda + mededelingen */
function renderAgenda(lesData, medData) {
  const el = $('#agenda-list');
  $('#agenda-loader')?.remove();
  if (!lesData?.length) {
    el.innerHTML = `<p class="muted">Geen komende lessen.</p>`;
    return;
  }
  el.innerHTML = lesData.map(l => {
    const meds = filterMededelingen(medData, {
      lesId: l.id,
      dag: l.datum,
      categorie: currentFilters.categorie,
      prioriteit: currentFilters.prioriteit
    });
    return `
      <div class="ag-punt" data-les-id="${escapeHtml(l.id)}">
        <div class="ag-header">
          <strong>${escapeHtml(l.lesnaam)}</strong> — ${escapeHtml(l.datum)} ${escapeHtml(l.tijd)}
        </div>
        <div class="info">📍 ${escapeHtml(l.locatie || 'Onbekende locatie')}</div>
        ${meds.length ? `
          <div class="mededelingen-onder ${meds.some(m => m.prioriteit === 'Hoog') ? 'urgent' : ''}">
            ${meds.map(m => {
              const t = `${m.datum}${m.tijd ? ` ${m.tijd}` : ''}`;
              return `<small>${escapeHtml(t)} • ${escapeHtml(m.categorie || '')}</small>${escapeHtml(m.inhoud)}${m.link ? ` <a href="${escapeHtml(m.link)}">[Meer]</a>` : ''}`;
            }).join('<br>')}
          </div>` : ''}
        <div class="actions">
          <button class="btn-edit-mededeling" data-les="${escapeHtml(l.id)}">✏️ Nieuw / Bewerken mededeling</button>
        </div>
      </div>`;
  }).join('');

  // voeg eventlisteners aan “Nieuw / Bewerken mededeling” buttons
  $$('.btn-edit-mededeling').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const lesId = btn.getAttribute('data-les');
      openMededelingModal({ lesId });
    });
  });
}

/** Helper: open de modal voor mededeling maken / bewerken */
function openMededelingModal(params = {}) {
  // params kan bevatten: lesId, bestaande mededeling id etc.
  // Haal DOM modal (zorg dat die in je HTML staat) of creëer dynamisch
  const modalEl = document.getElementById('mededelingModal');
  if (!modalEl) {
    console.error("Modal-element #mededelingModal niet gevonden");
    return;
  }

  // Vul inhoud van modal (velden) op basis van params / default
  const selTemplate = modalEl.querySelector("#selEmailTemplate");
  const inputDatum = modalEl.querySelector("#inputDatum");
  const inputTijd = modalEl.querySelector("#inputTijd");
  const textareaInhoud = modalEl.querySelector("#inputInhoud");
  const selCategorie = modalEl.querySelector("#inputCategorie");
  const selPrioriteit = modalEl.querySelector("#inputPrioriteit");
  const btnSave = modalEl.querySelector("#btnSaveMededeling");

  // Reset form
  selTemplate.value = '';
  inputDatum.value = '';
  inputTijd.value = '';
  textareaInhoud.value = '';
  selCategorie.value = '';
  selPrioriteit.value = '';

  // Als bewerken bestaande mededeling: je zou hier code toevoegen om te vullen

  // Context voor merge: je moet deze context zelf opbouwen, afhankelijk van klant/les
  // Bijvoorbeeld (Dummy voorbeeld):
  const context = {
    voornaam: params.voornaam || '',
    lesNaam: params.lesNaam || '',
    lesDatum: params.lesDatum || '',
    lesTijd: params.lesTijd || '',
    hondNaam: params.hondNaam || ''
  };

  // Setup template select & preview in modal
  setupTemplateInModal(modalEl, context);

  // Save handler
  btnSave.onclick = async () => {
    const med = {
      id: params.id ?? null,
      targetLes: params.lesId ?? '',
      datum: inputDatum.value,
      tijd: inputTijd.value,
      inhoud: textareaInhoud.value,
      categorie: selCategorie.value,
      prioriteit: selPrioriteit.value,
      templateId: selTemplate.value || ''
    };

    // Save de mededeling (in testmodus of production)
    await saveMededeling(med);

    // Als template gekozen is: kies of automatisch verzenden
    if (med.templateId) {
      const tmpl = getTemplateById(med.templateId);
      if (tmpl) {
        const merged = renderTemplate(tmpl, context);
        console.log("=== Automatische/Manuele e-mail ===");
        console.log("Onderwerp:", merged.onderwerp);
        console.log("Body:", merged.body);
        // In productie: hier je backend aanroepen
      }
    }

    // Sluit modal en herlaad agenda
    modalEl.style.display = 'none';
    renderAgenda(window.__lesData || [], window.__medData || []);
  };

  // Toon modal
  modalEl.style.display = 'block';
}

/** setup template keuze + preview + test verzend in modal */
function setupTemplateInModal(modalEl, contextData) {
  const sel = modalEl.querySelector("#selEmailTemplate");
  const btnPreview = modalEl.querySelector("#btnPreviewEmail");
  const previewDiv = modalEl.querySelector("#emailPreview");
  const spanOnderwerp = modalEl.querySelector("#previewOnderwerp");
  const divBody = modalEl.querySelector("#previewBody");
  const btnSendTest = modalEl.querySelector("#btnSendTestEmail");

  // Voeg opties
  const templatesForKlant = listTemplates({ doelgroep: "klant" });
  templatesForKlant.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.templateId;
    opt.textContent = `${t.naam} (${t.trigger})`;
    sel.appendChild(opt);
  });

  // Preview event
  btnPreview.onclick = () => {
    const tid = sel.value;
    if (!tid) {
      previewDiv.style.display = "none";
      return;
    }
    const tmpl = getTemplateById(tid);
    if (!tmpl) {
      console.warn("Template niet gevonden:", tid);
      previewDiv.style.display = "none";
      return;
    }
    const merged = renderTemplate(tmpl, contextData);
    spanOnderwerp.textContent = merged.onderwerp;
    divBody.textContent = merged.body;
    previewDiv.style.display = "block";
  };

  // Test verzenden event
  btnSendTest.onclick = () => {
    const tid = sel.value;
    if (!tid) {
      alert("Selecteer eerst een template");
      return;
    }
    const tmpl = getTemplateById(tid);
    const merged = renderTemplate(tmpl, contextData);
    console.log("=== Testmail ===");
    console.log("Onderwerp:", merged.onderwerp);
    console.log("Body:", merged.body);
    alert("Testmail gelogd in console (testmodus).");
  };
}

/** Save mededeling (testmodus / productie) */
async function saveMededeling(m) {
  // In jouw eerdere code je local / Sheets logica
  // Hier een stub:
  if (m.id == null) {
    m.id = Date.now().toString();
    window.__medData = window.__medData || [];
    window.__medData.push(m);
  } else {
    const idx = (window.__medData || []).findIndex(x => x.id === m.id);
    if (idx >= 0) {
      window.__medData[idx] = m;
    }
  }
  return m;
}

/** Init — laad les + mededelingen + templates, render, etc. */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initFromConfig();
  } catch (e) {
    console.warn("[Agenda] init error:", e.message || e);
  }

  // Sla templates lokaal (bijv. in je JSON‑variabele of Sheets)
  const exampleTemplates = [
    {
      "templateId": "concept_herinnering",
      "naam": "Herinnering: boeking in concept",
      "trigger": "status_concept",
      "onderwerp": "{{voornaam}}, je boeking wacht op bevestiging",
      "body": "Beste {{voornaam}}, je boeking voor {{lesNaam}} op {{lesDatum}} staat nog in concept. Gelieve te bevestigen.",
      "zichtbaar": "ja",
      "automatisch": "nee",
      "categorie": "Boekingen",
      "doelgroep": "klant"
    },
    {
      "templateId": "bevestiging_boeking",
      "naam": "Bevestiging boeking",
      "trigger": "status_bevestigd",
      "onderwerp": "Je boeking is bevestigd, {{voornaam}}!",
      "body": "Hallo {{voornaam}}, je boeking voor {{lesNaam}} op {{lesDatum}} is goedgekeurd. Tot dan!",
      "zichtbaar": "ja",
      "automatisch": "ja",
      "categorie": "Boekingen",
      "doelgroep": "klant"
    },
    {
      "templateId": "les_herinnering",
      "naam": "Herinnering: les morgen",
      "trigger": "les_herinnering",
      "onderwerp": "Reminder: les {{lesNaam}} morgen om {{lesTijd}}",
      "body": "Beste {{voornaam}}, vergeet je les {{lesNaam}} op {{lesDatum}} om {{lesTijd}} niet. Tot dan!",
      "zichtbaar": "ja",
      "automatisch": "ja",
      "categorie": "Herinneringen",
      "doelgroep": "klant"
    }
    // voeg desgewenst de rest toe
  ];
  loadEmailTemplates(exampleTemplates);

  // Laad lessen en mededelingen uit Sheets
  let lesData = [], medData = [];

  try {
    const rawL = await fetchSheet('Lessen');
    lesData = toArrayRows(rawL).map(normalizeLes);
  } catch (e) {
    console.warn('[Agenda] Lessen niet geladen:', e.message || e);
  }
  try {
    const rawM = await fetchSheet('Mededelingen');
    medData = toArrayRows(rawM).map(normalizeMed);
  } catch (e) {
    console.warn('[Agenda] Mededelingen niet geladen:', e.message || e);
  }

  // Sorteren
  lesData.sort((a, b) => (`${a.datum} ${a.tijd || ''}`).localeCompare(`${b.datum} ${b.tijd || ''}`));

  window.__lesData = lesData;
  window.__medData = medData;

  // Filter event handlers
  $('#filter-categorie')?.addEventListener('change', e => {
    currentFilters.categorie = e.target.value;
    renderAgenda(window.__lesData, window.__medData);
  });
  $('#filter-prioriteit')?.addEventListener('change', e => {
    currentFilters.prioriteit = e.target.value;
    renderAgenda(window.__lesData, window.__medData);
  });

  // Initial render
  renderAgenda(lesData, medData);
});
