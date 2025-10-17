let templates = [];

export async function loadEmailTemplates(data) {
  // data = array uit JSON of sheet
  templates = data;
}

export function getTemplateById(id) {
  return templates.find(t => t.templateId === id);
}

export function renderTemplate(template, context) {
  // context = { voornaam: 'Jan', lesNaam: 'Puppyles', ... }
  const render = (str = '') =>
    str.replace(/\{\{(.*?)\}\}/g, (_, key) => context[key.trim()] || '');
  return {
    onderwerp: render(template.onderwerp),
    body: render(template.body)
  };
}

export function listTemplates({ trigger = null, doelgroep = null, automatisch = null } = {}) {
  return templates.filter(t =>
    (trigger == null || t.trigger === trigger) &&
    (doelgroep == null || t.doelgroep === doelgroep) &&
    (automatisch == null || t.automatisch === automatisch)
  );
}
