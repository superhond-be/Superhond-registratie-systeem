// /public/ui/layout.js  — v0.18.7
(function () {
  const log = (...a) => { try { console.log('[SuperhondUI]', ...a); } catch {} };

  const pad = n => String(n).padStart(2, '0');
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

  function headerHTML({ title = 'Superhond', icon = '🐶', home = false, back = '/' }) {
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

  // Zorg dat onze hoofd-CSS geladen is. Val terug op mini inline-styles als /ui/style.css ontbreekt.
  function ensureCss(cb) {
    // Al aanwezig?
    if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(l => (l.href||'').includes('/ui/style.css'))) {
      cb && cb(); return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/ui/style.css?v=0.18.7'; // standaard pad
    link.onload = () => { log('CSS loaded'); cb && cb(); };
    link.onerror = () => {
      log('CSS NOT FOUND at /ui/style.css — injecting fallback styles');
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

    // 3) Versie-info
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
<script src="/js/agenda.js?v=0.19.0"></script>
<script>
  // Laad de agenda zodra de UI gemount is (of meteen, beide oké)
  if (window.SuperhondUI?.ready) {
    SuperhondUI.ready(() => window.Agenda && window.Agenda.init());
  } else {
    document.addEventListener('DOMContentLoaded', () => window.Agenda && window.Agenda.init());
  }
</script>
  // Expose
  window.SuperhondUI = { mount };
})();
