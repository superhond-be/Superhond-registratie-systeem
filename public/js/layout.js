/**
 * public/js/layout.js — Topbar & Footer (v0.27.2)
 * - Leest exec-URL & branch via <meta>
 * - Ping rechtstreeks naar GAS /exec
 * - Dashboard = geel, subpagina = blauw
 */

(function () {
  const APP_VERSION  = '0.27.2';
  const LS_BRANCH    = 'superhond:branchLabel';
  const LS_DENSITY   = 'superhond:density';

  const onReady = (cb)=>document.readyState!=='loading'?cb():document.addEventListener('DOMContentLoaded',cb,{once:true});
  const el = (t,a={},...k)=>{ const n=document.createElement(t); for(const[k2,v] of Object.entries(a||{})){ if(v==null)continue; if(k2==='class')n.className=v; else if(k2==='html')n.innerHTML=v; else n.setAttribute(k2,v);} for(const c of k) if(c!=null) n.append(typeof c==='string'?document.createTextNode(c):c); return n; };
  const onceStyle=(id,css)=>{let s=document.getElementById(id); if(!s){s=document.createElement('style');s.id=id;s.textContent=css;document.head.appendChild(s);} return s;};

  const getExecBase = ()=> (document.querySelector('meta[name="superhond-exec"]')?.content||'').trim();
  const getBranchLabel = ()=> (document.querySelector('meta[name="superhond-branch"]')?.content?.trim() || localStorage.getItem(LS_BRANCH) || '');

  async function ping(){
    const base = getExecBase(); if(!base) return false;
    const url = `${base}${base.includes('?')?'&':'?'}mode=ping&t=${Date.now()}`;
    try{ const r = await fetch(url,{cache:'no-store'}); return r.ok; }catch{ return false; }
  }

  function forceColors(container, isDash){
    container.style.setProperty('background', isDash ? '#f4c400' : '#2563eb', 'important');
    container.style.setProperty('color', isDash ? '#000' : '#fff', 'important');
  }
  const statusClass = (ok)=> ok?'is-online':'is-offline';
  function applyNetStatus(ok){
    const dot=document.querySelector('#topbar .status-dot');
    const txt=document.querySelector('#topbar .status-text');
    if(dot){ dot.classList.toggle('is-online',!!ok); dot.classList.toggle('is-offline',!ok); }
    if(txt){ txt.textContent = ok?'Online':'Offline'; }
  }

  function renderTopbar(host, {title='Superhond',icon='🐾',home=null,back=null,isDashboard=null}={}, online){
    if(!host) return;
    host.innerHTML='';

    const path = location.pathname.replace(/\/+$/,'');
    const autoDash = /\/dashboard$/.test(path) || /\/dashboard\/index\.html$/.test(path);
    const dash = (isDashboard!=null)?!!isDashboard:(home===true?true:autoDash);

    let backEl=null;
    if(back){
      backEl = typeof back==='string' ? el('a',{class:'btn-back',href:back},'← Terug')
                                      : el('button',{class:'btn-back',type:'button'},'← Terug');
      if(backEl.tagName==='BUTTON') backEl.addEventListener('click',()=>history.back());
    }

    const branch = getBranchLabel();
    const versionText = `v${APP_VERSION}` + (branch?` (${branch})`:'');

    onceStyle('sh-topbar-css',`
      #topbar{position:sticky;top:0;z-index:50}
      #topbar .topbar-inner{display:flex;align-items:center;gap:.75rem;min-height:56px;border-bottom:1px solid #e5e7eb;background:inherit;color:inherit}
      .tb-left{display:flex;align-items:center;gap:.5rem}
      .tb-right{margin-left:auto;display:flex;align-items:center;gap:.6rem;font-size:.95rem}
      .brand{font-weight:800;font-size:20px;text-decoration:none;color:inherit}
      .btn-back{appearance:none;border:1px solid rgba(0,0,0,.15);background:#fff;color:#111827;border-radius:8px;padding:6px 10px;cursor:pointer}
      .status-dot{width:.6rem;height:.6rem;border-radius:999px;display:inline-block;background:#9ca3af}
      .status-dot.is-online{background:#16a34a}
      .status-dot.is-offline{background:#ef4444}
      .muted{opacity:.85}
    `);

    const inner=el('div',{class:'topbar-inner container'});
    const left = el('div',{class:'tb-left'}, backEl,
      dash ? el('a',{class:'brand',href:'../dashboard/'},`${icon} ${title}`)
           : el('span',{class:'brand'},`${icon} ${title}`)
    );
    const right=el('div',{class:'tb-right'},
      el('span',{class:`status-dot ${statusClass(online)}`,title:online?'Online':'Offline'}),' ',
      el('span',{class:'status-text'}, online?'Online':'Offline'),' ',
      el('span',{class:'muted'}, versionText)
    );

    forceColors(host, dash);
    inner.append(left,right);
    host.append(inner);
  }

  function renderFooter(host){
    if(!host) return;
    host.innerHTML='';
    onceStyle('sh-footer-css',`
      .footer{margin-top:2rem;padding:1rem;border-top:1px solid #e5e7eb;color:#6b7280;font-size:.9rem}
      .footer .row{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;justify-content:space-between}
      .footer code{background:rgba(0,0,0,.05);padding:.1rem .35rem;border-radius:.25rem}
    `);
    const base = getExecBase();
    const row = el('div',{class:'row'},
      el('div',{},`© ${new Date().getFullYear()} Superhond`),
      el('div',{}, base ? el('code',{}, 'exec: '+ base.replace(/^https?:\/\/(www\.)?/,'') ) : el('span',{class:'muted'},'exec: n.v.t.') ),
      el('div',{}, `v${APP_VERSION}`)
    );
    host.classList.add('footer'); host.append(row);
  }

  async function mount(opts={}){
    await new Promise(r=>onReady(r));
    const path=location.pathname.replace(/\/+$/,'');
    const isDash=/\/dashboard$/.test(path)||/\/dashboard\/index\.html$/.test(path)||opts.home===true;
    document.body.classList.toggle('dashboard-page',isDash);
    document.body.classList.toggle('subpage',!isDash);

    const topbar=document.getElementById('topbar');
    const footer=document.getElementById('footer');

    const online = await ping();
    if(topbar) renderTopbar(topbar, {home:isDash,back:!isDash,...opts}, online);
    if(footer) renderFooter(footer);

    setInterval(async ()=>applyNetStatus(await ping()), 45000);
  }

  window.SuperhondUI = Object.assign(window.SuperhondUI||{}, {
    mount,
    setOnline: (ok)=>applyNetStatus(!!ok),
    noteSuccess: ()=>applyNetStatus(true),
    noteFailure: ()=>applyNetStatus(false)
  });
})();
