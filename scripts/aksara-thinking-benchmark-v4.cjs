"use strict";
/* Honest V4 evaluation: offline plans are not grades of model intelligence.
 * Opt-in live calls reuse the existing V3 paired human-review harness.
 */
const V3Bench=require("./aksara-thinking-benchmark-v3.cjs");
const V4=require("../netlify/functions/aksara-thinking-v4");
const Intel=require("../netlify/functions/antara-intelligence");
const Modes=require("../bilik-antara-modes");
const cases=[...V3Bench.cases,
 {id:"v4-detail-followup",question:"jelaskan lagi",history:[{role:"user",content:"Kenapa kita takut berubah?"},{role:"assistant",content:"Perubahan membawa ketidakpastian."}]},
 {id:"v4-explicit-detail",question:"Cahaya, terangkan lebih detail mengapa otak takut perubahan",history:[]},
 {id:"v4-simple-fact",question:"Apa maksud graviti?",history:[]},
 {id:"v4-explicit-short",question:"Terangkan relativiti secara ringkas",history:[]}
];
function planOne(question,mode,history=[]){
 const intent=Intel.resolveIntent(question,history,false);
 const profile=Intel.cognitiveProfile(question,history,intent,mode);
 const base=Intel.cognitivePlan(intent,Modes.plan(mode,intent,Intel.intelligencePlan(intent),question),profile);
 return V4.planRequest({question,mode,intent,profile,basePlan:base,history});
}
function offline(){
 const records=cases.map(({id,question,history=[]})=>{
  const cahaya=planOne(question,"cahaya",history);
  const gelap=planOne(question,"gelap",history);
  return {id,cahaya:{effort:cahaya.effort,answerDepth:cahaya.answerDepth},
   gelap:{effort:gelap.effort,answerDepth:gelap.answerDepth},
   dualRequested:cahaya.dualPerspective&&gelap.dualPerspective};
 });
 return {suite:"AKSARA-THINKING-V4",mode:"offline_planning_only",cases:records.length,
  pairs:records.length*2,providerCalls:0,accuracyVerified:false,
  answerCompletenessVerified:false,humanGraded:false,records};
}
async function live(args){return V3Bench.run(args);}
if(require.main===module)(async()=>{
 if(process.argv.includes("--live")){
  if(!process.argv.includes("--confirm-quota"))throw Error("Live comparisons require --confirm-quota.");
  const count=Math.max(1,Math.min(10,Number(process.argv.find(x=>x.startsWith("--count="))?.split("=")[1])||3));
  const out=await live({endpoint:process.env.AKSARA_THINKING_V3_EVAL_URL,count});
  console.log(JSON.stringify({suite:"AKSARA-THINKING-V4-LIVE",calls:out.calls,
   accuracyVerified:false,humanReviewPending:true,
   sameProviderModelPairs:out.records.filter(x=>x.comparison.sameModelAndProvider).length},null,2));
 }else console.log(JSON.stringify(offline(),null,2));
})().catch(err=>{console.error(err.message);process.exitCode=1;});
module.exports={cases,planOne,offline,live};
