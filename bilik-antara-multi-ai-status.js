/* AKSARA Multi A.I Status Engine v2
 * Provider health and request activity have independent rendering contracts.
 * This module owns UI state only. It does not alter inference, provider routing,
 * API keys, Voice or the backend's health probes.
 */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root&&root.document)root.AksaraMultiStatus=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const PROVIDERS=Object.freeze(["gemini","groq","workers_ai","openrouter"]);
 const HEALTH_TTL=120000,REPLY_TTL=90000;
 const known=new Set(PROVIDERS);
 function elapsed(ms){
  if(!Number.isFinite(ms)||ms<0)return "Unknown";
  if(ms<5000)return "just now";
  if(ms<60000)return Math.floor(ms/1000)+"s ago";
  if(ms<3600000)return Math.floor(ms/60000)+"m ago";
  return Math.floor(ms/3600000)+"h ago";
 }
 function summarize(rows,checkedAt,now=Date.now(),failure=false,checking=false){
  const age=Number.isFinite(checkedAt)&&checkedAt>0?Math.max(0,now-checkedAt):Infinity;
  const verified=Array.isArray(rows)?rows.filter(p=>p.status==="online"&&
   (p.reason==="recent_reply"&&Number.isFinite(p.checkedAt)?now-p.checkedAt<=REPLY_TTL:age<=HEALTH_TTL)).length:0;
  const ready=Array.isArray(rows)?rows.filter(p=>p.status==="ready"||p.status==="degraded").length:0;
  const enabled=Array.isArray(rows)?rows.filter(p=>p.status!=="off").length:0;
  const unknown=Array.isArray(rows)&&rows.some(p=>p.status==="unverified"||p.status==="checking");
  if(verified)return {state:"connected",label:"Multi A.I Connected",verified,checkedAt,age};
  if(failure)return {state:"unverified",label:"Multi A.I Unverified",verified,checkedAt,age};
  if(age>HEALTH_TTL&&Number.isFinite(age))return {state:"stale",label:"Multi A.I Unverified",verified,checkedAt,age};
  if(ready)return {state:"ready",label:"Multi A.I Ready",verified,checkedAt,age};
  if(checking)return {state:"checking",label:"Multi A.I Checking",verified,checkedAt,age};
  if(!Array.isArray(rows)||!rows.length||unknown)return {state:"unverified",label:"Multi A.I Unverified",verified,checkedAt,age};
  if(!enabled)return {state:"disabled",label:"Multi A.I Disabled",verified,checkedAt,age};
  return {state:"offline",label:"Multi A.I Offline",verified,checkedAt,age};
 }
 function formatHealthError(error={}){
  const http=Number(error.http),wait=Math.ceil(Number(error.retryAfterSeconds));
  if(http===429)return "HTTP 429 · "+(Number.isFinite(wait)&&wait>0?"Retry in "+Math.min(wait,3600)+"s":"Rate limited");
  if(http===404)return "HTTP 404 · Endpoint unavailable";
  if(http>=400&&http<=599)return "HTTP "+http;
  return error.timeout===true?"Timeout":"Network error";
 }
 function create({pill,label,activity,activityText,retry,stamp,requestNote}){
  let snapshot=[],checkedAt=0,checking=true,failed=false,failureDetails="";
  const replies=new Map();
  function effective(now=Date.now()){
   const fresh=checkedAt>0&&now-checkedAt<=HEALTH_TTL&&!failed;
   return PROVIDERS.map(id=>{
    const base=snapshot.find(p=>p.id===id)||{id,status:"unverified"};
    const reply=replies.get(id);
    const recent=reply&&now-reply.at<=REPLY_TTL;
    if(recent)return {...base,status:"online",model:reply.model||base.model,
      reason:"recent_reply",checkedAt:reply.at};
    if(!fresh&&base.status!=="off")return {...base,status:"unverified",reason:failed?"health_unavailable":"health_stale"};
    return base;
   });
  }
  function state(now=Date.now()){
   const rows=effective(now);
   const report=summarize(rows,checkedAt,now,failed,checking);
   // If all evidence has expired, never show a lingering green chip.
   return {...report,rows,checking};
  }
  function render(now=Date.now()){
   const report=state(now);
   pill.className="connection multi-ai-trigger"+
    (report.state==="connected"?" ready":report.state==="offline"?" error":"");
   pill.dataset.healthState=report.state;
   label.textContent=report.label;
   const live=report.rows.filter(r=>r.status==="online").length;
   const time=checkedAt?"Last checked: "+elapsed(Math.max(0,now-checkedAt)):"Not checked yet";
   const suffix=failed?" · Health check failed"+(failureDetails?" · "+failureDetails:""):checking?" · Checking…":"";
   const header=live+"/4 Connected · "+time+suffix;
   pill.title=header;
   pill.setAttribute("aria-label","Provider health: "+report.label+". "+header+". Open provider details.");
   if(stamp){
    stamp.textContent=header;
    stamp.dataset.state=report.state;
   }
   return report;
  }
  function startCheck(){checking=true;render();}
  function update(data){
   if(!Array.isArray(data?.providers))throw Error("Invalid provider health payload");
   snapshot=data.providers.filter(p=>p&&known.has(p.id));
   const time=Number(data.checkedAt);
   const now=Date.now();
   checkedAt=Number.isFinite(time)&&time>0&&time<now+30000?Math.min(time,now):now;
   checking=false;failed=false;failureDetails="";
   // Do not revive a provider if the latest check explicitly reports an outage.
   for(const item of snapshot)if(item.status==="offline"||item.status==="off")replies.delete(item.id);
   return render();
  }
  function failure(error={}){checking=false;failed=true;failureDetails=formatHealthError(error);return render();}
  function reply(provider,model){
   if(!known.has(provider))return render();
   replies.set(provider,{at:Date.now(),model:typeof model==="string"?model.slice(0,140):""});
   // A successful reply proves only this particular provider, not all four.
   return render();
  }
  function request(kind,heading,description=""){
   const done=kind==="online"||kind==="ready";
   const show=!done&&!!(heading||description);
   activity.className="connection-info"+(show?" active"+(["error","limited"].includes(kind)?" error":""):"");
   activityText.textContent=show?[heading,description].filter(Boolean).join(" · "):"";
   activity.dataset.requestState=done?"idle":kind;
   if(requestNote){requestNote.hidden=!show;requestNote.textContent=show?"Request Activity · "+[heading,description].filter(Boolean).join(" · "):"";}
   retry.hidden=kind!=="error";
   // Provider health is deliberately not written by request activity.
  }
  return Object.freeze({startCheck,update,failure,reply,request,render,state,
   getRows:()=>effective(),getLastCheckedAt:()=>checkedAt});
 }
 return Object.freeze({create,summarize,elapsed,formatHealthError,PROVIDERS,HEALTH_TTL,REPLY_TTL});
});
