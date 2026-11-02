"use strict";
// Safe client renderer. Receives server-reported slot metadata, never credentials.
(function(){
 const reasonNames={health_probe_quota:"Probe Rate Limited (429)",health_timeout:"Timeout",
  health_upstream_busy:"Service Unavailable",health_empty_reply:"Empty Response",
  authentication_or_access:"Access Denied",upstream_http:"API Error",
  cooldown:"Cooldown",transport_error:"Network Error",upstream_error:"Provider Error",
  quota_exceeded:"Quota Exceeded",quota_cooldown:"Quota Exceeded",
  thinking_parameter:"Thinking Rejected",location_restricted:"Region Restricted",
  model_unavailable:"Model Unavailable",invalid_model_or_request:"Invalid Model or Request",
  credential_or_access:"Access Denied",invalid_request:"Invalid Request"};
 function appendSlots(list,item,elem){
  const entries=Array.isArray(item?.pool)?item.pool:[];
  for(let slot=1;slot<=4;slot++){
   const key=entries.find(x=>x&&x.slot===slot);
   const stale=Number.isFinite(key?.checkedAt)&&Date.now()-key.checkedAt>120000;
   const mode=!item?"checking":item.status==="unverified"||stale?"unverified":key?.status||"off";
   const label=mode==="online"?"Connected":mode==="ready"?"Ready":
    mode==="degraded"?"Degraded":mode==="offline"?"Offline":
    mode==="unverified"?"Unverified":mode==="checking"?"Checking…":"Disabled";
   const child=elem("div","multi-ai-model-row multi-ai-gemini-slot");
   child.dataset.geminiSlot=String(slot);
   const head=elem("div","multi-ai-gemini-heading");
   head.append(elem("span","multi-ai-model-name","Gemini "+slot),
    elem("span","multi-ai-state "+(mode==="online"?"is-online":mode==="offline"?"is-offline":
     mode==="ready"||mode==="degraded"?"is-ready":"is-muted"),label));
   child.appendChild(head);
   const parts=[];
   if(typeof key?.model==="string"&&key.model)parts.push("Model: "+key.model.slice(0,80));
   if(Number.isInteger(key?.http))parts.push("HTTP "+key.http);
   if(Number.isFinite(key?.latencyMs))parts.push(key.latencyMs+" ms");
   if(typeof key?.reason==="string"&&key.reason)
    parts.push(reasonNames[key.reason]||"Reason: "+key.reason.replace(/_/g," ").slice(0,60));
   if(Number.isFinite(key?.checkedAt)&&key.checkedAt>0)
    parts.push("Checked "+new Date(key.checkedAt).toLocaleTimeString("en-MY",{hour:"2-digit",minute:"2-digit"}));
   if(!key)parts.push(!item?"Awaiting health check…":"API key not configured");
   else if(!Number.isFinite(key?.checkedAt))parts.push("Not verified · Ready is not Connected");
   child.appendChild(elem("div","multi-ai-gemini-detail",parts.join(" · ")));
   list.appendChild(child);
  }
 }
 window.AksaraGeminiStatus={appendSlots};
 window.dispatchEvent(new Event("aksara:gemini-status-ready"));
})();
