/**
 * public/js/layout.js — Topbar & Footer mount (v0.27.0)
 * - Toon gele balk op dashboard, blauwe balk elders
 * - Online/offline via directe ping naar GAS exec
 * - Ping haalt exec uit: window.SUPERHOND_SHEETS_URL → meta[name="superhond-exec"] → localStorage(superhond:apiBase)
 * - Toont versie uit window.APP_BUILD of interne APP_VERSION
 */

(function(){
  const APP_VERSION = '0.27.0';
  const LS_API = 'superhond:apiBase';

  // Hulpfuncties
  const onReady = (cb)=>document.readyState!=='loading'?cb():document.addEventListener('DOMContentLoaded',cb,{once:true});
  const el = (t,a={},...c)=>{const n=document.createElement(t);for(const[k,v]of Object.entries(a))if(v!=null){if(k==='class')n.className=v;else n.setAttribute(k,v);}for(const x of c)n.append(x.nodeType?x:document.createTextNode(x));return n;};

  // Exec resolver
  function resolveExecBase(){
    if(window.SUPERHOND_SHEETS_URL) return window.SUPERHOND_SHEETS_URL;
    const meta=document.querySelector('meta[name="superhond-exec"]');
    if(meta?.content) return meta.content.trim();
    try{const ls=localStorage.getItem(LS_API);if(ls)return ls.trim();}catch{}
    return '';
  }

  // Ping rechtstreeks naar GAS
  async function pingDirect(){
    const base=resolveExecBase(); if(!base) return false;
    const url=base+(base.includes('?')?'&':'?')+'mode=ping&t='+Date.now();
    try{const r=await fetch(url,{cache:'no-store'});return r.ok;}catch{return false;}
  }

  // Topbar
  function renderTopbar(elm,opts,online){
    const build=window.APP_BUILD||('v'+APP_VERSION);
    const isDash=document.body.classList.contains('dashboard-page');
    const left=el('div',{class:'tb-left'}, opts.back?el('a',{href:opts.back,class:'btn-back'},'← Terug'):'', el('span',{class:'brand'},opts.icon+' '+opts.title));
    const right=el('div',{class:'tb-right'},
      el('span',{class:'status-dot '+(online?'is-online':'is-offline')}),
      el('span',{class:'status-text'},online?'Online':'Offline'),
      el('span',{class:'build muted'},build)
    );
    elm.innerHTML=''; const inner=el('div',{class:'topbar-inner'},left,right);
    elm.append(inner);
    elm.style.background=isDash?'#f4c400':'#2563eb';
    elm.style.color=isDash?'#000':'#fff';
  }

  function renderFooter(elm){
    const exec=resolveExecBase()||'n.v.t.';
    const build=window.APP_BUILD||('v'+APP_VERSION);
    elm.innerHTML=`<div class="row"><div>© ${new Date().getFullYear()} Superhond</div><div><code>${exec}</code></div><div>${build}</div></div>`;
    elm.className='footer';
  }

  async function mount(opts={}){
    await new Promise(r=>onReady(r));
    const path=location.pathname.replace(/\/+$/,'');
    const dash=/dashboard/.test(path)||opts.home===true;
    document.body.classList.toggle('dashboard-page',dash);
    document.body.classList.toggle('subpage',!dash);
    const ok=await pingDirect();
    renderTopbar(document.getElementById('topbar'),opts,ok);
    renderFooter(document.getElementById('footer'));
  }

  function setOnline(ok){
    const d=document.querySelector('.status-dot');
    const t=document.querySelector('.status-text');
    if(d)d.className='status-dot '+(ok?'is-online':'is-offline');
    if(t)t.textContent=ok?'Online':'Offline';
  }

  window.SuperhondUI=Object.assign(window.SuperhondUI||{},{mount,setOnline});
})();
