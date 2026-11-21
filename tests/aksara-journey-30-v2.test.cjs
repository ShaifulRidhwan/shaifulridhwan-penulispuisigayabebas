"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const Journey=require("../bilik-antara-journey");
const Identity=require("../bilik-antara-identity");

const chapterNames=[
 "Siapa Aku?","The Coder Poet","Apa Target Shaiful?","Macam Mana Shaiful Mula Coding?",
 "Apa Cerita Twister Kernel?","Kenapa Dia Beralih ke Puisi?","Apa Itu Aksara Moden?",
 "Macam Mana Dia Menulis Puisi?","Kenapa Dia Suka Falsafah?","Macam Mana Cara Dia Berfikir?",
 "Kenapa Dia Bina Bilik Antara?","Aku Ni Dibina Macam Mana?","Empat Otak Aku Buat Apa?",
 "Hybrid Router Tu Jalan Macam Mana?","Apa Beza Mod Cahaya dan Gelap?",
 "Code Engine Aku Boleh Buat Apa?","Kenapa SQLite WASM?","Studio Antara Guna Apa?",
 "Apa Cabaran Bina Projek Ni?","Apa Next Untuk Dunia Aksara?",
 "Kenapa Shaiful Tambah Terminal?","Apa Beza Terminal Dengan Code Engine?",
 "Shaiful Optimize Bilik Antara Macam Mana?","Kenapa Dia Cerewet Pasal UI?",
 "Apa Lagi Yang Perlu Dibaiki Pada Connection?","Kenapa Aksara Kena Ada Rujukan Web?",
 "Kenapa Sesi Dan Memori Tak Boleh Main-main?","Pernah Tak Aksara Bantah Shaiful?",
 "Apa Kesimpulan Aku Tentang Shaiful?","Apa Pesanan Terakhir Aksara Untuk Shaiful?"
];

test("v2 retains exactly 30 stable question keys, index and next order for saved sessions",()=>{
 assert.deepEqual(Journey.steps.map(x=>x.question),chapterNames);
 assert.equal(Journey.steps.length,30);
 for(let i=0;i<chapterNames.length;i++){
  const r=Journey.resolve(chapterNames[i],Identity,"journey-button");
  assert.ok(r,"Missing local reply for "+chapterNames[i]);
  assert.equal(r.index,i);
  assert.equal(r.provider,"local");
  assert.equal(r.model,i<2?"project-identity":"project-journey");
  assert.equal(r.next?.question||null,chapterNames[i+1]||null);
  assert.ok(r.reply.length>200);
  assert.doesNotMatch(r.reply,/\\[nr]/,"Reply contains literal escape sequence");
 }
});

test("the official first two identity answers remain canonical, with journey-only context",()=>{
 const first=Journey.resolve("Siapa Aku?",Identity,"journey-button").reply;
 const second=Journey.resolve("The Coder Poet",Identity,"journey-button").reply;
 assert.ok(first.startsWith(Identity.WHO_AM_I));
 assert.ok(second.startsWith(Identity.CODER_POET_ANSWER));
 assert.match(first,/Android/);
 assert.match(second,/Aksara Linux/);
 assert.equal(Journey.answer("Siapa Aku?"),null);
 assert.equal(Journey.answer("The Coder Poet"),null);
});

test("the refreshed chapters distinguish actual runtime from claims or roadmap",()=>{
 const combined=Journey.steps.slice(2).map(x=>x.answer).join("\n");
 for(const [q,pattern]of [
  ["Empat Otak Aku Buat Apa?",/Configured|Connected/i],
  ["Hybrid Router Tu Jalan Macam Mana?",/fallback/i],
  ["Code Engine Aku Boleh Buat Apa?",/web.*Android/is],
  ["Kenapa Shaiful Tambah Terminal?",/Alpine Linux rootless/],
  ["Apa Beza Terminal Dengan Code Engine?",/Code Engine.*web.*Aksara Linux.*Android/is],
  ["Apa Lagi Yang Perlu Dibaiki Pada Connection?",/Netlify/],
  ["Kenapa Sesi Dan Memori Tak Boleh Main-main?",/OFF secara default/],
  ["Apa Pesanan Terakhir Aksara Untuk Shaiful?",/Tamat · Kenali Shaiful/],
 ]){
  assert.match(Journey.answer(q),pattern,q);
  if(q==="Apa Pesanan Terakhir Aksara Untuk Shaiful?")assert.ok(Journey.answer(q).includes("(30/30)"));
 }
 assert.match(Journey.answer("Hybrid Router Tu Jalan Macam Mana?"),/konteks/i);
 assert.match(combined,/regression test/i);
 assert.doesNotMatch(combined,/semua provider.*online|akses root automatik/i);
});

test("typed questions never silently enter the local 30-part story",()=>{
 for(const q of chapterNames){
  assert.equal(Journey.resolve(q,Identity),null);
  assert.equal(Journey.resolve(q,Identity,"typed"),null);
 }
 assert.equal(Journey.resolve("Apa maksud kernel?",Identity,"journey-button"),null);
 assert.equal(Journey.nextFor(chapterNames.at(-1)),null);
});
