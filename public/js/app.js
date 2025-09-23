
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
  card.innerHTML = `
    <div class="dog-grid">
      <label>Naam <input name="hond_naam_${dogCount}"></label>
      <label>Ras <input name="hond_ras_${dogCount}"></label>
      <label>Geboorte <input type="date" name="hond_geboorte_${dogCount}"></label>
      <label>Opmerkingen <input name="hond_note_${dogCount}"></label>
    </div>
  `;
  dogsList.appendChild(card);
  dogCount++;
};

btnSave.onclick = ()=>{
  const formData = Object.fromEntries(new FormData(form).entries());
  const dogData = [];
  for(let i=0;i<dogCount;i++){
    dogData.push({
      naam: formData[`hond_naam_${i}`]||'',
      ras: formData[`hond_ras_${i}`]||'',
      geboortedatum: formData[`hond_geboorte_${i}`]||'',
      note: formData[`hond_note_${i}`]||''
    });
    delete formData[`hond_naam_${i}`];
    delete formData[`hond_ras_${i}`];
    delete formData[`hond_geboorte_${i}`];
    delete formData[`hond_note_${i}`];
  }
  formData.honden = dogData;
  out.textContent = JSON.stringify(formData,null,2);
};

btnReset.onclick = ()=>{
  form.reset();
  dogsList.innerHTML = '';
  out.textContent = 'Nog geen data…';
  dogCount = 0;
};
