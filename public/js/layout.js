// Superhond layout (topbar/footer) – canonical home → /dashboard/
(() => {
  const HOME = '/dashboard/';

  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children])
      .filter(Boolean)
      .forEach(c => n.appendChild(c));
    return n;
  }

  function mount(opts = {}) {
    const title = opts.title || 'Superhond';
    const icon  = opts.icon  || '🐾';
    const back  = opts.back  || HOME;

    // 👉 Accentkleur bepalen
    const isDashboard = location.pathname.replace(/\/+$/, '') === HOME.replace(/\/+$/, '');
    if (!isDashboard) {
      // subpagina = blauw
      document.body.classList.add('subpage');
    } else {
      // dashboard = geel (zekerheidshalve)
      document.body.classList.remove('subpage');
    }

    // Topbar
    const top = document.getElementById('topbar');
    if (top) {
      top.innerHTML = '';
      const wrap = el('div', { class: 'container' });

      // Terugknop (alleen tonen als back niet leeg is en niet HOME)
      if (back && !isDashboard) {
        wrap.appendChild(
          el('a', { href: back, class: 'btn btn-back' }, el('span', { text: '← Terug' }))
        );
      }

      // Brand (link altijd naar HOME)
      wrap.appendChild(
        el('a', { href: HOME, class: 'brand' }, el('span', { text: `${icon} ${title}` }))
      );

      // Versiebadge rechts
      const badge = el('span', {
        class: 'badge-version',
        text: window.__APP_VERSION__ || 'v0.19.x'
      });
      wrap.appendChild(badge);

      top.appendChild(wrap);
    }

    // Footer
    const foot = document.getElementById('footer');
    if (foot) {
      const now = new Date();
      const ts  = now.toISOString().replace('T', ' ').slice(0, 19);
      foot.innerHTML = '';
      foot.appendChild(
        el('div', { class: 'container' },
          el('small', {
            text: `© Superhond 2025 — v0.19.x (static) — ${ts}\nAPI offline — static versie gebruikt`
          })
        )
      );
    }
  }

  // Expose
  window.SuperhondUI = { mount };
})();
