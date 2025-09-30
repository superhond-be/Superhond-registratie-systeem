// /js/agenda.js
(function(){
  const bust = () => `cb=${Date.now().toString(36)}`;
  const SOURCES = ["/data/agenda.json","./data/agenda.json","../data/agenda.json"];

  async function loadData(){
    let lastErr;
    for(const url of SOURCES){
      try{
        const res = await fetch(`${url}?${bust()}`,{cache:"no-store"});
        if(!res.ok) throw new Error(res.statusText);
        return await res.json();
      }catch(e){ lastErr = e; }
    }
    throw lastErr;
  }

  function filter(items,mode){
    const now = new Date();
    if(mode==="week"){
      const start = new Date(now); start.setDate(now.getDate() - ((now.getDay()+6)%7)); // maandag
      const end = new Date(start); end.setDate(start.getDate()+6);
      return items.filter(it=>{
        const d = new Date(it.datum);
        return d>=start && d<=end;
      });
    }
    if(mode==="mededelingen"){
      return items.filter(it=> (it.type||"").toLowerCase()==="mededeling");
    }
    return items;
  }

  function render(items){
    const wrap=document.getElementById("agenda-table-wrap");
    const tbody=document.querySelector("#agenda-table tbody");
    const err=document.getElementById("agenda-error");
    err.textContent="";

    tbody.innerHTML = items.map(it=>`
      <tr>
        <td>${it.datum ?? ""}</td>
        <td>${it.href ? `<a href="${it.href}">${it.titel}</a>` : it.titel}</td>
        <td>${it.type ?? ""}</td>
      </tr>`).join("");

    wrap.hidden=false;
  }

  async function init(){
    try{
      const data=await loadData();
      let mode="week";
      render(filter(data,mode));

      document.querySelectorAll(".tab").forEach(btn=>{
        btn.addEventListener("click",()=>{
          document.querySelectorAll(".tab").forEach(b=>b.setAttribute("aria-pressed","false"));
          btn.setAttribute("aria-pressed","true");
          mode=btn.dataset.tab;
          render(filter(data,mode));
        });
      });
    }catch(e){
      const err=document.getElementById("agenda-error");
      if(err) err.textContent="Agenda kon niet geladen worden.";
      console.error(e);
    }
  }

  document.addEventListener("DOMContentLoaded",init);
})();
