"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const V4=require("../netlify/functions/aksara-thinking-v4");
const Efficiency=require("../netlify/functions/aksara-response-efficiency-v6");
const plan=(q,intent={task:"explain"},history=[],mode="cahaya")=>
 V4.planRequest({question:q,intent,history,mode,profile:{focus:"general"},basePlan:{thinkingLevel:"low",maxTokens:2200}});
test("CAHAYA defaults to substantial explanations without requiring high effort",()=>{
 const p=plan("Kenapa manusia takut berubah?");
 assert.equal(p.answerDepth,"berisi");
 assert.equal(p.effort,"medium");
 assert.match(V4.answerGuidance(p,{intent:{task:"explain"}}),/CAHAYA bukan bermaksud jawapan pendek/);
});
test("More details follow-up gets new material and sufficient output budget",()=>{
 const h=[{role:"user",content:"Mengapa kita menangguhkan kerja?"},{role:"assistant",content:"Sebab ketidakpastian."}];
 for(const q of ["jelaskan lebih detail","jelaskan lagi","lagi","lebih mendalam","jangan ringkas","terangkan lebih panjang"]){
  const p=plan(q,{task:"explain",contextFollowUp:true},h);
  assert.equal(p.answerDepth,"mendalam",q);
  assert.ok(p.plan.maxTokens>=4400,q);
  assert.match(V4.answerGuidance(p,{intent:{task:"explain"},history:h}),/MENAMBAH isi baharu/);
 }
});
test("Explicit concise instructions override verbosity without silencing reasoning",()=>{
 const p=plan("Kritik hujah ini secara ringkas.",{task:"critique",depth:"high"});
 assert.equal(p.answerDepth,"ringkas");
 assert.equal(p.plan.thinkingLevel,"high");
 assert.equal(plan("Jelaskan DNS secara ringkas").answerDepth,"ringkas");
});
test("Acknowledgments and maths remain concise",()=>{
 assert.equal(plan("haa",{task:"conversation",reaction:true}).answerDepth,"ringkas");
 assert.equal(plan("2+2",{task:"general",simpleCalculation:true}).answerDepth,"berisi");
 assert.equal(V4.answerGuidance(plan("2+2",{task:"general",simpleCalculation:true}),{intent:{simpleCalculation:true}}),"");
});
test("Both modes have identical source evidence classes and request verbosity",()=>{
 const question="Jelaskan lebih detail mengapa hujah itu lemah";
 const a=plan(question,{task:"critique"}),b=plan(question,{task:"critique"},[],"gelap");
 assert.equal(a.answerDepth,b.answerDepth);
 assert.equal(V4.evidenceState({sources:[]}),"no_external_evidence");
 assert.equal(V4.evidenceState({research:{status:"search-snippets"},sources:[{}]}),"search_excerpt");
 assert.equal(V4.evidenceState({research:{status:"page-read"},sources:[{}]}),"page_text");
 assert.match(V4.argumentVerification({question,intent:{task:"critique"}}),/Jangan jadikan GELAP pembangkang automatik/);
});
test("No user secrets in guidance or completion status",()=>{
 const h=[{role:"user",content:"RAHSIA-4K"},{role:"assistant",content:"Ringkas."}];
 const p=plan("jelaskan lagi",{task:"explain"},h);
 const g=V4.guidance({request:p,question:"jelaskan lagi",intent:{task:"explain"},history:h});
 assert.equal(g.guidance.includes("RAHSIA-4K"),false);
 const a=V4.auditReply({reply:"Terlalu pendek.",request:p,intent:{task:"explain"}});
 assert.deepEqual(a.issueCodes,["too_brief_for_requested_detail"]);
 assert.equal(a.accuracyVerified,false);
 assert.equal(JSON.stringify(a).includes("RAHSIA-4K"),false);
});
test("Supporting and creative requests never impose explanation paragraph quotas",()=>{
 for(const intent of [{task:"creative"},{task:"support",sensitive:true}]){
  const p=plan("Tulis huraian terperinci",intent);
  assert.doesNotMatch(V4.answerGuidance(p,{intent}),/3–6 perenggan/);
 }
});
test("Opt-in response efficiency cannot cap substantive or deep answers",()=>{
 const options={system:"AKSARA",history:[],question:"Apa itu DNS?",intent:{task:"explain"},
  plan:{thinkingLevel:"low"},maxTokens:4400,env:{AKSARA_V6_RESPONSE_EFFICIENCY:"true"}};
 assert.equal(Efficiency.decide({...options,answerDepth:"mendalam"}).maxTokens,4400);
 assert.equal(Efficiency.decide({...options,answerDepth:"berisi"}).maxTokens,4400);
 assert.equal(Efficiency.decide({...options,answerDepth:"ringkas"}).maxTokens,1800);
});
test("Only one V4 thinking plan drives the effective model and API metadata",()=>{
 const src=fs.readFileSync("netlify/functions/bilik-antara.js","utf8");
 assert.match(src,/ThinkingV4\.planRequest/);
 assert.match(src,/ThinkingV4\.guidance/);
 assert.doesNotMatch(src,/ThinkingV3\.depth\(/);
 assert.doesNotMatch(src,/ThinkingV3\.planRequest\(/);
 assert.match(src,/thinkingArchitecture:\{version:4/);
 assert.match(src,/depth:adaptiveThinking/);
 assert.match(src,/answerDepth:thinkingV4\.answerDepth/);
 assert.match(src,/ThinkingV4\.auditReply/);
});
test("Final-response completeness audit is heuristic and never auto spends quota",()=>{
 const p=plan("jelaskan lebih detail");
 const flagged=V4.auditReply({reply:"Ringkas.",request:p,intent:{task:"explain"}});
 assert.equal(flagged.status,"needs_review");
 const enough=V4.auditReply({reply:"Perenggan dengan isi bermakna. ".repeat(30),request:p,intent:{task:"explain"}});
 assert.equal(enough.status,"complete_by_heuristic");
 assert.equal(enough.accuracyVerified,false);
});
