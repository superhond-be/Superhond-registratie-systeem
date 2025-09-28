// voorbeeld basis
(async function () {
  const list = document.getElementById('agenda-list');
  const tabs = document.querySelectorAll('.tabs button');

  // TODO: replace with echte load van lessen/reeksen/mededelingen
  const data = [
    { type: 'lesson', titel: 'Puppy klas 1', datum: '2025-09-30', tijd: '10:00', trainer: 'Tom', locatie: 'Retie' },
    { type: 'msg', titel: 'Trainer ziek', datum: '2025-10-01', tijd: '09:00', trainer: '', locatie: '' }
  ];

  function render(scope) {
    let rows = data.filter(d => scope === 'all' || d.type === scope);
    list.innerHTML = rows.map(d =>
      `<li>${d.datum} ${d.tijd} — ${d.titel} ${d.trainer ? '(' + d.trainer + ')' : ''}</li>`
    ).join('');
  }

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render(btn.dataset.scope);
    });
  });

  render('week');
})();
