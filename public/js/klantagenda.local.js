// In je klantagenda.js of mededelingenbeheer‑module
import { listTemplates, getTemplateById, renderTemplate } from "./emailTemplates.js";

/**
 * setupTemplateInModal
 * Koppelt de template‑selectie + preview + testknop in de modal
 * @param {HTMLElement} modalEl — root element van modal
 * @param {Object} contextData — de waarden die je wil mergen (voornaam, lesNaam, lesDatum, etc.)
 */
function setupTemplateInModal(modalEl, contextData) {
  const sel = modalEl.querySelector("#selEmailTemplate");
  const btnPreview = modalEl.querySelector("#btnPreviewEmail");
  const previewDiv = modalEl.querySelector("#emailPreview");
  const spanOnderwerp = modalEl.querySelector("#previewOnderwerp");
  const divBody = modalEl.querySelector("#previewBody");
  const btnSendTest = modalEl.querySelector("#btnSendTestEmail");

  // Vul de opties in de select
  // Filter bijv. op doelgroep “klant”
  const templatesForKlant = listTemplates({ doelgroep: "klant" });
  templatesForKlant.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.templateId;
    opt.textContent = `${t.naam} (${t.trigger})`;
    sel.appendChild(opt);
  });

  // Event: Voorbeeld tonen
  btnPreview.addEventListener("click", () => {
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
  });

  // Event: Test versturen
  btnSendTest.addEventListener("click", () => {
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
    alert("Testmail gelogd in console.");
    // In productie: hier je e-mail / WhatsApp logica aanroepen
  });
}
