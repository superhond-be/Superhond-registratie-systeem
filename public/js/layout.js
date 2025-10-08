/**
 * public/js/layout.js — Topbar & Footer mount (v0.20.7)
 * - Dashboard = GEEL (#f4c400), Subpages = BLAUW (#2563eb)
 * - Versienummer: vaste fallback APP_VERSION (Optie 1) + cfg.version
 * - Kleur geforceerd met !important (style.setProperty)
 * - Consistente .topbar-inner.container
 */

(function () {
  const APP_VERSION = '0.20.7';                 // ⬅️ vaste versie (Optie 1)
  const LS_ADMIN   = 'superhond:admin:enabled';
  const LS_DENSITY = 'superhond:density';
  const API_CONFIG = '/api/config';
  const API_PING   = '/api/ping';

  // ───────── Utils
  const onReady = (cb)=> (document.readyState!=='loading' ? cb() : document.addEventListener('DOMContentLoaded', cb, { once:true }));
  const onceStyle=(id,css)=>{let t=document.getElementById(id); if(!t){t=document.createElement('style');t.id=id;t.textContent=css;document.head.appendChild(t)} return t;};
  const el=(tag,attrs={},...kids)=>{const n=document.createElement(tag);Object.entries(attrs||{}).forEach(([k,v])=>{if(v==null)return;if(k==='class')n.className=v;else if(k==='html')n.innerHTML=v;else n.setAttribute(k,v)});for(const c of kids){if(c==null)continue;n.appendChild(typeof c==='string'?document.createTextNode(c):c)}return n;};
  const fetchJSON=async(u)=>{const r=await fetch(u,{cache:'no-store'});if(!r.ok) throw new Error(u+' '+r.status);return r.json();};
  const ping=async()=>{try{const r=await fetch(API_PING,{cache:'no-store'});return r.ok}catch{return false}};

  // ───────── Prefs
  const isAdmin=()=>localStorage.getItem(LS_ADMIN)==='1';
  const setAdmin=(on)=>{localStorage.setItem(LS_ADMIN,on?'1':'0');document.body.classList.toggle('admin-page',!!on);};
  const applyDensity=()=>document.documentElement.setAttribute('data-density', localStorage.getItem(LS_DENSITY)||'normal');

  // ───────── Renderers
  const statusClass = ok => ok ? 'is-online' : 'is-offline';

  function renderTopbar(container, opts, cfg, online){
    if(!container) return; container.innerHTML='';

    const { title='Superhond', icon='🐾', home=false, back=null, version=null } = opts||{};

    let backEl=null;
    if(back){
      if(typeof back==='string'){ backEl = el('a',{class:'btn-back',href:back},'← Terug'); }
      else { backEl = el('button',{class:'btn-back',type:'button'},'← Terug'); backEl.addEventListener('click',()=>history.back()); }
    }

    const inner = el('div',{class:'topbar-inner container'});

    const left = el('div',{class:'tb-left'},
      backEl,
      home ? el('a',{class:'brand',href:'../dashboard/'},`${icon} ${title}`)
           : el('span',{class:'brand'},`${icon} ${title}`)
    );

    const right = el('div',{class:'tb-right'},
      el('span',{class:`status-dot ${statusClass(online)}`,title:online?'Online':'Offline'}),
      el('span',{class:'status-text'}, online?'Online':'Offline'),
      el('span',{class:'muted'}, `v${version || cfg?.version || APP_VERSION}`),
      cfg?.env ? el('span',{class:'muted'},`(${cfg.env})`) : null
    );

    // 👉 Kleur hard forceren (ook tegen !important in CSS):
    const isDashboard = document.body.classList.contains('dashboard-page');
    const bg = isDashboard ? '#f4c400' : '#2563eb';
    const fg = isDashboard ? '#000'    : '#fff';
    container.style.setProperty('background', bg, 'important');
    container.style.setProperty('color', fg, 'important');

    // Basis topbar styles (éénmalig)
    onceStyle('sh-topbar-style', `
      #topbar{position:sticky;top:0;z-index:50}
      #topbar .topbar-inner{display:flex;align-items:center;gap:.75rem;min-height:56px;border-bottom:1px solid #e5e7eb;background:inherit;color:inherit}
      .tb-left{display:flex;align-items:center;gap:.5rem}
      .tb-right{margin-left:auto;display:flex;align-items:center;gap:.6rem;font-size:.95rem}
      .brand{font-weight:800;font-size:20px;text-decoration:none;color:inherit}
      .btn-back{appearance:none;border:1px solid rgba(0,0,0,.15);background:#fff;color:#111827;border-radius:8px;padding:6px 10px;cursor:pointer}
      .status-dot{width:.6rem;height:.6rem;border-radius:999px;display:inline-block;background:#9ca3af}
      .status-dot.is-online{background:#16a34a}
      .status-dot.is-offline{background:#ef4444}
      .status-text{font-weight:600;color:inherit}
      .muted{opacity:.85}
      @media (prefers-color-scheme: dark){ #topbar .topbar-inner{border-bottom-color:#374151} }
    `);

    inner.append(left,right);
    container.appendChild(inner);
  }

  function renderFooter(container, cfg){
    if(!container) return; container.innerHTML='';
    onceStyle('sh-footer-style',`
      .footer{margin-top:2rem;padding:1rem;border-top:1px solid #e5e7eb;color:#6b7280;font-size:.9rem}
      .footer .row{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;justify-content:space-between}
      .footer code{background:rgba(0,0,0,.05);padding:.1rem .35rem;border-radius:.25rem}
    `);
    const row = el('div',{class:'row'},
      el('div',{},`© ${new Date().getFullYear()} Superhond`),
      el('div',{}, cfg?.apiBase ? el('code',{}, 'api: '+String(cfg.apiBase).replace(/^https?:\/\/(www\.)?/,''))
                                : el('span',{class:'muted'},'api: n.v.t.')),
      el('div',{}, `versie ${cfg?.version || APP_VERSION}`)
    );
    container.classList.add('footer'); container.append(row);
  }

  // ───────── Mount
  async function mount(opts={}){
    await new Promise(res=>onReady(res));
    applyDensity();

    // Auto-detect dashboard → zet juiste body-class failsafe
    try {
      const p = location.pathname.replace(/\/+$/,'');
      if (/\/dashboard$/.test(p) || /\/dashboard\/index\.html$/.test(p)) {
        document.body.classList.add('dashboard-page');
        document.body.classList.remove('subpage');
      }
    } catch {}

    document.body.classList.toggle('admin-page', isAdmin());

    // Subpagina’s krijgen standaard back=true (dashboard niet)
    const isSub = document.body.classList.contains('subpage');
    const finalOpts = Object.assign({ back: isSub ? true : null }, opts);

    const [cfg, online] = await Promise.all([
      fetchJSON(API_CONFIG).catch(()=>({})),
      ping()
    ]);

    const topbarEl = document.getElementById('topbar');
    const footerEl = document.getElementById('footer');
    if(topbarEl) renderTopbar(topbarEl, finalOpts, cfg, online);
    if(footerEl) renderFooter(footerEl, cfg);
  }

  window.SuperhondUI = Object.assign(window.SuperhondUI || {}, { mount });
})();
