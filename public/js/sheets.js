/**
 * sheets.js – API helpers voor Google Apps Script backend
 */

const $metaExec = document.querySelector('meta[name="superhond-exec"]');
const EXEC_URL = $metaExec?.getAttribute('content') || '';

/**
 * Voor initialisatie – eventueel later uitbreiden
 */
export async function initFromConfig() {
  if (!EXEC_URL) {
    console.warn('[sheets] Geen exec-URL gevonden in meta-tag.');
  } else {
    console.log('[sheets] initFromConfig:', EXEC_URL);
  }
}

/**
 * Haalt een sheet op via Apps Script GET ?sheet=...
 * @param {string} sheetName - naam van de sheet, bv. 'Honden'
 * @param {object} options - fetch opties (bv. { signal, timeout })
 */
export async function fetchSheet(sheetName, options = {}) {
  if (!EXEC_URL) {
    throw new Error('Geen exec URL geconfigureerd');
  }

  const url = new URL(EXEC_URL);
  url.searchParams.set('sheet', sheetName);

  const controller = options.signal
    ? { signal: options.signal }
    : {};

  const resp = await fetch(url.toString(), {
    method: 'GET',
    ...controller
  });

  if (!resp.ok) {
    throw new Error(`Fout bij ophalen van ${sheetName}: ${resp.status} ${resp.statusText}`);
  }

  const json = await resp.json();
  if (!json || !Array.isArray(json.data)) {
    throw new Error(`Ongeldig antwoord van server voor ${sheetName}`);
  }

  return json;
}

/**
 * Slaat een hond op via POST naar de Apps Script exec
 * @param {object} data - de hondgegevens
 * @returns {object} resultaat (bijv. { id: '1234' })
 */
export async function saveHond(data) {
  if (!EXEC_URL) {
    throw new Error('Geen exec URL geconfigureerd');
  }

  const resp = await fetch(EXEC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'saveHond',
      data
    })
  });

  if (!resp.ok) {
    throw new Error(`Opslaan mislukt: ${resp.status} ${resp.statusText}`);
  }

  const result = await resp.json();
  if (!result || !result.success) {
    throw new Error(`Fout in backend: ${result?.error || 'onbekende fout'}`);
  }

  return result;
}
