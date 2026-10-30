"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs");
const Identity=require("../bilik-antara-identity");
const Modes=require("../bilik-antara-modes");
const Router=require("../netlify/functions/aksara-provider-router");
const html=fs.readFileSync("bilik-antara.html","utf8");
const backend=fs.readFileSync("netlify/functions/bilik-antara.js","utf8");
const brain=fs.readFileSync("bilik-antara-brain.js","utf8");

const canonical=["Google Gemini","Groq","OpenRouter","OrcaRouter"];
const questions=[
 "Empat Otak Aksara","berapa otak kau?","kau ada 4 otak?",
 "sebut nama semua 4 penyedia A.I","senaraikan 4 model AI dalam Aksara",
 "apa model yang Aksara pakai?","berapa penyedia AI yang ada dalam Bilik Antara?",
 "senaraikan semua penyedia yang kau ada",
 "kau guna Gemini Groq OpenRouter OrcaRouter?"
];

test("Canonical identity contains four providers and clear capability/status semantics",()=>{
 assert.deepEqual(Identity.TEXT_PROVIDERS,canonical);
 for(const name of canonical){
  assert.ok(Identity.WHO_AM_I.includes(name),"Siapa Aku missing "+name);
  assert.ok(Identity.INTRO.includes(name)||Identity.CORE_PROMPT.includes(name));
  assert.ok(Identity.RUNTIME_PROMPT.includes(name),"Runtime missing "+name);
  assert.ok(Identity.VOICE_CORE_PROMPT.includes(name),"Voice missing "+name);
  assert.ok(brain.includes(name),"Brain missing "+name);
 }
 assert.match(Identity.PROVIDER_FACTS,/Ready.*Connected/);
 assert.match(Identity.PROVIDER_FACTS,/Voice Live/);
 assert.match(Identity.PROVIDER_FACTS,/bukan model asas kelima/);
});

test("Default starter lists four brains; user interface and provider registry agree",()=>{
 assert.doesNotMatch(html,/<button class="starter" type="button">Empat Otak Aksara<\/button>/);
 assert.match(html,/aria-label="Lihat status empat penyedia AI/);
 assert.doesNotMatch(html,/status lima penyedia AI/i);
 const found=html.match(/const providers=(\[\[.+?\]\]);/);
 assert.ok(found,"Multi A.I. list missing");
 const listed=JSON.parse(found[1]);
 assert.deepEqual(listed.map(x=>x[1]),canonical);
 assert.deepEqual(listed.map(x=>x[0]),["gemini","groq","openrouter","orcarouter"]);
 const router=fs.readFileSync("netlify/functions/aksara-provider-router.js","utf8");
 assert.match(router,/id:"groq"/);
 assert.match(router,/id:"openrouter"/);
 assert.match(router,/id:"orcarouter"/);
 assert.match(backend,/id:"gemini"/);
 assert.doesNotMatch(html,/Requesty|requesty/i);
 assert.doesNotMatch(router,/Requesty|requesty/i);
});

test("Every default question has a prepared answer without obsolete provider claims",()=>{
 const starters=[...html.matchAll(/<button class="starter" type="button">([^<]+)<[/]button>/g)].map(m=>m[1]);
 assert.deepEqual(starters,["Siapa Aku","The Coder Poet","Apa itu Puisi Gaya Bebas"]);
 for(const question of starters){
  const answer=Identity.answerIdentity(question);
  assert.ok(typeof answer==="string"&&answer.length>80,"Missing prepared answer for "+question);
  assert.doesNotMatch(answer,/Requesty|lima penyedia|5 otak/i,question);
 }
 for(const name of canonical){
  assert.ok(Identity.answerIdentity("Siapa Aku").includes(name));
  assert.ok(Identity.CORE_PROMPT.includes(name));
 }
});

test("Prepared CAHAYA and GELAP replies answer every four-brain question",()=>{
 for(const q of questions){
  assert.equal(Identity.isProviderQuestion(q),true,"Intent did not match: "+q);
  for(const [mode,reply]of [["CAHAYA",Identity.answerIdentity(q)],["GELAP",Modes.localIdentity(q,Identity)]]){
   assert.ok(reply,mode+" missing reply for "+q);
   for(const name of canonical)assert.ok(reply.includes(name),mode+" missing "+name+" for "+q);
   assert.match(reply,/Ready/i);
   assert.match(reply,/Connected/i);
   assert.match(reply,/CAHAYA/i);
   assert.match(reply,/GELAP/i);
   if(mode==="GELAP")assert.doesNotMatch(reply,/🤖|🔗/);
  }
 }
 for(const name of canonical)assert.ok(Identity.answerIdentity("Siapa Aku").includes(name),"Siapa Aku missing "+name);
 for(const label of ["utama","fallback","backup terakhir","CAHAYA","GELAP","AI routing","rate limit"])
  assert.ok(Identity.WHO_AM_I.includes(label),"Siapa Aku missing "+label);
 assert.ok(Identity.answerIdentity("Empat Otak Aksara")?.includes("OrcaRouter"),"Manual four-brain query remains available");
 assert.ok(Identity.WHO_AM_I.length<900);
});

test("Locked Malay casual + English technical language applies to Gemini, all fallbacks and Voice",()=>{
 const Brain=require("../bilik-antara-brain");
 const html=fs.readFileSync("bilik-antara.html","utf8");
 const css=fs.readFileSync("bilik-antara.css","utf8");
 const who=Identity.answerIdentity("Siapa Aku");
 const coder=Identity.answerIdentity("The Coder Poet");
 for(const term of ["AI routing","backend","fallback","rate limit","kuota"]){
  assert.match(who,new RegExp(term,"i"),"Siapa Aku missing "+term);
 }
 for(const term of ["XDA Developers","Twister Kernel","modify kernel","optimize performance","debugging","overclocking","bootloop","Dulu aku debug code"]){
  assert.match(coder,new RegExp(term,"i"),"The Coder Poet missing "+term);
 }
 assert.match(Identity.TECH_STYLE,/GAYA BAHASA AKSARA \(STANDARD\)/);
 assert.match(Brain.CORE,/GAYA BAHASA STANDARD/);
 assert.match(Brain.VOICE_GUIDANCE,/English technical terms/);
 assert.match(Identity.RUNTIME_PROMPT,/English technical terms/);
 assert.match(Identity.VOICE_CORE_PROMPT,/English technical terms/);
 assert.doesNotMatch(who+coder,/penghalaan|sandaran lapisan/i);
 const starters=[...html.matchAll(/<button class="starter" type="button">([^<]+)<[/]button>/g)].map(x=>x[1]);
 assert.deepEqual(starters,["Siapa Aku","The Coder Poet","Apa itu Puisi Gaya Bebas"]);
 assert.match(html,/starterFollowUpTarget=starterText==="Siapa Aku"\?"The Coder Poet":""/);
 assert.match(html,/coderPoetFollowUp:followUpTarget==="The Coder Poet"/);
 assert.match(html,/if\(data\?\.coderPoetFollowUp===true\)/);
 assert.match(html,/Nak tahu tentang "The Coder Poet" pulak ke/);
 assert.match(css,/\.msg-followup-btn/);
 assert.match(html,/bilik-antara-identity\.js\?v=28/);
 assert.match(html,/bilik-antara-brain\.js\?v=13/);
});

test("Unrelated creative requests and recommendations must not hijack the four-brain answer",()=>{
 for(const q of [
  "apa model ai terbaik menurut kau?","tulis puisi tentang empat otak",
  "apa fungsi OrcaRouter?","macam mana otak manusia belajar?",
  "kenapa model AI lain mahal?","terangkan model AI untuk projek saya"
 ]){
  assert.equal(Identity.isProviderQuestion(q),false,q);
 }
});

test("Ready is not falsely labelled Connected, and live status is provider-specific",()=>{
 assert.match(html,/else if\(data\.someReady\)status\("configured","Multi A\.I Ready"/);
 assert.match(html,/if\(data\.someOnline\)status\("ready","Multi A\.I Connected"/);
 assert.match(html,/state==="online"\?"Connected":state==="ready"\?"Ready"/);
 assert.match(html,/status setiap sambungan disemak secara berasingan/i);
 assert.match(backend,/const providers=\[google,\.\.\.alternatives\]/);
 const src=fs.readFileSync("netlify/functions/aksara-provider-router.js","utf8");
 assert.match(src,/model:"openrouter\/free"/);
 assert.match(src,/model:"orcarouter\/free"/);
});

test("Four-brain server responses require no external model call",async()=>{
 const key=process.env.GEMINI_API_KEY,oldFetch=global.fetch;
 process.env.GEMINI_API_KEY="test-key-not-real";
 global.fetch=async()=>{throw Error("Direct four-brain answer must be local");};
 const origin="https://shaifulridhwan-penulispuisigayabebas.netlify.app";
 try{
  const {handler}=require("../netlify/functions/bilik-antara");
  for(const thoughtMode of ["cahaya","gelap"]){
   const data={question:"berapa otak kau?",thoughtMode};
   const response=await handler({
     httpMethod:"POST",headers:{origin,"x-nf-client-connection-ip":"regression-"+thoughtMode},
     body:JSON.stringify(data)
   });
   assert.equal(response.statusCode,200,thoughtMode);
   const body=JSON.parse(response.body);
   assert.ok(body.reply,thoughtMode);
   for(const name of canonical)assert.match(body.reply,new RegExp(name),thoughtMode+" missing "+name);
   assert.ok(["project-identity","local-knowledge"].includes(body.model),"unexpected local model "+body.model);
  }
 }finally{
  global.fetch=oldFetch;
  if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;
 }
});
