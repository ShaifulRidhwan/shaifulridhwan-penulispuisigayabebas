"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const Thinking=require("../netlify/functions/aksara-thinking-v3");
const Modes=require("../bilik-antara-modes");
const Bench=require("../scripts/aksara-thinking-benchmark-v3.cjs");
const sample=(question,mode="cahaya",extra={})=>Thinking.planRequest({
 question,mode,intent:{task:"explain",depth:"low",...extra.intent},
 profile:{focus:"general",depth:"low",...extra.profile},
 plan:{thinkingLevel:"low",maxTokens:2500},
 history:extra.history||[],research:extra.research||{},sources:extra.sources||[]
});
test("CAHAYA/GELAP are two delivery modes, not two model APIs",()=>{
 assert.equal(Modes.normalize("cahaya"),"cahaya");
 assert.equal(Modes.normalize("gelap"),"gelap");
 assert.equal(Modes.normalize("anything else"),"cahaya");
 assert.match(Thinking.dualGuidance(true),/SATU respons model/);
});
test("Generic word manusia does not inflate depth for a simple factual question",()=>{
 const d=Thinking.depth({question:"Kenapa manusia tidur?",mode:"gelap",
  intent:{task:"explain",depth:"low"},profile:{focus:"general",depth:"low"},
  base:{thinkingLevel:"high",maxTokens:8500}});
 assert.equal(d.plan.thinkingLevel,"medium");
 assert.ok(d.plan.maxTokens<=3200);
});
test("Simple conversational turns do not burn high tokens",()=>{
 const x=Thinking.depth({question:"woi",mode:"gelap",intent:{task:"conversation"},
  profile:{focus:"general"},base:{thinkingLevel:"medium",maxTokens:4000}});
 assert.equal(x.plan.thinkingLevel,"low");
 assert.ok(x.plan.maxTokens<=3200);
});
test("Deep argument can elevate CAHAYA to high too",()=>{
 const x=Thinking.depth({question:"Kritik hujah ini secara mendalam: popular bererti benar.",
  mode:"cahaya",intent:{task:"critique",depth:"high"},profile:{focus:"argument",depth:"high"},
  base:{thinkingLevel:"low",maxTokens:2500}});
 assert.equal(x.plan.thinkingLevel,"high");
 assert.ok(x.plan.maxTokens>=5600);
});
test("Debugging with evidence increases depth only as needed",()=>{
 const x=Thinking.depth({question:"Betulkan bug API ini menggunakan log.",
  mode:"gelap",intent:{task:"technical",depth:"low"},
  profile:{focus:"debugging",depth:"medium"},base:{thinkingLevel:"low",maxTokens:2500}});
 assert.equal(x.plan.thinkingLevel,"medium");
});
test("Sensitive cases and simple calculations keep safe original planning",()=>{
 for(const question of ["Aku sedih","Dalam kecemasan sekarang"]){
  const old={thinkingLevel:"low",maxTokens:800};
  assert.deepEqual(Thinking.depth({question,mode:"gelap",
   intent:{task:"support",sensitive:true},base:old}).plan,old);
 }
 const old={thinkingLevel:"low",maxTokens:800};
 assert.deepEqual(Thinking.depth({question:"2+2",mode:"gelap",
  intent:{task:"technical",simpleCalculation:true},base:old}).plan,old);
});
test("Argument integrity is targeted, not plastered over everything",()=>{
 const x=Thinking.argumentGuidance({question:"Uji hujah ini",intent:{task:"critique"},profile:{focus:"argument"},mode:"gelap"});
 assert.match(x,/bantahan terkuat/i);assert.match(x,/Jangan bantah dakwaan yang benar/);
 assert.equal(Thinking.argumentGuidance({question:"Tulis puisi hujah",intent:{task:"creative"},profile:{focus:"creative"}}),"");
 assert.equal(Thinking.argumentGuidance({question:"Woi",intent:{task:"conversation"}}),"");
});
test("Cross-mode continuity never embeds private history in its policy",()=>{
 const h=[{role:"user",content:"RAHSIA-TEST-123"},{role:"assistant",content:"Pendirian awal."}];
 const t=Thinking.continuityGuidance(h);
 assert.match(t,/fakta dan pembetulan/);
 assert.doesNotMatch(t,/RAHSIA-TEST-123/);
 assert.equal(Thinking.continuityGuidance([]),"");
});
test("Correcting with new evidence prompts reconsideration, not automatic surrender",()=>{
 const rows=[{role:"assistant",content:"A"}];
 const x=Thinking.stanceGuidance({question:"Sebenarnya ada bukti baru dalam log",history:rows,mode:"gelap"});
 assert.match(x,/periksa kandungan dan kesahihan/);
 assert.match(x,/Jangan menjadi pembangkang automatik/);
 assert.equal(Thinking.stanceGuidance({question:"woi",history:rows}),"");
});
test("Evidence guidance distinguishes page text, snippets, and no web evidence",()=>{
 const intent={search:true,hasLink:true};
 const a=Thinking.evidenceGuidance({question:"Semak laman ini",intent,
  research:{status:"page-read"},sources:[{url:"https://example.com"}]});
 assert.match(a,/page_text/);assert.match(a,/bukan bukti semakan visual/);
 const b=Thinking.evidenceGuidance({question:"Semak laman ini",intent,
  research:{status:"search-snippets"},sources:[{url:"https://example.com"}]});
 assert.match(b,/search_excerpt/);assert.match(b,/petikan atau metadata/);
 const c=Thinking.evidenceGuidance({question:"Semak laman ini",intent,
  research:{status:"failed"},sources:[]});
 assert.match(c,/no_external_evidence/);assert.match(c,/Jangan dakwa carian web berjaya/);
});
test("Dual Perspective is opt-in and never triggered by a poem motif",()=>{
 for(const q of [
  "Cuba lihat dari kedua-dua sudut: apakah teknologi menguntungkan semua?",
  "Jawab dari sudut CAHAYA dan GELAP: apa makna pilihan?",
  "Beri dua perspektif tentang keputusan ini",
  "Dual perspective: bincangkan idea ini"
 ])assert.equal(Thinking.dualPerspective(q),true,q);
 for(const q of [
  "Tulis puisi tentang cahaya dan gelap",
  "Apa beza mod cahaya dan gelap?",
  "Aku suka lukisan cahaya dan gelap",
  "Apakah warna cahaya?"
 ])assert.equal(Thinking.dualPerspective(q),false,q);
});
test("Sensitive user prompts do not force two different perspectives",()=>{
 assert.equal(Thinking.dualPerspective("Beri dua sudut, aku sedih",{sensitive:true}),false);
 assert.equal(sample("Beri dua perspektif tentang perkara ini","gelap",{intent:{sensitive:true,task:"support"}}).dualPerspective,false);
});
test("One-request dual instructions preserve evidence, not fake model calls",()=>{
 const x=sample("Cuba lihat dari kedua-dua sudut: patutkah kita tambah AI?");
 assert.equal(x.dualPerspective,true);
 assert.match(x.guidance,/CAHAYA/);
 assert.match(x.guidance,/GELAP/);
 assert.match(x.guidance,/Jangan dakwa dua model API/);
});
test("Old no-dual behavior remains default",()=>{
 const x=sample("Jelaskan apa itu DNS");
 assert.equal(x.dualPerspective,false);
 assert.doesNotMatch(x.guidance,/DUAL PERSPECTIVE 3.0/);
});
test("No source or prior history leads to no invented evidence or memory",()=>{
 const x=sample("Uji dakwaan ini", "gelap",{intent:{task:"critique",search:true},profile:{focus:"argument"}});
 assert.equal(x.evidenceState,"no_external_evidence");
 assert.doesNotMatch(x.guidance,/sejarah perbualan pernah disimpan/);
});
test("Request-local architecture is integrated with no Voice Live code edits",()=>{
 const s=fs.readFileSync("netlify/functions/bilik-antara.js","utf8");
 assert.match(s,/ThinkingV4\.planRequest/);
 assert.match(s,/ThinkingV4\.guidance/);
 assert.match(s,/thinkingV3\.guidance/);
 assert.match(s,/thinkingArchitecture:\{version:4/);
 assert.match(s,/Modes\.instructions\(thoughtMode,"voice",true\)/);
 assert.match(s,/hasFileUploads/);
 assert.match(s,/GeminiTextPool\\.pick\\(\\)/);
 assert.match(s,/LargeUpload\\.parseReceipts\\(payload\\.fileUploads\\)/);
 assert.match(s,/process\\.env\\.GEMINI_API_KEY/);
});
test("Paired benchmark offline does not contact an API or grade live truth",()=>{
 const x=Bench.offline();
 assert.ok(x.cases>=50);
 assert.equal(x.mode,"simulated_no_provider_calls");
 assert.equal(x.humanGraded,false);
 assert.equal(x.pairs,2*x.cases);
});
test("Comparison does not claim fairness when provider or model differs",()=>{
 const equal=Bench.compare({provider:"gemini",model:"one",http:200},
  {provider:"gemini",model:"one",http:200});
 const unequal=Bench.compare({provider:"gemini",model:"one",http:200},
  {provider:"groq",model:"two",http:200});
 assert.equal(equal.sameModelAndProvider,true);
 assert.equal(unequal.sameModelAndProvider,false);
 assert.equal(unequal.qualityWinner,null);
});
