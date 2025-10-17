/**
 * sheets.js – eenvoudige testversie
 * Gebruik dit om te testen of jouw `honden-tab.js` werkt.
 */

const $metaExec = document.querySelector('meta[name="superhond-exec"]');
const EXEC_URL = $metaExec?.getAttribute('content') || '';

/**
 * Init config – hier kun je in testomgeving default waarden zetten.
 */
export async function initFromConfig() {
  console.log('[sheets] initFromConfig, exec =', EXEC_URL);
  // In productie misschien extra initialisaties, validaties, etc.
  return;
}

/**
 * Haal rijen op van een sheet via Google Apps Script
 * Verwacht dat de Apps Script endpoint iets zoals:
 *   GET EXEC_URL?sheet=sheetName
 */
export async function fetchSheet(sheetName, options = {}) {
  if (!EXEC_URL) {
    throw new Error('No exec URL configured');
  }
  const url = new URL(EXEC_URL);
  url.searchParams.set('sheet', sheetName);

  // Voeg eventueel signal/timeout toe
  const resp = await fetch(url.toString(), {
    method: 'GET',
    signal: options.signal,
    // headers: { 'Accept': 'application/json' } // indien nodig
  });

  if (!resp.ok) {
    throw new Error(`Fetch failed: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  // Verwacht vorm: { data: [ { col1: val1, col2: val2, ... }, ... ] }
  return data;
}

/**
 * Sla een hond op via de Apps Script
 * Verwacht dat POST naar exec endpoint kan.
 */
export async function saveHond(payload) {
  if (!EXEC_URL) {
    throw new Error('No exec URL configured');
  }
  const resp = await fetch(EXEC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'saveHond',
      data: payload
    })
  });

  if (!resp.ok) {
    throw new Error(`Save failed: ${resp.status} ${resp.statusText}`);
  }

  const result = await resp.json();
  return result;
}
