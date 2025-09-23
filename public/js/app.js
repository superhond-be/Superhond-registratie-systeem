// v1.3 - dashboard counters
fetch('./data/seed.json').then(r=>r.json()).then(data=>{
  const klanten = data.klanten || [];
  document.getElementById('countKlanten').textContent = klanten.length;
  document.getElementById('countHonden').textContent = klanten.length; // 1 hond per klant in demo
}).catch(()=>{console.warn('Geen seed.json');});
