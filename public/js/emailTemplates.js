// public/js/emailTemplates.js

let templates = [];

/**
 * Laadt de templates (uit JSON, Sheets, etc.)
 * @param {Array<Object>} arr
 */
export function loadEmailTemplates(arr) {
  templates = Array.isArray(arr) ? arr : [];
}

/**
 * Haal alle templates, met optionele filters
 * @param {Object} opts — { trigger?, doelgroep?, automatisch? }
 * @returns {Array}
 */
export function listTemplates(opts = {}) {
  return templates.filter(t => {
    if (opts.trigger != null && t.trigger !== opts.trigger) return false;
    if (opts.doelgroep != null && t.doelgroep !== opts.doelgroep) return false;
    if (opts.automatisch != null && t.automatisch !== opts.automatisch) return false;
    return true;
  });
}

/**
 * Haal template op ID
 * @param {string} id
 * @returns {Object|undefined}
 */
export function getTemplateById(id) {
  return templates.find(t => t.templateId === id);
}

/**
 * Render (merge) de template met contextdata
 * @param {Object} template
 * @param {Object} context — e.g. { voornaam, lesNaam, lesDatum, lesTijd, hondNaam, … }
 * @returns {{onderwerp: string, body: string}}
 */
export function renderTemplate(template, context) {
  const merge = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const k = key.trim();
      // fallback: lege string als niet aanwezig
      return (context[k] != null ? context[k] : '');
    });
  };
  return {
    onderwerp: merge(template.onderwerp),
    body: merge(template.body)
  };
}
