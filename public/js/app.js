
const form = document.querySelector('#klantForm');
const dogsList = document.querySelector('#dogsList');
const out = document.querySelector('#output');
const btnAddDog = document.querySelector('#addDog');
const btnSave = document.querySelector('#saveBtn');
const btnReset = document.querySelector('#resetBtn');
const elLand = document.querySelector('#land');
const elPostcode = document.querySelector('#postcode');
const elTel = document.querySelector('#tel');
const tBody = document.querySelector('#demoTable tbody');
const btnBE = document.querySelector('#prefillBE');
const btnNL = document.querySelector('#prefillNL');

let dogCount = 0;

const onlyDigits = s => (s||'').replace(/[^\d]/g,'');
function normalizePostcode(value, land) {
  if (!value) return '';
  value = value.trim();
  if (land === 'BE') return onlyDigits(value).slice(0,4);
  if (land === 'NL') {
    const d = onlyDigits(value).slice(0,4);
    const l = value.replace(/[^A-Za-z]/g,'').toUpperCase().slice(0,2);
    return (d + (l ? ' ' + l : '')).trim();
  }
  return value;
}
function validatePostcode(value, land){
  if (land==='BE') return /^[1-9][0-9]{3}$/.test(value);
  if (land==='NL') return /^[1-9][0-9]{3}\s?[A-Za-z]{2}$/.test(value);
  return true;
}
function normalizePhoneToE164(input, land) {
  if (!input) return '';
  let s = input.replace(/[^\d+]/g,'');
  if (s.startsWith('+')) return '+' + s.slice(1).replace(/[^\d]/g,'');
  if (s.startsWith('00')) return '+' + s.slice(2).replace(/[^\d]/g,'');
  const cc = land==='BE'?'+32':'+31';
  if (s.startsWith('0')) return cc + s.slice(1);
  return cc + s;
}
function mark(el, ok){ el.classList.toggle('invalid', !ok); return ok; }

btnAddDog.onclick = (prefill=null)=>{
  const card = document.createElement('div');
  card.className = 'dog-card';
  card.innerHTML = `
    <div class="dog-grid">
      <label>Naam <input name="hond_naam_${dogCount}" required></label>
      <label>Ras <input name="hond_ras_${dogCount}"></label>
      <label>Geboorte <input type="date" name="hond_geboorte_${dogCount}"></label>
      <label>Opmerkingen <input name="hond_note_${dogCount}"></label>
    </div>`;
  dogsList.appendChild(card);
  if (prefill){
    card.querySelector(`[name="hond_naam_${dogCount}"]`).value = prefill.naam||'';
    card.querySelector(`[name="hond_ras_${dogCount}"]`).value = prefill.ras||'';
    card.querySelector(`[name="hond_geboorte_${dogCount}"]`).value = prefill.geboortedatum||'';
    card.querySelector(`[name="hond_note_${dogCount}"]`).value = prefill.note||'';
  }
  dogCount++;
};

elLand.addEventListener('change', ()=>{
  elPostcode.value = normalizePostcode(elPostcode.value, elLand.value);
  mark(elPostcode, validatePostcode(elPostcode.value, elLand.value));
  elTel.value = normalizePhoneToE164(elTel.value, elLand.value);
});
elPostcode.addEventListener('blur', ()=>{
  elPostcode.value = normalizePostcode(elPostcode.value, elLand.value);
  mark(elPostcode, validatePostcode(elPostcode.value, elLand.value));
});
elTel.addEventListener('blur', ()=> elTel.value = normalizePhoneToE164(elTel.value, elLand.value));

btnSave.onclick = ()=>{
  const fd = Object.fromEntries(new FormData(form).entries());
  const land = fd.land || 'BE';
  fd.postcode = normalizePostcode(fd.postcode||'', land);
  const pcOk = validatePostcode(fd.postcode, land);
  mark(elPostcode, pcOk);
  if(!pcOk){ alert('Controleer de postcode.'); return; }
  const tel = normalizePhoneToE164(fd.tel||'', land);
  fd.tel_e164 = tel || null;
  delete fd.tel;

  const honden = [];
  for (let i=0;i<dogCount;i++){
    honden.push({
      naam: fd[`hond_naam_${i}`]||'',
      ras: fd[`hond_ras_${i}`]||'',
      geboortedatum: fd[`hond_geboorte_${i}`]||'',
      note: fd[`hond_note_${i}`]||''
    });
    delete fd[`hond_naam_${i}`];delete fd[`hond_ras_${i}`];delete fd[`hond_geboorte_${i}`];delete fd[`hond_note_${i}`];
  }
  const payload = { klant: fd, honden };
  out.textContent = JSON.stringify(payload, null, 2);
};

/* Demo klanten + honden */
const demoBE = {
  klant: { voornaam:'Jan', achternaam:'Janssens', email:'jan@voorbeeld.be', land:'BE', straat:'Kerkstraat', huisnummer:'12', toevoeging:'bus 3', postcode:'2000', plaats:'Antwerpen', tel:'+32470123456' },
  honden: [
    { naam:'Rocco', ras:'Mechelse herder', geboortedatum:'2021-06-15', note:'Energiek' },
    { naam:'Nora', ras:'Border Collie', geboortedatum:'2020-11-03', note:'' }
  ]
};
const demoNL = {
  klant: { voornaam:'Piet', achternaam:'de Vries', email:'piet@example.nl', land:'NL', straat:'Dorpsstraat', huisnummer:'5', toevoeging:'A', postcode:'1234 AB', plaats:'Utrecht', tel:'+31612345678' },
  honden: [
    { naam:'Luna', ras:'Labrador', geboortedatum:'2019-03-09', note:'' }
  ]
};

function loadDemo(demo){
  form.reset(); dogsList.innerHTML=''; dogCount=0;
  const k = demo.klant;
  form.querySelector('[name="voornaam"]').value = k.voornaam;
  form.querySelector('[name="achternaam"]').value = k.achternaam;
  form.querySelector('[name="email"]').value = k.email;
  elLand.value = k.land;
  form.querySelector('[name="straat"]').value = k.straat;
  form.querySelector('[name="huisnummer"]').value = k.huisnummer;
  form.querySelector('[name="toevoeging"]').value = k.toevoeging||'';
  elPostcode.value = k.postcode;
  form.querySelector('[name="plaats"]').value = k.plaats;
  elTel.value = k.tel;
  demo.honden.forEach(h => btnAddDog.onclick(h));
  renderDemoTable(); // refresh table below
}

btnBE.onclick = ()=> loadDemo(demoBE);
btnNL.onclick = ()=> loadDemo(demoNL);

/* Demo tabel render */
const demoRows = [demoBE, demoNL];
function renderDemoTable(){
  tBody.innerHTML = '';
  demoRows.forEach(d=>{
    const naam = `${d.klant.voornaam} ${d.klant.achternaam}`;
    const honden = d.honden.map(h=>h.naam).join(', ');
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${naam}</td><td>${d.klant.land}</td><td>${d.klant.email}</td><td>${honden}</td>`;
    tBody.appendChild(tr);
  });
}
renderDemoTable();
