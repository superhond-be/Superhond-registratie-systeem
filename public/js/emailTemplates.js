// public/js/emailTemplates.js

import { fetchSheet } from './sheets.js';

export async function loadEmailTemplates(useLocal = false) {
  if (useLocal) {
    return loadEmailTemplatesLocal();
  } else {
    return loadEmailTemplatesSheets();
  }
}

async function loadEmailTemplatesLocal() {
  try {
    const resp = await fetch('../data/emailtemplates.json');
    if (!resp.ok) {
      throw new Error('HTTP error ' + resp.status);
    }
    const arr = await resp.json();
    return arr.filter(t => String(t.zichtbaar || '').toLowerCase() === 'ja');
  } catch (err) {
    console.error('Kon e-mailtemplates lokaal niet laden:', err);
    return [];
  }
}

async function loadEmailTemplatesSheets() {
  try {
    const raw = await fetchSheet('E‑MailTemplates');
    // ruwe formaten mogelijk: raw.data, raw.rows, raw.result
    const arr = Array.isArray(raw)
      ? raw
      : (raw.data ?? raw.rows ?? raw.result ?? []);
    return arr.filter(t => String(t.zichtbaar || '').toLowerCase() === 'ja');
  } catch (err) {
    console.error('Kon e-mailtemplates uit sheet niet laden:', err);
    return [];
  }
}
