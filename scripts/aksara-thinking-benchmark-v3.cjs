"use strict";
/* Dual-mode A/B: deterministic plans offline; actual model calls only by explicit consent.
 * Comparing mode style is NOT an IQ measurement. Never perform paid/provider calls in CI.
 */
const fs=require("node:fs");
const Thinking=require("../netlify/functions/aksara-thinking-v3");
const Modes=require("../bilik-antara-modes");
const Intelligence=require("../netlify/functions/antara-intelligence");
const V5=require("./aksara-evaluation-live-v5.cjs");
const extra=[
 {task:"explain",question:"Kenapa manusia tidur?"},
 {task:"critique",question:"Kritik hujah: empat AI sentiasa lebih tepat daripada satu."},
 {task:"creative",question:"Tulis puisi cahaya dan gelap tanpa membahas mod AI."},
 {task:"critique",question:"Semak dakwaan bahawa semua yang popular benar."},
 {task:"conversation",question:"woi"},
 {task:"explain",question:"Cuba lihat dari kedua-dua sudut: perlu tambah penyedia AI?"},
 {task:"explain",question:"Terangkan punca hujan secara ringkas."},
 {task:"support",question:"Aku sedih"}
];
const cases=[...V5.cases,...extra.map((x,i)=>({id:"mode-"+String(i+1).padStart(2,"0"),...x,history:[]}))];
function planOne(question,mode,history=[]){
 const intent=Intelligence.resolveIntent(question,history,false);
 const profile=Intelligence.cognitiveProfile(question,history,intent,mode);
 const base=Intelligence.cognitivePlan(intent,Modes.plan(mode,intent,Intelligence.intelligencePlan(intent),question),profile);
 return Thinking.planRequest({question,mode,intent,profile,plan:base,history});
}
function offline(){
 const records=cases.map(({id,question,history=[]})=>{
  const cahaya=planOne(question,"cahaya",history),gelap=planOne(question,"gelap",history);
  return {id,cahaya:cahaya.plan.thinkingLevel,gelap:gelap.plan.thinkingLevel,
   dualRequested:cahaya.dualPerspective&&gelap.dualPerspective};
 });
 return {suite:"AKSARA-THINKING-V3",mode:"simulated_no_provider_calls",cases:cases.length,
  pairs:2*records.length,humanGraded:false,accuracyVerified:false,records};
}
function compare(cahaya,gelap){
 const bothSucceeded=cahaya.http===200&&gelap.http===200;
 return {bothSucceeded,
  sameModelAndProvider:bothSucceeded&&cahaya.provider===gelap.provider&&
   cahaya.model===gelap.model&&!!cahaya.model,
  qualityWinner:null,humanReviewPending:true};
}
async function run({endpoint=process.env.AKSARA_THINKING_V3_EVAL_URL,count=3,fetchImpl=fetch}={}){
 const url=new URL(String(endpoint||""));
 if(url.protocol!=="https:"&&url.hostname!=="localhost"&&url.hostname!=="127.0.0.1")
  throw Error("HTTPS or localhost required");
 if(!/\/(?:\.netlify\/functions\/bilik-antara|api\/bilik-antara)$/.test(url.pathname))
  throw Error("Only Bilik Antara JSON endpoint accepted");
 const rows=[];
 for(const item of cases.slice(0,Math.max(1,Math.min(10,Math.floor(count)||3)))){
  const record={id:item.id,task:item.task,question:item.question};
  for(const mode of ["cahaya","gelap"]){
   const start=Date.now(),ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),23000);
   try{
    const response=await fetchImpl(url.href,{method:"POST",
     headers:{"content-type":"application/json"},
     body:JSON.stringify({question:item.question,history:item.history||[],thoughtMode:mode}),
     signal:ctl.signal});
    const body=await response.json();
    record[mode]={http:response.status,provider:body.provider||"unknown",model:body.model||"",
     durationMs:Date.now()-start,reply:String(body.reply||"").slice(0,7000),
     evidenceLevel:body.evidenceProfile?.level||"not_confirmed",
     depth:body.thinkingArchitecture?.depth||"not_reported",humanGrade:null};
   }catch(e){record[mode]={http:0,provider:"unknown",model:"",humanGrade:null,error:e.name==="AbortError"?"timeout":"request_failed"};}
   finally{clearTimeout(timer);}
  }
  record.comparison=compare(record.cahaya,record.gelap);
  rows.push(record);
 }
 return {suite:"AKSARA-THINKING-V3-LIVE",mode:"live_human_review_pending",
  attempted:rows.length,calls:rows.length*2,accuracyVerified:false,
  warning:"Compare only matching provider+model pairs; latency and reply length are not factual quality.",
  records:rows};
}
async function cli(){
 if(!process.argv.includes("--live")||!process.argv.includes("--confirm-quota")){
  console.log(JSON.stringify(offline(),null,2));return;
 }
 const a=process.argv.find(x=>x.startsWith("--count="));
 const count=a?Number(a.slice(8)):3;
 const out=await run({count});
 const file=process.argv.find(x=>x.startsWith("--output="))?.slice(9);
 if(file)fs.writeFileSync(file,JSON.stringify(out,null,2)+"\n",{mode:0o600});
 console.log(JSON.stringify({suite:out.suite,calls:out.calls,sameProviderModelPairs:out.records.filter(x=>x.comparison.sameModelAndProvider).length,
  humanGrading:"not_performed",reportFile:file||null},null,2));
}
if(require.main===module)cli().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={cases,offline,planOne,compare,run};
