

let dogCount = 0;

function addDog() {
  dogCount++;
  const container = document.getElementById("dogsContainer");
  const div = document.createElement("div");
  div.className = "dog";
  div.innerHTML = `
    <h4>Hond ${dogCount}</h4>
    <label>Naam hond</label>
    <input type="text" name="dogName" required>
    <label>Ras</label>
    <input type="text" name="dogBreed">
    <label>Geboortedatum</label>
    <input type="date" name="dogBirthdate">
  `;
  container.appendChild(div);
  
// === Formulier - customer opslaan ===
document.getElementById("customerForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const customer = {
    name: document.getElementById("customerName").value,
    email: document.getElementById("customerEmail").value,
    phone: document.getElementById("customerPhone").value,
    dogs: []
  };

  const dogDivs = document.querySelectorAll(".dog");
  dogDivs.forEach((dogDiv) => {
    const dog = {
      name: dogDiv.querySelector("input[name='dogName']").value,
      breed: dogDiv.querySelector("input[name='dogBreed']").value,
      birthdate: dogDiv.querySelector("input[name='dogBirthdate']").value
    };
    customer.dogs.push(dog);
  });

}); // ✅ sluit de SUBMIT-functie HIER af (niet later!)


// ===== Score teller functies (buiten de submit!) =====
document.addEventListener('DOMContentLoaded', () => {
  let score = 0;

  const scoreEl = document.getElementById("score");
  const plusBtn = document.getElementById("plusKnop");
  const resetBtn = document.getElementById("resetKnop");

  // Als de teller-elementen niet op deze pagina staan: zacht falen
  if (!scoreEl || !plusBtn) {
    console.info("[Superhond] Teller niet actief op deze pagina.");
    return;
  }
 plusBtn.addEventListener('click', (e) => {
    e.preventDefault(); // ⬅️ vangt per ongeluk "submit" op
    score++;
    scoreEl.textContent = String(score);
    // console.log('score =', score);

  });

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      score = 0;
      scoreEl.textContent = "0";
    });
  }
});
