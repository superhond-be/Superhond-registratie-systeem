function renderTopbar(container, opts, cfg, online) {
  if (!container) return;
  container.innerHTML = '';

  const {
    title = 'Superhond',
    icon  = '🐾',
    home  = false,
    back  = null // <— NIEUW: string (url) of true (history.back)
  } = opts || {};

  // optionele terugknop
  let backEl = null;
  if (back) {
    if (typeof back === 'string') {
      backEl = el('a', { class: 'btn-back', href: back }, '← Terug');
    } else {
      backEl = el('button', { class: 'btn-back', type: 'button' }, '← Terug');
      backEl.addEventListener('click', () => history.back());
    }
  }

  const left = el('div', { class: 'topbar-left' },
    backEl,
    home
      ? el('a', { class: 'brand', href: '../dashboard/' }, `${icon} ${title}`)
      : el('span', { class: 'brand' }, `${icon} ${title}`)
  );

  const mid = el('div', { class: 'topbar-mid' });

  const statusDot = el('span', {
    class: 'status-dot',
    title: online ? 'Online' : 'Offline'
  }, '');

  onceStyle('sh-topbar-style', `
    .topbar{display:flex;align-items:center;gap:.75rem;padding:.6rem 1rem;border-bottom:1px solid #e5e7eb;position:sticky;top:0;z-index:10}
    .brand{font-weight:700;color:inherit;text-decoration:none}
    .topbar-right{margin-left:auto;display:flex;align-items:center;gap:.5rem;font-size:.9rem}
    .muted{opacity:.7}
    @media (prefers-color-scheme: dark){ .topbar{border-bottom-color:#374151} }
  `);

  const right = el('div', { class: 'topbar-right' },
    statusDot,
    el('span', { class: 'muted' }, online ? 'Online' : 'Offline'),
    cfg?.version ? el('span', { class: 'muted' }, `v${cfg.version}`) : null,
    cfg?.env ? el('span', { class: 'muted' }, `(${cfg.env})`) : null
  );

  container.classList.add('topbar');
  container.append(left, mid, right);
}
