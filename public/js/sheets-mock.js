/**
 * public/js/sheets-mock.js
 * Mock alternatief voor sheets.js tijdens lokaal testen
 */

export async function initFromConfig() {
  // geen actie lokaal
}

export async function fetchSheet(name) {
  // haal lokaal JSON-bestand op bijv. /data/<name>.json
  const url = `/data/${name.toLowerCase()}.json`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Kon ${name} niet laden: ${resp.status}`);
  return await resp.json();
}

export async function postAction(entity, action, payload) {
  // voor testdoeleinden: console logs
  console.log('postAction', entity, action, payload);
  return { ok: true, id: payload.id || (new Date().getTime().toString()) };
}
