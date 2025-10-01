import {loadAll, saveLes, deleteLes, exportJSON, importJSON, lists} from '/js/lessen.store.js';

const tbody = document.querySelector('#tbl-lessen tbody');
const btnAdd = document.getElementById('btn-add');
const btnExport = document.getElementById('btn-export');
const fileImport = document.getElementById('file-import');

let state = { lessen:[], trainers:[], locaties:[], reeksen:[] };

const S = v => String(v ?? '');

function row(les){
  const tr = document.createElement('tr'); tr.dataset.id = les.id ?? '';
  tr.innerHTML = `
    <td>${lists.reeksSelect(state.reeksen, les.reeksId, les.naam)}</td>
    <td>${lists.typeSelect(les.type)}</td>
    <td>${lists.locSelect(state.locaties, les.locatieId)}</td>
    <td>${lists.themaSelect(les.thema)}</td>
    <td>${lists.trainerSelect(state.trainers, les.trainerId)}</td>
    <td><input type="date" value="${S(les.datum)}"></td>
    <td><input type="time" value="${S(les.start)}"></td>
    <td><input type="number" min="1" value="${S(les.capaciteit ?? 8)}" class="input-nr"></td>
    <td class="right nowrap">
      <button class="btn btn-xs" data-act="save">💾</button>
      <button class="btn btn-xs" data-act="del">🗑️</button>
    </td>
  `;
  return tr;
}

function render(){
  tbody.innerHTML = '';
  state.lessen.sort((a,b)=>S(a.datum+a.start).localeCompare(S(b.datum+b.start)));
  state.lessen.forEach(les => tbody.appendChild(row(les)));
}

function collect(tr){
  const [reeksSel,typeSel,locSel,themaSel,trainerSel,dateInp,timeInp,capInp] = tr.querySelectorAll('select,input');
  return {
    id: tr.dataset.id || undefined,
    naam: lists.textFromReeks(reeksSel),
    reeksId: Number(reeksSel.value) || null,
    type: typeSel.value || 'Groep',
    locatieId: Number(locSel.value) || null,
    thema: themaSel.value || '',
    trainerId: Number(trainerSel.value) || null,
    datum: dateInp.value,
    start: timeInp.value,
    capaciteit: Number(capInp.value)||8,
    status: 'actief'
  };
}

tbody.addEventListener('click', async (e)=>{
  const btn = e.target.closest('button[data-act]'); if(!btn) return;
  const tr = btn.closest('tr'); const id = tr.dataset.id;
  if(btn.dataset.act==='save'){
    const payload = collect(tr);
    const saved = await saveLes(payload);
    tr.dataset.id = saved.id;
  }
  if(btn.dataset.act==='del'){
    if(!confirm('Les verwijderen?')) return;
    await deleteLes(id);
    tr.remove();
  }
});

btnAdd.addEventListener('click', async ()=>{
  const nieuw = { datum:'', start:'', capaciteit:8 };
  const tr = row(nieuw); tbody.prepend(tr);
});

btnExport.addEventListener('click', async ()=>{
  await exportJSON(state.lessen, 'lessen.json');
});

fileImport.addEventListener('change', async ()=>{
  const file = fileImport.files[0]; if(!file) return;
  const text = await file.text();
  const data = JSON.parse(text);
  state.lessen = await importJSON(data);
  render();
});

(async function init(){
  state = await loadAll(); // {lessen,locaties,trainers,reeksen}
  render();
})();
