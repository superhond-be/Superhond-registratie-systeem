/* storage.js — lokale opslag + id utils */
const DB_KEY = 'superhond_db_v1';

const defaultDB = {
  meta: {version: 1, createdAt: new Date().toISOString()},
  packages: [],   // {id,name}
  series: [],     // {id,packageId,name}
  lessons: [],    // lesson objects
  notices: []     // mededelingen
};

export function loadDB(){
  try{
    const raw = localStorage.getItem(DB_KEY);
    if(!raw){ saveDB(structuredClone(defaultDB)); return structuredClone(defaultDB); }
    const parsed = JSON.parse(raw);
    // migrate if needed later
    return parsed;
  }catch(e){
    console.error('DB parse error', e);
    saveDB(structuredClone(defaultDB));
    return structuredClone(defaultDB);
  }
}
export function saveDB(db){ localStorage.setItem(DB_KEY, JSON.stringify(db)); }

export function resetDB(){
  saveDB(structuredClone(defaultDB));
  return loadDB();
}

export function uid(prefix='id'){
  return `${prefix}_${Math.random().toString(36).slice(2,8)}_${Date.now().toString(36)}`;
}

/** handy downloads */
export function downloadJSON(filename, obj){
  const blob = new Blob([JSON.stringify(obj, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
