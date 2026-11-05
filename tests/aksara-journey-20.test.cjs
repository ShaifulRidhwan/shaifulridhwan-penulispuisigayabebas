"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const Journey=require("../bilik-antara-journey");
const Identity=require("../bilik-antara-identity");

test("Thirty creator journey topics are unique, ordered and stay in Aksara POV",()=>{
 assert.equal(Journey.steps.length,30);
 assert.equal(new Set(Journey.steps.map(s=>s.question.toLowerCase())).size,30);
 assert.equal(Journey.steps[0].question,"Siapa Aku?");
 assert.equal(Journey.steps[1].question,"The Coder Poet");
 assert.equal(Journey.steps[2].question,"Apa Target Shaiful?");
 for(const step of Journey.steps.slice(2)){
  assert.match(step.answer,/\bAku\b|\baku\b/);
  assert.match(step.answer,/Shaiful|dia|Bilik Antara|aku/i);
  assert.ok(step.answer.length>200);
 }
 assert.equal(Journey.answer("Siapa Aku?"),null);
 assert.equal(Journey.answer("The Coder Poet"),null);
 assert.equal(Identity.answerIdentity("Siapa Aku"),Identity.WHO_AM_I);
 assert.equal(Identity.answerIdentity("The Coder Poet"),Identity.CODER_POET_ANSWER);
});
test("Journey supports sequential follow-ups but never hijacks normal chat",()=>{
 assert.deepEqual(Journey.nextFor("Siapa Aku"),{question:"The Coder Poet",position:2,total:30});
 assert.deepEqual(Journey.nextFor("The Coder Poet"),{question:"Apa Target Shaiful?",position:3,total:30});
 assert.equal(Journey.nextFor(Journey.steps[29].question),null);
 assert.equal(Journey.nextFor("Tolong debug code aku"),null);
 assert.equal(Journey.answer("Tolong debug code aku"),null);
 assert.match(Journey.answer("Apa Target Shaiful?"),/Aku nampak target Shaiful/);
});
test("Journey UI preserves session history and does not change protected identity",()=>{
 const html=fs.readFileSync("bilik-antara.html","utf8");
 const suite=fs.readFileSync("bilik-antara-suite.js","utf8");
 assert.match(html,/bilik-antara-journey\.js/);
 assert.match(html,/journeyNext/);
 assert.match(html,/window\.AksaraJourney\?\.answer\(payload\.question\)/);
 assert.match(suite,/Sesi & Sejarah/);
 assert.doesNotMatch(suite,/Buka Bilik Antara Cloudflare/);
 assert.match(suite,/function renderStorageStatus\(\)/);
 assert.match(suite,/function renderMetrics\(\)/);
 assert.match(suite,/function renderMemory\(\)/);
 assert.doesNotMatch(suite,/renderSessions\(\);section\("Memori pilihan"\)/);
});


test("Journey 20->21 resumes from stored sessions and ends with summary and penutup",()=>{
 const next=Journey.nextFor("Apa Next Untuk Dunia Aksara?");
 assert.deepEqual(next,{question:"Kenapa Shaiful Tambah Terminal?",position:21,total:30});
 assert.deepEqual(Journey.nextFor("Apa Kesimpulan Aku Tentang Shaiful?"),{question:"Apa Pesanan Terakhir Aksara Untuk Shaiful?",position:30,total:30});
 assert.equal(Journey.nextFor("Apa Pesanan Terakhir Aksara Untuk Shaiful?"),null);
 assert.match(Journey.answer("Kenapa Shaiful Tambah Terminal?"),/Terminal/);
 assert.match(Journey.answer("Shaiful Optimize Bilik Antara Macam Mana?"),/render|prestasi|performance/i);
 assert.match(Journey.answer("Pernah Tak Aksara Bantah Shaiful?"),/bantah|CI|bukti/i);
 assert.match(Journey.answer("Apa Kesimpulan Aku Tentang Shaiful?"),/Kesimpulan aku/i);
 assert.match(Journey.answer("Apa Pesanan Terakhir Aksara Untuk Shaiful?"),/Tamat · Kenali Shaiful \(30\/30\)/);
 const html=fs.readFileSync("bilik-antara.html","utf8");
 assert.match(html,/bilik-antara-journey\.js\?v=2/);
 assert.match(html,/let previousUserQuestion="";/);
 assert.match(html,/window\.addEventListener\("DOMContentLoaded",/);
 assert.match(html,/window\.AksaraJourney\.indexOfQuestion\(m\.content\)/);
 assert.match(html,/currentNext\?\{\.\.\.m,journeyNext:currentNext\}:m/);
});
