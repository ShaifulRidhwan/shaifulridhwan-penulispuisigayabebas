/* AKSARA Code Engine · Compact Runtime Status v2
 * Pure client-side state. Runtime capability evidence is independent of execution
 * progress and independent of AI execution consent. No network checks or code data.
 */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root&&root.document)root.AksaraCodeHealth=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const LANGUAGES=Object.freeze(["html","javascript","python","typescript","sql","cpp"]);
 const LABELS=Object.freeze({html:"HTML / CSS",javascript:"JavaScript",python:"Python",typescript:"TypeScript",sql:"SQL",cpp:"C++"});
 const EVIDENCE_TTL=300000; // A successful probe is evidence, not a permanent promise.
 const fmtAge=(ms)=>ms<5000?"just now":ms<60000?Math.floor(ms/1000)+"s ago":ms<3600000?Math.floor(ms/60000)+"m ago":"over 1h ago";
 function create(clock=()=>Date.now()){
  const rows=new Map(LANGUAGES.map(language=>[language,{
   status:language==="html"?"available":language==="javascript"?"unverified":"not-tested",
   at:0,reason:"",latencyMs:0,source:""
  }]));
  let request={state:"idle",language:"",message:"",at:0},permission="off",lastCheckedAt=0,checking=false;
  function setEvidence(language,status,{reason="",latencyMs=0,source=""}={}){
   if(!rows.has(language))return false;
   rows.set(language,{status,at:clock(),reason:String(reason).slice(0,160),
    latencyMs:Number.isFinite(latencyMs)?Math.max(0,Math.round(latencyMs)):0,source});
   return true;
  }
  function beginProbe(){
   checking=true;
   request={state:"checking",language:"javascript",message:"Running JavaScript self-test",at:clock()};
  }
  function probe(ok,{latencyMs=0,error=""}={}){
   checking=false;lastCheckedAt=clock();
   setEvidence("javascript",ok===true?"verified":"unavailable",{
    source:"self-test",latencyMs,reason:ok===true?"":error||"JavaScript self-test failed"
   });
   request={state:"idle",language:"",message:"",at:clock()};
  }
  function verifyResult(language,report){
   if(!rows.has(language)||language==="html"||!report)return false;
   lastCheckedAt=clock();
   const ok=report.ready===true;
   setEvidence(language,ok?"verified":"unavailable",{
    source:"manual-self-test",latencyMs:report.runtimeMs||0,
    reason:ok?"":String(report.error||"Ujian runtime tidak lulus").slice(0,160)
   });
   return ok;
  }
  function previewVerified(){
   setEvidence("html","verified",{source:"sandbox-preview"});
  }
  function activity(event={}){
   const language=String(event.language||"");
   if(!rows.has(language)||language==="html")return;
   const phase=String(event.phase||"");
   if(phase==="started"){
    request={state:"executing",language,message:"Executing "+LABELS[language],at:clock()};
   }else if(phase==="loading"){
    request={state:"loading",language,message:"Loading "+LABELS[language]+" runtime",at:clock()};
   }else if(phase==="completed"){
    if(event.ok===true)setEvidence(language,"verified",{source:"successful-run",latencyMs:event.runtimeMs||0});
    request={state:event.ok===true?"completed":"failed",language,
     message:event.ok===true?"Execution Completed":"Execution Failed",at:clock()};
   }else if(phase==="cancelled"||phase==="timeout"||phase==="failed"){
    request={state:phase,language,
     message:phase==="cancelled"?"Execution Cancelled":phase==="timeout"?"Execution Timed Out":"Execution Failed",at:clock()};
   }
  }
  function setPermission(enabled,running){
   permission=running?"running":enabled?"armed":"off";
  }
  function snapshot(){
   const now=clock();
   const mapped=LANGUAGES.map(language=>{
    const row=rows.get(language);
    const stale=row.status==="verified"&&now-row.at>EVIDENCE_TTL;
    return {language,label:LABELS[language],status:stale?"unverified":row.status,
     age:row.at?Math.max(0,now-row.at):null,at:row.at,reason:stale?"Evidence expired":row.reason,
     source:row.source,latencyMs:row.latencyMs};
   });
   const js=mapped.find(r=>r.language==="javascript");
   const verified=mapped.filter(r=>r.language!=="html"&&r.status==="verified").length;
   // A JavaScript self-test failure cannot condemn four untested runtimes.
   const overall=checking?"checking":js.status==="unavailable"?"degraded":
    verified>0?"ready":"unverified";
   return {overall,verified,rows:mapped,permission,activity:request,checking,lastCheckedAt,
    checkedAgo:lastCheckedAt?fmtAge(Math.max(0,now-lastCheckedAt)):"Not checked"};
  }
  return Object.freeze({beginProbe,probe,verifyResult,activity,previewVerified,setPermission,snapshot});
 }
 return Object.freeze({create,LANGUAGES,LABELS,EVIDENCE_TTL,fmtAge});
});
