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
