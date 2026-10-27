"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const ID=require("../bilik-antara-identity");
const {handler}=require("../netlify/functions/bilik-antara");

test("AI name, Bilik Antara room and Google Gemini remain distinct",()=>{
 assert.equal(ID.NAME,"Shaiful Ridhwan A.I.");
 assert.equal(ID.ROOM,"Bilik Antara");
 assert.equal(ID.CREATOR,"Shaiful Ridhwan");
 assert.equal(ID.BASE,"Google Gemini");
 assert.match(ID.INTRO,/Aku Shaiful Ridhwan A\.I/);
 assert.match(ID.INTRO,/Bilik Antara/);
 assert.match(ID.INTRO,/Google/);
 assert.doesNotMatch(ID.INTRO,/Aku Bilik Antara/);
});
test("identity responses cover creator, modifications and model provenance",()=>{
 const cases=[
  ["kau siapa?","Shaiful Ridhwan A.I."],
  ["siapa kau sebenarnya?","Shaiful Ridhwan A.I."],
  ["Siapa cipta kau?","Shaiful Ridhwan"],
  ["siapa pencipta Bilik Antara","Shaiful Ridhwan"],
  ["Siapa Shaiful Ridhwan?","penulis puisi"],
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
test("Siapa Aku answers project origin, enhancements and base-model provenance",()=>{
 const reply=ID.answerIdentity("Siapa Aku");
 assert.match(reply,/Shaiful Ridhwan A\.I\./);
 assert.match(reply,/dibina dan terus diubah suai oleh Shaiful Ridhwan/);
 assert.match(reply,/keupayaan setinggi mungkin/);
 assert.match(reply,/Google Gemini/);
 assert.doesNotMatch(reply,/sudah mencapai kecerdasan tertinggi di dunia/);
 assert.equal(ID.answerIdentity("siapa aku?"),reply);
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
 assert.match(stream,/import Identity from "\.\.\/\.\.\/bilik-antara-identity\.js"/);
 assert.match(stream,/Identity\.answerIdentity\(question\)/);
 assert.match(voice,/window\.BilikAntaraIdentity\?\.PROMPT/);
 assert.match(html,/src="bilik-antara-identity\.js\?v=2"/);
 assert.ok(html.indexOf('src="bilik-antara-identity.js')<html.indexOf('src="bilik-antara-voice.js'));
});
test("identity gateway answers without issuing Gemini calls",async()=>{
 const prev=process.env.GEMINI_API_KEY;
 const savedFetch=global.fetch;
 process.env.GEMINI_API_KEY="mock-identity-test";
 global.fetch=async()=>{throw Error("Identity must not call Gemini");};
 try{
  let seq=0;
  for(const q of ["Kau siapa?","Siapa cipta kau?","Apa Shaiful ubah suai pada kau?","Siapa Shaiful Ridhwan?"]){
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
