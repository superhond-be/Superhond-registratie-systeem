(function(){
  const els=document.querySelectorAll('[data-version]');
fetch('version.json?v='+Date.now())

    .then(r=>r.json())
    .then(meta=>{
      els.forEach(el=>el.textContent=meta.version);
      const b=document.querySelector('[data-build]');if(b&&meta.build)b.textContent=meta.build;
      document.querySelectorAll('link[rel="stylesheet"][data-bust]').forEach(link=>{
        link.href=link.href.split('?')[0]+'?v='+encodeURIComponent(meta.version);
      });
      document.querySelectorAll('script[data-bust]').forEach(scr=>{
        const s=document.createElement('script');
        s.src=scr.src.split('?')[0]+'?v='+encodeURIComponent(meta.version);
        scr.replaceWith(s);
      });
    });
})();
