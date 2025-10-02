/* models.js — datamodellen + helpers */
import {uid, loadDB, saveDB} from './storage.js';

export function computeEndISO(startISO, durationMin){
  const start = new Date(startISO);
  const end = new Date(start.getTime() + Number(durationMin)*60000);
  return end.toISOString().slice(0,16); // 'YYYY-MM-DDTHH:mm' for inputs
}

export function toMapsUrl(nameOrAddress){
  if(!nameOrAddress) return '';
  const q = encodeURIComponent(nameOrAddress);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** create lesson object */
export function createLesson({
  title, startISO, durationMin, endISO, trainers, location, packageId=null, seriesId=null
}){
  const id = uid('les');
  const end = endISO && endISO.trim() ? new Date(endISO).toISOString().slice(0,16) : computeEndISO(startISO, durationMin);
  return {
    id, type: 'les', status: 'active',
    title,
    startISO: new Date(startISO).toISOString().slice(0,16),
    durationMin: Number(durationMin),
    endISO: end,
    trainers: trainers.map(s=>s.trim()).filter(Boolean),
    location: { name: location.name || '', mapsUrl: location.mapsUrl || '' },
    packageId, seriesId
  };
}

/** create notice (mededeling) */
export function createNotice({title, message, dateISO, color}){
  return { id: uid('med'), type:'mededeling', title, message, dateISO, color };
}

export function addLesson(lesson){
  const db = loadDB();
  db.lessons.push(lesson);
  saveDB(db);
  return lesson.id;
}
export function updateLesson(lesson){
  const db = loadDB();
  const i = db.lessons.findIndex(l=>l.id===lesson.id);
  if(i>=0){ db.lessons[i] = lesson; saveDB(db); return true; }
  return false;
}
export function deleteLesson(id){
  const db = loadDB();
  db.lessons = db.lessons.filter(l=>l.id!==id);
  saveDB(db);
}

export function getLesson(id){ return loadDB().lessons.find(l=>l.id===id)||null; }
export function listLessons(){ return loadDB().lessons.slice().sort((a,b)=>a.startISO.localeCompare(b.startISO)); }

export function addNotice(n){
  const db = loadDB(); db.notices.push(n); saveDB(db); return n.id;
}
export function listNotices(){ return loadDB().notices.slice().sort((a,b)=>a.dateISO.localeCompare(b.dateISO)); }

/** packages & series */
export function ensurePackage(name){
  const db = loadDB();
  let x = db.packages.find(p=>p.name===name);
  if(x) return x;
  x = {id: uid('pak'), name};
  db.packages.push(x); saveDB(db); return x;
}
export function ensureSeries(packageId, name){
  const db = loadDB();
  let s = db.series.find(r=>r.packageId===packageId && r.name===name);
  if(s) return s;
  s = {id: uid('reeks'), packageId, name};
  db.series.push(s); saveDB(db); return s;
}

/** generator: pakket → reeks → lessen */
export function generateSeries({pakNaam, reeksNaam, startDate, startTime, count, intervalDays, durationMin, trainers, loc}){
  const pkg = ensurePackage(pakNaam);
  const series = ensureSeries(pkg.id, reeksNaam);

  const out = [];
  const [h,m] = startTime.split(':').map(Number);
  for(let i=0;i<count;i++){
    const d = new Date(startDate);
    d.setDate(d.getDate() + i*intervalDays);
    d.setHours(h,m,0,0);
    const startISO = d.toISOString().slice(0,16);
    out.push(createLesson({
      title: `${reeksNaam} – les ${i+1}`,
      startISO,
      durationMin,
      endISO: null,
      trainers,
      location: {name: loc.name, mapsUrl: loc.mapsUrl},
      packageId: pkg.id,
      seriesId: series.id
    }));
  }
  return {pkg, series, lessons: out};
}

/** agenda build = lessons + notices, gesorteerd */
export function buildAgenda(){
  const db = loadDB();
  const lessons = db.lessons.map(l => ({
    id:l.id, type:'les', title:l.title, startISO:l.startISO, endISO:l.endISO, color:'#4fd1c5',
    trainers:l.trainers, location:l.location
  }));
  const notices = db.notices.map(n => ({
    id:n.id, type:'mededeling', title:n.title, message:n.message, dateISO:n.dateISO, color:n.color||'#ffd166'
  }));
  const items = [
    ...lessons.map(x=>({ ...x, dateISO: x.startISO })),
    ...notices
  ].sort((a,b)=>a.dateISO.localeCompare(b.dateISO));
  return items;
}
