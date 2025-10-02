export function pad2(n){ return String(n).padStart(2,'0'); }
export function addDaysISO(iso, days){ const d=new Date(iso); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }
export function timeAdd(hhmm, minutes){
  const [h,m]=(hhmm||'10:00').split(':').map(Number);
  const t=new Date(2000,0,1,h||10,m||0,0,0); t.setMinutes(t.getMinutes()+(minutes||60));
  return `${pad2(t.getHours())}:${pad2(t.getMinutes())}`;
}

export function generateLessons({ reeks, pakket }) {
  if (!reeks?.startdatum) throw new Error("startdatum ontbreekt");
  const count = Number(reeks.aantalLessen ?? pakket.aantalStrippen ?? 1);
  const dur   = Number(reeks.lesduurMinutenOverride ?? pakket.lesduurMinuten ?? 60);
  const cap   = Number(reeks.maxDeelnemersOverride ?? pakket.maxDeelnemers ?? 8);
  const start = reeks.starttijd || "10:00";
  const trainerIds = Array.isArray(reeks.trainerIds) ? reeks.trainerIds : (reeks.trainerId!=null?[reeks.trainerId]:[]);

  const out = [];
  for (let i=0;i<count;i++){
    const datum = addDaysISO(reeks.startdatum, i*7);
    out.push({
      id: undefined,
      reeksId: reeks.id,
      naam: reeks.naam,
      type: reeks.type || pakket.type,
      locatieId: reeks.locatieId,
      trainerIds,
      trainerId: trainerIds[0] ?? null,
      thema: "",
      datum,
      start,
      einde: timeAdd(start, dur),
      capaciteit: cap,
      status: "actief"
    });
  }
  return out;
}
