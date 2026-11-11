"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const Context=require("../netlify/functions/aksara-context-manager");
const Retrieval=require("../netlify/functions/aksara-context-retrieval-v7");
const Circuit=require("../netlify/functions/aksara-circuit-breaker-v7");
const Evidence=require("../netlify/functions/aksara-evidence-audit");
const Gate=require("../scripts/aksara-p0-p3-performance-gate.cjs");

test("P0 matches an earlier Bluetooth headset issue to a microphone question",()=>{
 const x=Retrieval.relevance("Masalah mikrofon masa voice","Headset Bluetooth tak mengeluarkan audio");
 assert.ok(x.semantic>=1);
 assert.equal(x.method,"deterministic_synonym_bridge_not_embedding");
 const rows=[{role:"user",content:"Headset Bluetooth tak mengeluarkan audio"},
  {role:"assistant",content:"Semak sambungan peranti."}];
 for(let i=0;i<15;i++)rows.push({role:i%2?"assistant":"user",content:"Contoh sejarah rawak "+i});
 const selected=Context.selectHistory(rows,"mikrofon masih tak berfungsi",{keepRecent:3,maxChars:1600});
 assert.ok(selected.some(x=>x.content.includes("Headset Bluetooth")));
 assert.ok(selected.some(x=>x.content.includes("Semak sambungan")));
});
test("P0 respects 24-history-row cap, character budget and chronological order",()=>{
 const rows=Array.from({length:70},(_,i)=>({role:i%2?"assistant":"user",
  content:"Kekalkan audio suara dan pembetulan "+i}));
 const chosen=Context.selectHistory(rows,"audio suara",{keepRecent:30,maxChars:800});
 assert.ok(chosen.length<=24);
 assert.ok(chosen.reduce((n,x)=>n+x.content.length,0)<=800);
 const indices=chosen.map(x=>rows.indexOf(x));
 assert.deepEqual(indices,[...indices].sort((a,b)=>a-b));
});
test("P0 unrelated topics do not create fake semantic matches",()=>{
 assert.equal(Retrieval.relevance("cuaca dan hujan","puisi cinta dan rindu").semantic,0);
});
test("P1 transient failure circuit opens after repeated failures and resets",()=>{
 Circuit.success("groq");
 const t=1000000;
 assert.equal(Circuit.failure("groq",{status:503,now:t}).retryMs,0);
 assert.equal(Circuit.failure("groq",{status:503,now:t+1000}).retryMs,15000);
 assert.equal(Circuit.canAttempt("groq",t+1500),false);
 assert.equal(Circuit.canAttempt("groq",t+16000),true);
 assert.equal(Circuit.failure("groq",{status:502,now:t+17000}).retryMs,30000);
 Circuit.success("groq");
 assert.equal(Circuit.canAttempt("groq",t+20000),true);
 assert.equal(Circuit.diagnostics().some(x=>x.provider==="groq"),false);
});
test("P1 breaker belongs to router instance, not a global test/session singleton",()=>{
 const first=Circuit.create(),second=Circuit.create(),t=1000000;
 first.failure("groq",{status:503,now:t});
 first.failure("groq",{status:503,now:t+1000});
 assert.equal(first.canAttempt("groq",t+1500),false);
 assert.equal(second.canAttempt("groq",t+1500),true);
});
test("P1 auth, invalid model and quota errors never turn into extra retries",()=>{
 for(const status of [401,403,404,429]){
  assert.equal(Circuit.failure("openrouter",{status}).retryMs,0);
 }
 assert.equal(Circuit.diagnostics().some(x=>x.provider==="openrouter"),false);
});
test("P3 evidence links never masquerade as page reading or fact verification",()=>{
 const x=Evidence.summarize({sources:[{url:"https://example.org"}],toolsUsed:[]});
 assert.equal(x.level,"links_only");
 assert.equal(x.claimAccuracyVerified,false);
 const y=Evidence.summarize({sources:[{url:"https://example.org"}],
  toolsUsed:["url_context"],urlTrace:{status:"failed"}});
 assert.notEqual(y.level,"page_text");
});
function sample(commit,overrides={}){
 return {source:"androidx.benchmark.macro",device:{model:"Physical test phone",sdk:35},
  variant:"benchmark",iterations:10,capturedAt:"2026-11-11T10:00:00Z",commit,
  coldStartMsP50:400,frameTimeMsP95:17,jankPercent:3,...overrides};
}
test("P2 comparison gate reports absent data, mismatched devices and invalid metadata",()=>{
 assert.equal(Gate.main([]),0);
 assert.equal(Gate.main(["--require-device"]),2);
 const base=sample("1234567"),candidate=sample("abcdef0");
 assert.equal(Gate.evaluate(base,{...candidate,device:{model:"Different phone",sdk:35}}).status,"INVALID");
 assert.equal(Gate.evaluate(base,base).status,"INVALID");
});
test("P2 synthetic fixture checks the gate, not a claimed device speedup",()=>{
 const base=sample("1234567"),next=sample("abcdef0");
 assert.equal(Gate.evaluate(base,next).status,"PASS");
 assert.equal(Gate.evaluate(base,{...next,frameTimeMsP95:25}).status,"REGRESSION");
 assert.equal(Gate.evaluate(base,{...next,iterations:0}).status,"INVALID");
});
