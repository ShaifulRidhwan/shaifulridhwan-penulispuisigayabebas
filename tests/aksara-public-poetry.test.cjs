"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),P=require("../netlify/functions/aksara-public-poetry");
test("34 works support exact title lookups",()=>{
 assert.equal(P.index.length,34);
 for(const p of P.index)assert.equal(P.select("Apa maksud puisi "+p.title).title,p.title);
});
test("generic examples return actual quote and meaning rather than redirect",()=>{
 const x=P.sample("Bagi contoh puisi beserta maksud");
 assert.equal(x.title,"ANTARA TAHU DAN APORIA");
 assert.match(x.answer,/Maksud \/ tafsiran/);
 assert.ok(x.answer.includes(x.excerpt.split("\n")[0]));
 assert.match(x.answer,/Sumber/);
});
test("named examples and new writing stay distinguished",()=>{
 assert.equal(P.sample("Beri contoh puisi WANITA YANG DIAM dan maksud").title,"WANITA YANG DIAM");
 assert.equal(P.sample("Tulis puisi baru"),null);
});
