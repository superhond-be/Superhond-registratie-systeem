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
  const o = Object.fromEntries(Object.entries(r || {}).map(([k, v]) => [String(k || '').toLowerCase(), v]));
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
  const o = Object.fromEntries(Object.entries(r || {}).map(([k, v]) => [String(k || '').toLowerCase(), v]));
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
    templateId: (o.templateid ?? '').toString()
  };
}

const currentFilters = { categorie: '', prioriteit: '' };

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
          <button class="btn btn-secondary btn-edit-mededeling" data-les="${escapeHtml(l.id)}">✏️ Mededeling</button>
        </div>
      </div>`;
  }).join('');

  $$("button.btn-edit-mededeling").forEach(btn => {
    btn.addEventListener("click", () => {
      const lesId = btn.getAttribute("data-les");
      // optioneel: vind bestaande mededeling-id als je dat kent
      openMededelingModal({ lesId });
    });
  });
}

/** Sluit de modal */
function closeMededelingModal() {
  const modal = document.getElementById("mededelingModal");
  if (modal) modal.style.display = "none";
}

/** Open modal (nieuw / bewerken) */
function openMededelingModal(params = {}) {
  const modal = document.getElementById("mededelingModal");
  if (!modal) {
    console.error("Modal #mededelingModal niet gevonden");
    return;
  }

  const selTemplate = modal.querySelector("#selEmailTemplate");
  const inputDatum = modal.querySelector("#inputDatum");
  const inputTijd = modal.querySelector("#inputTijd");
  const textareaInhoud = modal.querySelector("#inputInhoud");
  const inputCategorie = modal.querySelector("#inputCategorie");
  const inputPrioriteit = modal.querySelector("#inputPrioriteit");
  const btnSave = modal.querySelector("#btnSaveMededeling");
  const btnDelete = modal.querySelector("#btnDeleteMededeling");
  const btnPreview = modal.querySelector("#btnPreviewEmail");

  const previewDiv = modal.querySelector("#emailPreview");
  const spanOnderwerp = modal.querySelector("#previewOnderwerp");
  const divBody = modal.querySelector("#previewBody");

  // Reset / vooraf invullen
  selTemplate.innerHTML = `<option value="">-- Geen template --</option>`;
  inputDatum.value = params.datum || "";
  inputTijd.value = params.tijd || "";
  textareaInhoud.value = params.inhoud || "";
  inputCategorie.value = params.categorie || "";
  inputPrioriteit.value = params.prioriteit || "";

  // Context (vul zelf volgens je objecten)
  const context = {
    voornaam: params.voornaam || "",
    lesNaam: params.lesNaam || "",
    lesDatum: params.lesDatum || "",
    lesTijd: params.lesTijd || "",
    hondNaam: params.hondNaam || ""
  };

  // Vul template dropdown
  const templatesForKlant = listTemplates({ doelgroep: "klant" });
  templatesForKlant.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.templateId;
    opt.textContent = `${t.naam} (${t.trigger})`;
    selTemplate.appendChild(opt);
  });

  // Preview knop
  btnPreview.onclick = () => {
    const tid = selTemplate.value;
    if (!tid) {
      previewDiv.style.display = "none";
      return;
    }
    const tmpl = getTemplateById(tid);
    if (!tmpl) {
      previewDiv.style.display = "none";
      console.warn("Template niet gevonden:", tid);
      return;
    }
    const merged = renderTemplate(tmpl, context);
    spanOnderwerp.textContent = merged.onderwerp;
    divBody.textContent = merged.body;
    previewDiv.style.display = "block";
  };

  // Save knop (opslaan & eventueel mail trigger)
  btnSave.onclick = async () => {
    const med = {
      id: params.id || null,
      datum: inputDatum.value,
      tijd: inputTijd.value,
      inhoud: textareaInhoud.value,
      categorie: inputCategorie.value,
      prioriteit: inputPrioriteit.value,
      templateId: selTemplate.value || ""
    };
    await saveMededeling(med);

    if (med.templateId) {
      const tmpl = getTemplateById(med.templateId);
      const merged = renderTemplate(tmpl, context);
      console.log("Verzonden test-mail/actie:", merged);
      // In productie: hier echte mail/WhatsApp verzendcall
    }
    closeMededelingModal();
    renderAgenda(window.__lesData || [], window.__medData || []);
  };

  // Delete knop
  btnDelete.onclick = async () => {
    if (params.id) {
      await deleteMededeling(params.id);
    }
    closeMededelingModal();
    renderAgenda(window.__lesData || [], window.__medData || []);
  };

  modal.querySelector("#btnCloseModal").onclick = closeMededelingModal;
  modal.querySelector(".modal-backdrop")?.onclick = closeMededelingModal;

  modal.style.display = "flex";
}

// Stubs of jouw bestaande functies: pas indien nodig
async function saveMededeling(med) {
  // Testmodus: in-memory
  window.__medData = window.__medData || [];
  if (!med.id) {
    med.id = Date.now().toString();
    window.__medData.push(med);
  } else {
    const idx = window.__medData.findIndex(m => m.id === med.id);
    if (idx >= 0) window.__medData[idx] = med;
  }
  return med;
}

async function deleteMededeling(id) {
  window.__medData = (window.__medData || []).filter(m => m.id !== id);
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initFromConfig();
  } catch (e) {
    console.warn("[Agenda] init error:", e.message || e);
  }

  // Voorbeeld templates: je vervangt dit door jouw load uit JSON / Sheets
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
  ];
  loadEmailTemplates(exampleTemplates);

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

  lesData.sort((a, b) => (`${a.datum} ${a.tijd || ''}`).localeCompare(`${b.datum} ${b.tijd || ''}`));
  window.__lesData = lesData;
  window.__medData = medData;

  $('#filter-categorie')?.addEventListener('change', e => {
    currentFilters.categorie = e.target.value;
    renderAgenda(window.__lesData, window.__medData);
  });
  $('#filter-prioriteit')?.addEventListener('change', e => {
    currentFilters.prioriteit = e.target.value;
    renderAgenda(window.__lesData, window.__medData);
  });

  renderAgenda(lesData, medData);
});
