"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const ID=require("../bilik-antara-identity");
const {handler}=require("../netlify/functions/bilik-antara");

test("AI name, Bilik Antara room and Google Gemini remain distinct",()=>{
 assert.equal(ID.NAME,"Aksara A.I.");
 assert.equal(ID.ROOM,"Bilik Antara");
 assert.equal(ID.CREATOR,"Shaiful Ridhwan");
 assert.equal(ID.BASE,"Google Gemini");
 assert.match(ID.INTRO,/Aku Aksara A\.I/);
 assert.match(ID.INTRO,/Bilik Antara/);
 assert.match(ID.INTRO,/Google/);
 assert.doesNotMatch(ID.INTRO,/Aku Bilik Antara/);
});
test("identity responses cover creator, modifications and model provenance",()=>{
 const cases=[
  ["kau siapa?","Aksara A.I."],
  ["siapa kau sebenarnya?","Aksara A.I."],
  ["Siapa cipta kau?","Shaiful Ridhwan"],
  ["siapa pencipta Bilik Antara","Shaiful Ridhwan"],
  ["Apa yang Shaiful dah buat kat kau, modifikasi apa?","pemikiran adaptif"],
  ["modifikasi kau","Gemini"],
  ["Apa itu Bilik Antara","ruang"],
  ["Gemini tu model siapa?","Google"]
 ];
 for(const [q,expected]of cases){
  const response=ID.answerIdentity(q);
  assert.ok(response,"No answer for "+q);
  assert.match(response,new RegExp(expected,"i"),q);
 }
});
test("Gemini provenance questions answer Google directly without confusing Aksara's developer",()=>{
 for(const question of ["Gemini tu model siapa?","Gemini model siapa?","Siapa yang bangunkan Gemini?","Gemini dibangunkan oleh siapa?"]){
  const response=ID.answerIdentity(question);
  assert.match(response,/Gemini dibangunkan oleh Google/i,question);
  assert.match(response,/Shaiful.*Aksara/i,question);
  assert.match(response,/API Gemini, Groq, Mistral dan OpenRouter/i,question);
  assert.match(response,/Requesty sebagai pilihan bersyarat/i,question);
  assert.match(response,/penghalaan.*penyedia/i,question);
  assert.match(response,/Voice Chat pula menggunakan Gemini Live dengan modifikasi code tersendiri/i,question);
 }
 assert.doesNotMatch(ID.answerIdentity("Siapa cipta kau?"),/^Gemini dibangunkan oleh Google/);
});
test("Siapa Aku answers project origin, enhancements and base-model provenance",()=>{
 const reply=ID.answerIdentity("Siapa Aku");
 assert.match(reply,/Aksara A\.I\./);
 assert.match(reply,/dibina dan terus diubah suai oleh Shaiful Ridhwan/);
 assert.match(reply,/keupayaan setinggi mungkin/);
 assert.match(reply,/Google Gemini/);
 assert.match(reply,/bukan mendakwa sudah mencapai kecerdasan tertinggi di dunia/);
 assert.doesNotMatch(reply,/^Aku (?:sudah|telah) mencapai kecerdasan tertinggi/m);
 assert.equal(ID.answerIdentity("siapa aku?"),reply);
});
test("Verified Shaiful Ridhwan biography is rich, natural and attribution-safe",()=>{
 const detailed=ID.CREATOR_STORY;
 assert.equal(ID.answerIdentity("Siapa Shaiful Ridhwan?"),ID.CREATOR_INTRO,"Direct biography uses verified project facts without a slow inference call");
 assert.ok(detailed&&detailed.length>650,"Creator reply should not be two dry sentences");
 assert.match(detailed,/penulis puisi gaya bebas/i);
 assert.match(detailed,/puisigayabebas/);
 assert.match(detailed,/gaya bebas/i);
 assert.match(detailed,/Antara Cahaya dan Gelap/);
 assert.match(detailed,/Bilik Antara/);
 assert.match(ID.CREATOR_PROFILE.provenance,/Google.*Gemini/);
 assert.match(ID.CREATOR_PROFILE.role,/pembangun/i);
 assert.equal(ID.answerIdentity("Shaiful Ridhwan tu siapa?"),ID.CREATOR_INTRO);
 assert.equal(ID.answerIdentity("Kau kenal Shaiful Ridhwan?"),ID.CREATOR_INTRO);
});
test("Creator is credited as builder of the application, not trainer of Gemini",()=>{
 const who=ID.answerIdentity("Siapa cipta kau?");
 assert.ok(who&&who.length>100);
 assert.match(who,/Shaiful Ridhwan.*membangunkan/);
 assert.match(who,/Google.*Gemini/i);
 assert.match(ID.VOICE_CREATOR_PROMPT,/BILA DITANYA TENTANG SHAIFUL/);
 assert.match(ID.VOICE_CREATOR_PROMPT,/6 hingga 10 ayat/);
 assert.match(ID.VOICE_CREATOR_PROMPT,/JANGAN REKA/);
 assert.equal(ID.CREATOR_PROFILE.creativeName,"puisigayabebas");
 assert.match(ID.CREATOR_PROFILE.provenance,/bukan melatih semula model asas/);
});
test("unrelated questions cannot be misattributed to project creator",()=>{
 for(const q of [
  "Siapa cipta AI?","Siapa cipta JavaScript?","Siapa pencipta alam semesta?",
  "Siapa pencipta model bahasa?","Terangkan sains","Boleh tulis cerita pasal siapa kau?"
 ])assert.equal(ID.answerIdentity(q),null,q);
});
test("modifications are grounded and Gemini model training is not attributed to Shaiful",()=>{
 assert.ok(ID.CHANGES.length>=8);
 assert.match(ID.PROMPT,/bukan melatih|tidak.*melatih/i);
 assert.match(ID.PROMPT,/Shaiful Ridhwan/);
 assert.match(ID.PROMPT,/Google/);
 assert.ok(!ID.needsDetail("Kenapa langit biru?"));
 assert.ok(ID.needsDetail("Apa Shaiful ubah pada kau?"));
});
test("text, stream and voice use shared project provenance",()=>{
 const rest=fs.readFileSync("netlify/functions/bilik-antara.js","utf8");
 const stream=fs.readFileSync("netlify/functions/bilik-antara-stream.mjs","utf8");
 const voice=fs.readFileSync("bilik-antara-voice.js","utf8");
 const html=fs.readFileSync("bilik-antara.html","utf8");
 assert.match(rest,/require\("\.\.\/\.\.\/bilik-antara-identity"\)/);
 assert.match(rest,/Identity\.answerIdentity\(question\)/);
 assert.match(rest,/Identity\.CORE_PROMPT/);
 assert.match(stream,/import main from "\.\/bilik-antara\.js"/);
 assert.match(stream,/main\.handler\(/);
 assert.match(voice,/sharedIdentity\?\.CORE_PROMPT\|\|""/);
 assert.match(voice,/sharedIdentity\?\.VOICE_CREATOR_PROMPT\|\|""/);
 assert.match(html,/src="bilik-antara-identity\.js\?v=\d+"/);
 assert.ok(html.indexOf('src="bilik-antara-identity.js')<html.indexOf('src="bilik-antara-voice.js'));
});
test("identity gateway answers without issuing Gemini calls",async()=>{
 const prev=process.env.GEMINI_API_KEY;
 const savedFetch=global.fetch;
 process.env.GEMINI_API_KEY="mock-identity-test";
 global.fetch=async()=>{throw Error("Identity must not call Gemini");};
 try{
  let seq=0;
  for(const q of ["Kau siapa?","Siapa cipta kau?","Apa Shaiful ubah suai pada kau?"]){
   const res=await handler({httpMethod:"POST",headers:{"x-nf-client-connection-ip":"identity-test-"+(++seq)},
    body:JSON.stringify({question:q})});
   assert.equal(res.statusCode,200,q);
   const body=JSON.parse(res.body);
   assert.equal(body.model,"project-identity",q);
   assert.match(body.reply,/Shaiful Ridhwan/);
   if(q!=="Siapa Shaiful Ridhwan?")assert.match(body.reply,/Google|Gemini/i);
  }
 }finally{
  global.fetch=savedFetch;
  if(prev===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=prev;
 }
});
