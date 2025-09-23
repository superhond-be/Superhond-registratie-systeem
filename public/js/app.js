const VERSION = "v1.0";
const BUILD_TIMESTAMP = "2025-09-23 12:37:44 (Europe/Brussels)";

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".version").forEach(el => el.textContent = VERSION);
  document.querySelectorAll(".build").forEach(el => el.textContent = "Build " + BUILD_TIMESTAMP);

  const searchInput = document.getElementById("search");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const filter = searchInput.value.toLowerCase();
      document.querySelectorAll(".datatable tbody tr").forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(filter) ? "" : "none";
      });
    });
  }

  const addBtn = document.getElementById("addRow");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const tbody = document.querySelector("#klantenTable tbody");
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input type='text' placeholder='Naam klant' /></td>
        <td><input type='text' placeholder='Naam hond' /></td>
        <td><button class='action save'>💾</button><button class='action delete'>🗑️</button></td>`;
      tbody.appendChild(tr);
      attachRowActions(tr);
    });
  }

  function attachRowActions(row) {
    const saveBtn = row.querySelector(".save");
    const deleteBtn = row.querySelector(".delete");
    const editBtn = row.querySelector(".edit");

    if (editBtn) {
      editBtn.addEventListener("click", () => {
        row.querySelectorAll("td").forEach((cell, idx) => {
          if (idx < 2 && !cell.querySelector("input")) {
            const text = cell.textContent;
            cell.innerHTML = `<input type='text' value='${text}' />`;
          }
        });
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        row.querySelectorAll("td").forEach((cell, idx) => {
          const input = cell.querySelector("input");
          if (input) cell.textContent = input.value;
        });
        if (!row.querySelector(".edit")) {
          const td = row.querySelector("td:last-child");
          const edit = document.createElement("button");
          edit.textContent = "✏️";
          edit.className = "action edit";
          td.insertBefore(edit, td.firstChild);
          attachRowActions(row);
        }
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => row.remove());
    }
  }

  document.querySelectorAll("#klantenTable tbody tr").forEach(tr => attachRowActions(tr));
});
