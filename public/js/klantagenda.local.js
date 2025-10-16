// ...bovenste helpers hetzelfde als optie A...

async function loadLocalJSON(path){
  const r = await fetch(path, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Kon ${path} niet laden (${r.status})`);
  return r.json();
}

document.addEventListener('DOMContentLoaded', async ()=>{
  try {
    const [lesData, medData] = await Promise.all([
      loadLocalJSON('../data/lessen.local.json'),
      loadLocalJSON('../data/mededelingen.local.json')
    ]);

    $('#filter-categorie')?.addEventListener('change', e=>{
      currentFilters.categorie = e.target.value;
      renderAgenda(lesData, medData);
    });
    $('#filter-prioriteit')?.addEventListener('change', e=>{
      currentFilters.prioriteit = e.target.value;
      renderAgenda(lesData, medData);
    });

    renderAgenda(lesData, medData);
  } catch (e) {
    console.error(e);
    const el = document.getElementById('agenda-list');
    if (el) el.innerHTML = `<p class="error">❌ Fout bij laden lokale data: ${e.message}</p>`;
  }
});
