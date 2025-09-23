

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
}

document.getElementById("customerForm").addEventListener("submit", function(e) {
  e.preventDefault();

  const customer = {
    name: document.getElementById("customerName").value,
    email: document.getElementById("customerEmail").value,
    phone: document.getElementById("customerPhone").value,
    dogs: []
  };

  const dogDivs = document.querySelectorAll(".dog");
  dogDivs.forEach(dogDiv => {
    const dog = {
      name: dogDiv.querySelector("input[name='dogName']").value,
      breed: dogDiv.querySelector("input[name='dogBreed']").value,
      birthdate: dogDiv.querySelector("input[name='dogBirthdate']").value
    };
    customer.dogs.push(dog);
  });

  document.getElementById("output").textContent = JSON.stringify(customer, null, 2);
});
