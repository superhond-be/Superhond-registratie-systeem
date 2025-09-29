function renderAgendaItem(item) {
  let link;
  if (item.type === "les") {
    link = `/lessen/detail.html?id=${item.id}`;
  } else if (item.type === "reeks") {
    link = `/lessenreeks/detail.html?id=${item.id}`;
  }

  return `
    <li class="agenda-item">
      <a href="${link}">
        <strong>${item.titel}</strong><br>
        <span>${item.datum} @ ${item.locatie}</span>
      </a>
    </li>
  `;
}
