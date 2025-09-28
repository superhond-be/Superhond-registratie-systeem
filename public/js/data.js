/* Superhond data loader v0.1 */
export async function loadJson(path){
  const r = await fetch(path + (path.includes('?') ? '&' : '?') + 'b=' + Date.now(), { cache:'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${path}`);
  return r.json();
}

export async function loadAll(){
  const [
    enums, klassen, pakketten, reeksen, lessen, locaties, trainers,
    klanten, honden, inschrijvingen, mededelingen
  ] = await Promise.all([
    loadJson('/data/enums.json'),
    loadJson('/data/klassen.json'),
    loadJson('/data/lessenpakketten.json'),
    loadJson('/data/lessenreeksen.json'),
    loadJson('/data/lessen.json'),
    loadJson('/data/locaties.json'),
    loadJson('/data/trainers.json'),
    loadJson('/data/klanten.json'),
    loadJson('/data/honden.json'),
    loadJson('/data/inschrijvingen.json'),
    loadJson('/data/mededelingen.json')
  ]);
  return { enums, klassen, pakketten, reeksen, lessen, locaties, trainers, klanten, honden, inschrijvingen, mededelingen };
}

/* helpers */
export function indexById(arr){ return Object.fromEntries(arr.map(x => [x.id, x])); }
export function humanDate(d){ try{ const dt=new Date(d + (d.includes('T')?'':'T00:00')); return dt.toLocaleDateString(); }catch{ return d; } }
export function timeRange(start,end){ return `${start}–${end}`; }
