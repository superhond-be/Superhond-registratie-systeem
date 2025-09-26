
// /public/ui/layout.js
window.SuperhondUI = (function () {
  const pad = n => String(n).padStart(2,'0');
  const fmt = ts => {
    try {
      const d = new Date(ts);
      if (isNaN(+d)) return '';
      return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}, `
           + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch { return ''; }
  };

  async function getVersion() {
    try {
      const r = await fetch('/api/version?b=' + Date.now());
      if (!r.ok) throw new Error('HTTP '+r.status);
      const j = await r.json();
      return { src:'api', ...j };
    } catch {
      try {
        const r2 = await fetch('/version.json?b=' + Date.now());
        if (!r2.ok) throw new Error('HTTP '+r2.status);
        const j2 = await r2.json();
        return { src:'static', ...j2 };
      } catch { return { src:'none' }; }
    }
  }

  function headerHTML({ title='Superhond', icon='🐶', home=false, back='../index.html' }){
    if (home) {
      return `
      <header class="topbar topbar--home">
        <div class="container topbar-center">
          <h1 class="brand brand--center">${icon} ${title}</h1>
          <span class="version-badge" id="header-version">v…</span>
        </div>
      </header>`;
    }
    return `
    <header class="topbar">
      <div class="container topbar-flex">
        <a href="${back}" class="btn-back">← Terug</a>
        <div style="flex:1; text-align:center">
          <h1 class="brand brand--center">${icon} ${title}</h1>
        </div>
        <span class="version-badge" id="header-version">v…</span>
      </div>
    </header>`;
  }

  function footerHTML(){
    return `
    <footer class="footer">
      <div class="container">
        © Superhond 2025 — <span id="version-info">Versie laden…</span>
        <div id="apiHealth" class="sub" style="margin-top:6px;"></div>
      </div>
    </footer>`;
  }

  async function mount(opts){
    // inject CSS als nog niet aanwezig
    if (!document.querySelector('link[data-superhond]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/ui/superhond.css?b=1';
      link.setAttribute('data-superhond','1');
      document.head.appendChild(link);
    }

    // header/footer tekenen als ze ontbreken
    if (!document.querySelector('header.topbar')) {
      document.body.insertAdjacentHTML('afterbegin', headerHTML(opts || {}));
    }
    if (!document.querySelector('footer.footer')) {
      document.body.insertAdjacentHTML('beforeend', footerHTML());
    }

    // versie vullen
    const hv = document.getElementById('header-version');
    const fv = document.getElementById('version-info');
    const he = document.getElementById('apiHealth');

    const v = await getVersion();
    const chip = v.version ? `v${v.version}` : 'v?';
    if (hv) hv.textContent = chip;
    if (fv) fv.textContent = v.version
      ? `${chip} (${v.src})${v.buildTime ? ' — '+fmt(v.buildTime) : ''}`
      : 'v? — (geen versiebron)';
    if (he) he.textContent = v.src==='api'
      ? 'API online ✓'
      : (v.src==='static' ? 'API offline — static versie gebruikt' : 'API offline — geen versie-info');
  }

  return { mount };
})();
