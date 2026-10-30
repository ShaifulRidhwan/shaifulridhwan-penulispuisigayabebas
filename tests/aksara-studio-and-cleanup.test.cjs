"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const Studio=require("../netlify/functions/aksara-studio-awareness");

test("Studio is informational only and does not automatically navigate",()=>{
 assert.match(Studio.STUDIO_URL,/^https:\/\/shaifulridhwan-penulispuisigayabebas\.netlify\.app\/studio-antara\.html$/);
 assert.match(Studio.SYSTEM_GUIDANCE,/JANGAN berpindah halaman secara automatik/);
 for(const q of ["jana imej","generate gambar","generste gambar","create image of a cat","lukis gambar kucing","buatkan gambar langit"]){
  const reply=Studio.localReply(q);
  assert.equal(reply?.studioHint,true,q);
  assert.match(reply.reply,/Studio Antara/,q);
  assert.doesNotMatch(reply.reply,/telah menjana|sudah menjana/,q);
 }
});

test("Image references without a creation request remain ordinary conversation",()=>{
 for(const q of ["jangan jana gambar","terangkan cara generate gambar","apa itu jana imej","tulis puisi tentang jana imej","aku ada mesej haritu: generate gambar"]){
  assert.equal(Studio.localReply(q),null,q);
 }
 assert.equal(Studio.localReply("generate gambar gunung",{hasAttachment:true}),null);
});

test("Shared identity informs CAHAYA, GELAP and voice about Studio",()=>{
 const Identity=require("../bilik-antara-identity");
 assert.match(Identity.RUNTIME_PROMPT,/studio-antara\.html/i);
 assert.match(Identity.CORE_PROMPT,/studio-antara\.html/i);
 assert.match(Identity.VOICE_CORE_PROMPT,/studio-antara\.html/i);
 const backend=fs.readFileSync("netlify/functions/bilik-antara.js","utf8");
 const ui=fs.readFileSync("bilik-antara.html","utf8");
 assert.match(backend,/Studio\.localReply\(question/);
 assert.match(backend,/studioHint:true/);
 assert.match(ui,/data\?\.studioHint===true/);
 assert.match(ui,/Buka Studio Antara/);
 assert.match(ui,/data\.model==="local-studio"/);
});

test("Only Groq, OpenRouter and OrcaRouter are retained as text fallback providers",()=>{
 const router=require("../netlify/functions/aksara-provider-router");
 const registry=require("../netlify/functions/aksara-model-registry");
 assert.ok(!fs.existsSync("netlify/functions/aksara-requesty.js"));
 const src=fs.readFileSync("netlify/functions/aksara-provider-router.js","utf8");
 const identity=fs.readFileSync("bilik-antara-identity.js","utf8");
 const ui=fs.readFileSync("bilik-antara.html","utf8");
 for(const [name,code] of [["router",src],["identity",identity],["UI",ui]]){
  assert.doesNotMatch(code,/requesty/i,name+" must not include old provider");
 }
 assert.deepEqual(Object.keys(registry.CAPS),["groq","openrouter","orcarouter"]);
 assert.match(src,/model:"openrouter\/free"/);
 assert.match(src,/model:"orcarouter\/free"/);
 assert.ok(typeof router.complete==="function");
});
