"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Modes=require("../bilik-antara-modes");

test("GELAP explicitly resists pressure without new evidence",()=>{
 const prompt=Modes.instructions("gelap","critique",false);
 assert.match(prompt,/ANTI-SYCOPHANCY GELAP/);
 assert.match(prompt,/tanpa bukti atau alasan baharu/);
 assert.match(prompt,/KONSISTENSI DAN PEMBETULAN GELAP/);
 assert.match(prompt,/Jangan membantah semata-mata/);
});
test("CAHAYA does not inherit GELAP anti-sycophancy policy",()=>{
 assert.equal(Modes.instructions("cahaya","critique",false),"");
});
test("GELAP review checks both false agreement and contrarianism",()=>{
 const review=Modes.reviewGuidance("gelap");
 assert.match(review,/mengalah kepada tekanan pengguna/);
 assert.match(review,/membantah fakta yang sudah kukuh/);
 assert.equal(Modes.reviewGuidance("cahaya"),"");
});

const fs=require("node:fs");
const path=require("node:path");
test("GELAP policy reaches primary and fallback through shared system",()=>{
 const backend=fs.readFileSync(path.join(__dirname,"../netlify/functions/bilik-antara.js"),"utf8");
 const router=fs.readFileSync(path.join(__dirname,"../netlify/functions/aksara-provider-router.js"),"utf8");
 assert.match(backend,/Modes\.instructions\(thoughtMode,intent\.task,false\)/);
 assert.match(backend,/Router\.complete\(\{cloudflareAI,system,/);
 assert.match(router,/safeMessage\(system\)/);
});
test("Cloudflare chat and stream use shared Bilik Antara backend",()=>{
 const worker=fs.readFileSync(path.join(__dirname,"../cloudflare/src/index.mjs"),"utf8");
 const stream=fs.readFileSync(path.join(__dirname,"../netlify/functions/bilik-antara-stream.mjs"),"utf8");
 assert.match(worker,/import Chat from "\.\.\/\.\.\/netlify\/functions\/bilik-antara\.js"/);
 assert.match(worker,/import netlifyStream from "\.\.\/\.\.\/netlify\/functions\/bilik-antara-stream\.mjs"/);
 assert.match(stream,/bilik-antara\.js/);
});
test("Voice fallback includes GELAP instructions",()=>{
 const backend=fs.readFileSync(path.join(__dirname,"../netlify/functions/bilik-antara.js"),"utf8");
 assert.match(backend,/Modes\.instructions\(thoughtMode,"voice",true\)/);
});
