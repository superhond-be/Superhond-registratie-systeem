// public/js/emailTemplates.js

// In-memory opslag van templates
let templates = [];

/**
 * Laad een array templates (bijv. uit JSON of Sheet)
 * @param {Array<Object>} arr 
 */
export function loadEmailTemplates(arr) {
  templates = Array.isArray(arr) ? arr : [];
}

/**
 * Retourneer alle templates, met optionele filters
 * @param {Object} opts — { trigger, doelgroep, automatisch (string “ja”/“nee”) }
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
 * Zoek template op templateId
 * @param {string} id 
 * @returns {Object|undefined}
 */
export function getTemplateById(id) {
  return templates.find(t => t.templateId === id);
}

/**
 * Render (merge) een template met contextdata
 * @param {Object} template — een template object
 * @param {Object} context — object met sleutel→waarde voor mergevelden
 * @returns {Object} — { onderwerp: string, body: string }
 */
export function renderTemplate(template, context) {
  const merge = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const k = key.trim();
      // indien niet aanwezig, leeg string
      return (context[k] != null ? context[k] : '');
    });
  };
  return {
    onderwerp: merge(template.onderwerp),
    body: merge(template.body)
  };
}
