
const form = document.querySelector('#klantForm');
const dogsList = document.querySelector('#dogsList');
const out = document.querySelector('#output');
const btnAddDog = document.querySelector('#addDog');
const btnSave = document.querySelector('#saveBtn');
const btnReset = document.querySelector('#resetBtn');

let dogCount = 0;

btnAddDog.onclick = ()=>{
  const card = document.createElement('div');
  card.className = 'dog-card';
  card.innerHTML = `<div class="dog-grid">
      <label>Naam <input name="hond_naam_${dogCount}"></label>
      <label>Ras <input name="hond_ras_${dogCount}"></label>
      <label>Geboorte <input type="date" name="hond_geboorte_${dogCount}"></label>
      <label>Opmerkingen <input name="hond_note_${dogCount}"></label>
    </div>`;
  dogsList.appendChild(card);
  dogCount++;
};

btnSave.onclick = async ()=>{
  const fd = Object.fromEntries(new FormData(form).entries());
  const dogs = [];
  for(let i=0;i<dogCount;i++){
    dogs.push({
      naam: fd[`hond_naam_${i}`]||'',
      ras: fd[`hond_ras_${i}`]||'',
      geboortedatum: fd[`hond_geboorte_${i}`]||'',
      note: fd[`hond_note_${i}`]||''
    });
    delete fd[`hond_naam_${i}`];
    delete fd[`hond_ras_${i}`];
    delete fd[`hond_geboorte_${i}`];
    delete fd[`hond_note_${i}`];
  }
  const payload = { klant: fd, honden: dogs };
  out.textContent = 'Versturen naar API...';

  try {
    const res = await fetch('/api/klanten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if(res.ok){
      const data = await res.json();
      out.textContent = JSON.stringify(data, null, 2);
    } else {
      throw new Error('HTTP ' + res.status);
    }
  } catch(err){
    out.textContent = JSON.stringify(payload, null, 2) + "\\n(Fallback: API niet bereikbaar)";
  }
};

btnReset.onclick = ()=>{
  form.reset(); dogsList.innerHTML = ''; out.textContent = 'Nog geen data…'; dogCount = 0;
};
