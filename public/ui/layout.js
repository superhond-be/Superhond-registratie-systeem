// /public/ui/layout.js
(function () {
  const log = (...a) => { try { console.log('[SuperhondUI]', ...a); } catch {} };

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
    // 1) API
    try {
      const r = await fetch('/api/version?b=' + Date.now());
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      return { src: 'api', ...j };
    } catch (e1) {
      // 2) static
      try {
        const r2 = await fetch('/version.json?b=' + Date.now());
        if (!r2.ok) throw new Error('HTTP ' + r2.status);
        const j2 = await r2.json();
        return { src: 'static', ...j2 };
      } catch (e2) {
        log('Version fetch failed', e1, e2);
        return { src: 'none' };
      }
    }
  }

  function headerHTML({ title = 'Superhond', icon = '🐶', home = false, back = '../index.html' }) {
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

  function footerHTML() {
    return `
<footer class="footer">
  <div class="container">
    © Superhond 2025 — <span id="version-info">Versie laden…</span>
    <div id="apiHealth" class="sub" style="margin-top:6px;"></div>
  </div>
</footer>`;
  }

  // Noodinjectie: als CSS niet gevonden wordt, toon iets basis zodat layout niet “kaal” is
  function ensureCss(cb) {
    if (document.querySelector('link[data-superhond]')) return cb && cb();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/ui/superhond.css?b=1'; // let op: absoluut pad vanaf /public
    link.setAttribute('data-superhond', '1');
    link.onload = () => { log('CSS loaded'); cb && cb(); };
    link.onerror = () => {
      log('CSS NOT FOUND at /ui/superhond.css — injecting fallback styles');
      const style = document.createElement('style');
      style.textContent = `
        :root{--bg:#f9f9fb;--card:#fff;--border:#e5e7eb}
        body{background:var(--bg);font:16px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0}
        .container{max-width:1060px;margin:0 auto;padding:0 16px}
        .topbar{background:#f4c400;color:#000}
        .topbar .container{position:relative}
        .topbar-center{display:flex;align-items:center;justify-content:center;height:56px}
        .brand{margin:0;font-weight:800;font-size:22px}
        .version-badge{position:absolute;right:16px;top:50%;transform:translateY(-50%);background:#1f2328;color:#fff;border-radius:999px;padding:3px 8px;font-size:12px}
        .page-title{margin:20px 0 12px}
        .tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px}
        .tile{display:block;padding:16px 18px;border:1px solid var(--border);border-radius:12px;background:var(--card);text-decoration:none;color:inherit;box-shadow:0 2px 8px rgba(0,0,0,.06)}
        .footer{margin-top:24px;padding:16px 0;border-top:1px solid var(--border);color:#6a6f76}
      `;
      document.head.appendChild(style);
      cb && cb();
    };
    document.head.appendChild(link);
  }

  async function mount(opts) {
    log('mount start', opts);

    // 1) CSS
    ensureCss(() => log('CSS ensured'));

    // 2) Header / Footer
    if (!document.querySelector('header.topbar')) {
      document.body.insertAdjacentHTML('afterbegin', headerHTML(opts || {}));
      log('header injected');
    }
    if (!document.querySelector('footer.footer')) {
      document.body.insertAdjacentHTML('beforeend', footerHTML());
      log('footer injected');
    }

    // 3) Versie
    const hv = document.getElementById('header-version');
    const fv = document.getElementById('version-info');
    const he = document.getElementById('apiHealth');

    const v = await getVersion();
    const chip = v.version ? `v${v.version}` : 'v?';
    if (hv) hv.textContent = chip;
    if (fv) fv.textContent = v.version
      ? `${chip} (${v.src})${v.buildTime ? ' — ' + fmt(v.buildTime) : ''}`
      : 'v? — (geen versiebron)';
    if (he) he.textContent = v.src === 'api'
      ? 'API online ✓'
      : (v.src === 'static' ? 'API offline — static versie gebruikt' : 'API offline — geen versie-info');

    log('mount done', v);
  }
  /* v0.18.7 small tweaks */
.table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.input, .select { min-height: 38px; }
.input-nr { width: 5.5rem; }
.loader { padding: .5rem 0; }
.error { color: #b00020; }
.badge-version { float: right; }
.container { padding: 12px; }
.card { background: #fff; padding: 12px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
.muted { color:#6b7280; font-size:.9em; }
.btn.btn-xs { font-size:.85rem; padding:.2rem .4rem; }

  // Expose
  window.SuperhondUI = { mount };
})();
