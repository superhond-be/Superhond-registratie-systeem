// Superhond layout (topbar/footer)
(() => {
  const HOME = '/dashboard/';

  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).filter(Boolean).forEach(c => n.appendChild(c));
    return n;
  }

  function mount(opts = {}) {
    const title = opts.title || 'Superhond';
    const icon  = opts.icon  || '🐾';
    const back  = opts.back  || HOME;

    // Detecteer context → voeg body-class toe
    const path = location.pathname;
    if (path.includes('/dashboard')) {
      document.body.classList.add('dashboard-page');
    } else if (path.includes('/beheer')) {
      document.body.classList.add('admin-page');
    }

    // Topbar
    const top = document.getElementById('topbar');
    if (top) {
      top.innerHTML = '';
      const wrap = el('div', { class: 'container topbar-flex' });

      // Terugknop
      if (back) {
        wrap.appendChild(
          el('a', { href: back, class: 'btn btn-back' }, el('span', { text: '← Terug' }))
        );
      }

      // Brand
      wrap.appendChild(
        el('a', { href: HOME, class: 'brand' }, el('span', { text: `${icon} Superhond` }))
      );

      // Versiebadge
      const badge = el('span', { class: 'version-badge', text: window.__APP_VERSION__ || 'v0.20.x' });
      wrap.appendChild(badge);

      top.appendChild(wrap);
    }

    // Footer
    const foot = document.getElementById('footer');
    if (foot) {
      const now = new Date();
      const ts  = now.toISOString().replace('T',' ').slice(0,19);
      foot.innerHTML = '';
      foot.appendChild(
        el('div', { class:'container' },
          el('small', { text:`© Superhond 2025 — v0.20.x — ${ts}` })
        )
      );
    }
  }

  // Expose
  window.SuperhondUI = { mount };
})();
