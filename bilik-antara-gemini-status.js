"use strict";
// Safe client renderer. Receives server-reported slot metadata, never credentials.
(function(){
 const reasonNames={health_probe_quota:"Probe kuota 429",health_timeout:"Timeout",
  health_upstream_busy:"Servis sibuk",health_empty_reply:"Jawapan kosong",
  authentication_or_access:"Akses ditolak",upstream_http:"Ralat API",
  cooldown:"Cooldown",transport_error:"Ralat rangkaian",upstream_error:"Ralat penyedia",
  quota_exceeded:"Kuota penuh",quota_cooldown:"Kuota penuh",
  thinking_parameter:"Tetapan thinking ditolak",location_restricted:"Region tidak disokong",
  model_unavailable:"Model tiada",invalid_model_or_request:"Model atau permintaan tidak sah",
  credential_or_access:"Akses ditolak",invalid_request:"Permintaan tidak sah"};
 function appendSlots(list,item,elem){
  const entries=Array.isArray(item?.pool)?item.pool:[];
  for(let slot=1;slot<=4;slot++){
   const key=entries.find(x=>x&&x.slot===slot);
   const mode=!item?"checking":key?.status||"off";
   const label=mode==="online"?"Connected":mode==="ready"?"Ready":
    mode==="degraded"?"Degraded":mode==="offline"?"Offline":
    mode==="checking"?"Checking…":"Not active";
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
    parts.push(reasonNames[key.reason]||"Ralat: "+key.reason.replace(/_/g," ").slice(0,60));
   if(Number.isFinite(key?.checkedAt)&&key.checkedAt>0)
    parts.push("Semak "+new Date(key.checkedAt).toLocaleTimeString("ms-MY",{hour:"2-digit",minute:"2-digit"}));
   if(!key)parts.push(!item?"Menunggu semakan…":"Tiada key dikonfigurasi");
   else if(!Number.isFinite(key?.checkedAt))parts.push("Belum diuji · Ready bukan Connected");
   child.appendChild(elem("div","multi-ai-gemini-detail",parts.join(" · ")));
   list.appendChild(child);
  }
 }
 window.AksaraGeminiStatus={appendSlots};
 window.dispatchEvent(new Event("aksara:gemini-status-ready"));
})();
