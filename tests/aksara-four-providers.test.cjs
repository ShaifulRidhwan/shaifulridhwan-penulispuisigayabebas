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
  assert.ok(Identity.INTRO||Identity.CORE_PROMPT.includes(name));
  assert.ok(Identity.RUNTIME_PROMPT.includes(name),"Runtime missing "+name);
  assert.ok(Identity.VOICE_CORE_PROMPT.includes(name),"Voice missing "+name);
  assert.ok(brain.includes(name),"Brain missing "+name);
 }
 assert.match(Identity.PROVIDER_FACTS,/Ready.*Connected/);
 assert.match(Identity.PROVIDER_FACTS,/Voice Live/);
 assert.match(Identity.PROVIDER_FACTS,/bukan model asas kelima/);
});

test("Default starter lists four brains; user interface and provider registry agree",()=>{
 assert.match(html,/>Empat Otak Aksara<\/button>/);
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
 assert.ok(Identity.WHO_AM_I.length<500);
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
