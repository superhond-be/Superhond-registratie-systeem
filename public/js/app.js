
const elForm = document.querySelector('#klantForm');
const elOut = document.querySelector('#output');
const elBE = document.querySelector('#prefillBE');
const elNL = document.querySelector('#prefillNL');

function renderForm(data) {
  elForm.innerHTML = `
    <label>Voornaam <input name="voornaam" value="${data.voornaam||''}"></label>
    <label>Achternaam <input name="achternaam" value="${data.achternaam||''}"></label>
    <label>Email <input name="email" value="${data.email||''}"></label>
    <label>Land <select name="land">
      <option value="BE"${data.land==='BE'?' selected':''}>België</option>
      <option value="NL"${data.land==='NL'?' selected':''}>Nederland</option>
    </select></label>
    <label>Straat <input name="straat" value="${data.straat||''}"></label>
    <label>Nr <input name="huisnummer" value="${data.huisnummer||''}"></label>
    <label>Toevoeging <input name="toevoeging" value="${data.toevoeging||''}"></label>
    <label>Postcode <input name="postcode" value="${data.postcode||''}"></label>
    <label>Plaats <input name="plaats" value="${data.plaats||''}"></label>
    <label>Telefoon <input name="tel" value="${data.tel||''}"></label>
    <hr>
    <h3>Honden</h3>
    ${data.honden.map((h,i)=>`
      <div class="dog">
        <label>Naam <input name="hond_naam_${i}" value="${h.naam}"></label>
        <label>Ras <input name="hond_ras_${i}" value="${h.ras}"></label>
        <label>Geboorte <input type="date" name="hond_geboorte_${i}" value="${h.geboortedatum}"></label>
      </div>
    `).join('')}
    <button type="submit">💾 Opslaan (demo)</button>
  `;
  elForm.onsubmit = e=>{
    e.preventDefault();
    const formData = Object.fromEntries(new FormData(elForm).entries());
    elOut.textContent = JSON.stringify(formData,null,2);
  }
}

const demoBE = {
  voornaam:"Jan", achternaam:"Janssens", email:"jan@voorbeeld.be",
  land:"BE", straat:"Kerkstraat", huisnummer:"12", toevoeging:"bus 3",
  postcode:"2000", plaats:"Antwerpen", tel:"0470123456",
  honden:[{naam:"Rocco", ras:"Mechelse herder", geboortedatum:"2021-06-15"}]
};
const demoNL = {
  voornaam:"Piet", achternaam:"de Vries", email:"piet@example.nl",
  land:"NL", straat:"Dorpsstraat", huisnummer:"5", toevoeging:"A",
  postcode:"1234 AB", plaats:"Utrecht", tel:"0612345678",
  honden:[{naam:"Luna", ras:"Labrador", geboortedatum:"2019-03-09"}]
};

elBE.onclick=()=>renderForm(demoBE);
elNL.onclick=()=>renderForm(demoNL);

renderForm({voornaam:"",achternaam:"",email:"",land:"BE",straat:"",huisnummer:"",toevoeging:"",postcode:"",plaats:"",tel:"",honden:[]});
