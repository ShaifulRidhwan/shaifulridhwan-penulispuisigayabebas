"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const Journey=require("../bilik-antara-journey");
const Identity=require("../bilik-antara-identity");

test("Twenty creator journey topics are unique, ordered and stay in Aksara POV",()=>{
 assert.equal(Journey.steps.length,20);
 assert.equal(new Set(Journey.steps.map(s=>s.question.toLowerCase())).size,20);
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
 assert.deepEqual(Journey.nextFor("Siapa Aku"),{question:"The Coder Poet",position:2,total:20});
 assert.deepEqual(Journey.nextFor("The Coder Poet"),{question:"Apa Target Shaiful?",position:3,total:20});
 assert.equal(Journey.nextFor(Journey.steps[19].question),null);
 assert.equal(Journey.nextFor("Tolong debug code aku"),null);
 assert.equal(Journey.answer("Tolong debug code aku"),null);
 assert.match(Journey.answer("Apa Target Shaiful?"),/Aku nampak target Shaiful/);
});
test("Journey UI preserves session history and does not change protected identity",()=>{
 const html=fs.readFileSync("bilik-antara.html","utf8");
 const suite=fs.readFileSync("bilik-antara-suite.js","utf8");
 assert.match(html,/bilik-antara-journey\.js/);
 assert.match(html,/journeyNext/);
 assert.match(suite,/Sesi & Sejarah/);
 assert.doesNotMatch(suite,/Buka Bilik Antara Cloudflare/);
 assert.match(suite,/function renderStorageStatus\(\)/);
 assert.match(suite,/function renderMetrics\(\)/);
 assert.match(suite,/function renderMemory\(\)/);
 assert.doesNotMatch(suite,/renderSessions\(\);section\("Memori pilihan"\)/);
});
