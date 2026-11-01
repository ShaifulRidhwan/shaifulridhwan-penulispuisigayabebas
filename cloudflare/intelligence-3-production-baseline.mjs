// One-time smoke of CURRENT PRODUCTION (main), not the undeployed PR branch.
// Synthetic prompts only. Never log private replies, prompts, raw errors or secrets.
const BASE="https://aksara-apps.mshaifulridhwan.workers.dev";
const endpoint="/.netlify/functions/bilik-antara";
const markers=/\b(?:nggak|gimana|gue|makasih|banget)\b/i;
const reports=[];
const verdict=(label,condition,more={})=>{reports.push({label,pass:!!condition,...more});console.log(JSON.stringify(reports.at(-1)));};
async function post(path,payload,ms=40000){
 const start=Date.now();
 const res=await fetch(BASE+path,{method:"POST",headers:{"origin":BASE,"content-type":"application/json","accept":"application/json"},
 body:JSON.stringify(payload),signal:AbortSignal.timeout(ms)});
 const raw=await res.text();
 let body={};try{body=JSON.parse(raw);}catch(_){}
 return {status:res.status,body,raw,elapsed:Date.now()-start};
}
console.log("AKSARA #131: CURRENT PRODUCTION live baseline; NOT a deployed PR validation.");
let health={};
try{
 const response=await fetch(BASE+"/api/aksara-health",{signal:AbortSignal.timeout(12000)});
 health=await response.json();
 verdict("health",response.ok&&health.services?.chat===true,{
  configuredProviders:health.configuredProviders,control:health.controlConfigured,chatReady:health.services?.chat===true});
}catch(e){verdict("health",false,{errorType:e.name||"network"});}
try{
 const r=await post(endpoint,{providerStatus:true},40000);
 const providers=Array.isArray(r.body.providers)?r.body.providers.map(p=>({id:p.id,status:p.status})):null;
 verdict("provider-status",r.status===200&&providers?.length===4,{status:r.status,providers,latencyMs:r.elapsed});
}catch(e){verdict("provider-status",false,{errorType:e.name||"network"});}
const tasks=[
 {label:"cahaya-gemini-preferred",question:"Terangkan konsep aporia dalam satu ayat Bahasa Melayu Malaysia santai.",thoughtMode:"cahaya",preferredProvider:"gemini",expected:/aporia|kebuntuan|persoalan|pengetahuan/i},
 {label:"gelap-groq-preferred",question:"Berikan satu hujah ringkas mengapa keraguan bukan bukti sesuatu dakwaan itu palsu.",thoughtMode:"gelap",preferredProvider:"groq",expected:/ragu|bukti|dakwaan|benar|palsu|kepastian|keraguan/i},
 {label:"context-workers-preferred",question:"Dalam pilihan tadi, apa pilihan kedua? Jawab satu ayat.",thoughtMode:"cahaya",preferredProvider:"workers_ai",
  history:[{role:"user",content:"Pilihan pertama ialah simpan nota di pelayan. Pilihan kedua ialah IndexedDB tempatan."},{role:"assistant",content:"Aku akan bandingkan kedua-dua pilihan."}],
  expected:/IndexedDB|tempatan|peranti/i}
];
for(const c of tasks){
 try{
  const {status,body,elapsed}=await post(endpoint,{question:c.question,thoughtMode:c.thoughtMode,
   preferredProvider:c.preferredProvider,history:c.history||[]},47000);
  const reply=typeof body.reply==="string"?body.reply:"";
  verdict(c.label,status===200&&reply.length>=8&&c.expected.test(reply)&&!markers.test(reply),{
   status,provider:body.provider||"unknown",model:body.model||"unknown",elapsedMs:elapsed,
   replyChars:reply.length,relevant:c.expected.test(reply),malayMarkers:markers.test(reply),
   preferredReached:body.provider===c.preferredProvider,
   errorCode:status!==200?(body.code||"HTTP_"+status):null});
 }catch(e){verdict(c.label,false,{errorType:e.name||"network"});}
}
console.log("Summary",JSON.stringify({passed:reports.filter(x=>x.pass).length,total:reports.length,
 caveat:"Production currently runs main. These responses do NOT prove PR #131 deployed."}));
process.exitCode=reports.every(x=>x.pass)?0:1;
