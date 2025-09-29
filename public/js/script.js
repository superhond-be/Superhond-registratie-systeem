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
} // ✅ addDog netjes afgesloten

// ===== Alles pas starten na DOM =====
document.addEventListener('DOMContentLoaded', () => {
  // === Formulier - customer opslaan (alleen als het formulier bestaat) ===
  const form = document.getElementById("customerForm");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      const customer = {
        name: document.getElementById("customerName").value,
        email: document.getElementById("customerEmail").value,
        phone: document.getElementById("customerPhone").value,
        dogs: []
      };

      document.querySelectorAll(".dog").forEach((dogDiv) => {
        const dog = {
          name: dogDiv.querySelector("input[name='dogName']").value,
          breed: dogDiv.querySelector("input[name='dogBreed']").value,
          birthdate: dogDiv.querySelector("input[name='dogBirthdate']").value
        };
        customer.dogs.push(dog);
      });

      // TODO: sla 'customer' op of verzend naar je backend
      console.info('[Superhond] customer submit →', customer);
    });
  }

  // ===== Score teller functies (alleen als de knoppen bestaan) =====
  const scoreEl  = document.getElementById("score");
  const plusBtn  = document.getElementById("plusKnop");
  const resetBtn = document.getElementById("resetKnop");

  if (scoreEl && plusBtn) {
    // safety: maak knoppen geen submit
    if (plusBtn.type !== 'button') plusBtn.type = 'button';
    if (resetBtn && resetBtn.type !== 'button') resetBtn.type = 'button';

    // optioneel: waarde onthouden
    let score = Number(localStorage.getItem('superhond_score') || scoreEl.textContent || 0) || 0;
    scoreEl.textContent = String(score);

    plusBtn.addEventListener('click', (e) => {
      e.preventDefault();
      score++;
      scoreEl.textContent = String(score);
      localStorage.setItem('superhond_score', String(score));
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        score = 0;
        scoreEl.textContent = "0";
        localStorage.setItem('superhond_score', "0");
      });
    }
  } else {
    console.info("[Superhond] Teller niet actief op deze pagina.");
  }
});
