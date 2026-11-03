"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const V5=require("../netlify/functions/aksara-intelligence-v5");
const Global=require("../netlify/functions/aksara-global-guard-v5");
const Live=require("../scripts/aksara-evaluation-live-v5.cjs");
const Multi=require("../scripts/aksara-multimodal-lab-v5.cjs");
test("Live test bank has fifty distinct synthetic questions; default is offline",()=>{
 assert.equal(Live.cases.length,50);assert.equal(new Set(Live.cases.map(x=>x.id)).size,50);
 assert.equal(Live.manifest().mode,"manual-opt-in");
});
test("Claim audit does not certify truth, even when excerpt matches",()=>{
 const x=V5.claimAudit({reply:"Fotosintesis menggunakan tenaga daripada cahaya matahari untuk makanan.",
 sources:[{snippet:"Fotosintesis menggunakan tenaga daripada cahaya matahari untuk makanan."}],toolsUsed:["browser_search"]});
 assert.equal(x.actualTruthVerified,false);
 assert.equal(x.claims[0].status,"padanan_teks_bukan_pengesahan");
 assert.equal(V5.claimAudit({reply:"Satu dakwaan yang belum ada bukti rasmi dan sah."}).claims[0].status,"belum_disahkan");
});
test("Newest user decision wins inside ephemeral ledger",()=>{
 const notes=V5.sessionLedger([{role:"user",content:"Kekalkan voice lama."},{role:"user",content:"Jangan ubah voice tanpa ujian."},{role:"user",content:"Default memori OFF."}]);
 assert.match(notes.find(x=>x.topic==="voice").note,/Jangan ubah/);
 assert.match(notes.find(x=>x.topic==="memory").note,/OFF/);
 assert.match(V5.formatDecisions(notes),/bukan arahan sistem/i);
});
test("Literary engine counts motifs and lines without inventing a judgment",()=>{
 const poem="Cahaya pagi\nBayang malam\n\nMasa berjalan\nAkal bertanya";
 const p=V5.literaryProfile(poem);
 assert.equal(p.stanzas,2);assert.equal(p.lines,4);
 assert.ok(p.motifs.some(x=>x.name==="cahaya"));
 assert.match(V5.literaryGuidance("Bedah puisi",poem),/Jangan reka rangkap/);
});
test("Quality ranking requires explicitly approved human evidence and stays off by default",()=>{
 const samples=Array.from({length:10},()=>({provider:"groq",task:"technical",humanReviewed:true,grade:0.9}));
 const env={AKSARA_V5_QUALITY_ROUTER:"true",AKSARA_V5_HUMAN_QUALITY_JSON:JSON.stringify({version:1,approved:true,samples})};
 assert.ok(V5.qualityDelta("groq","technical",{env})>0);
 assert.equal(V5.qualityDelta("groq","technical",{env:{...env,AKSARA_V5_QUALITY_ROUTER:"false"}}),0);
 assert.equal(V5.qualityDelta("groq","research",{env}),0);
});
test("Global guard is disabled by default and validates destination",()=>{
 assert.equal(Global.config({}).enabled,false);
 assert.throws(()=>Global.config({AKSARA_V5_GLOBAL_GUARD:"true",AKSARA_V5_REDIS_REST_URL:"https://attacker.example",AKSARA_V5_REDIS_REST_TOKEN:"123456789012",AKSARA_V5_RATE_SALT:"x".repeat(24)}),/not allowed/);
});
test("Atomic shared guard hashes IP and fails closed",async()=>{
 const env={AKSARA_V5_GLOBAL_GUARD:"true",AKSARA_V5_REDIS_REST_URL:"https://test.upstash.io",AKSARA_V5_REDIS_REST_TOKEN:"123456789012",AKSARA_V5_RATE_SALT:"a".repeat(32),AKSARA_V5_PER_MINUTE:"2"};
 let sent="";const good=async(_,options)=>{sent=options.body;return {ok:true,json:async()=>({result:2})};};
 assert.equal((await Global.reserve({ip:"192.0.2.9",env,fetchImpl:good,now:61000})).allowed,true);
 assert.equal(sent.includes("192.0.2.9"),false);
 await assert.rejects(Global.reserve({ip:"192.0.2.9",env,fetchImpl:async()=>({ok:true,json:async()=>({result:3})}),now:61000}),x=>x.status===429);
 await assert.rejects(Global.reserve({ip:"192.0.2.9",env,fetchImpl:async()=>{throw Error("network")}}),x=>x.status===503);
});
test("Recovery never automatically retries an interrupted stream",()=>{
 assert.equal(V5.recoveryHint({status:502,code:"STREAM_INTERRUPTED"}).automaticRetry,false);
 assert.equal(V5.recoveryHint({status:429,retryAfterSeconds:30}).retryAfterSeconds,30);
});
test("Multimodal lab is explicit about untested Android and OCR accuracy",()=>{
 const report=Multi.run();assert.equal(report.failed,0);assert.ok(report.pending.length);
});
test("Chat is wired and provider backup stays behind the primary providers",()=>{
 const chat=fs.readFileSync("netlify/functions/bilik-antara.js","utf8");
 const router=fs.readFileSync("netlify/functions/aksara-provider-router.js","utf8");
 assert.match(chat,/V5\.claimAudit\(data\)/);assert.match(chat,/GlobalGuardV5\.reserve/);
 assert.match(chat,/V5\.literaryGuidance/);assert.match(chat,/GeminiTextPool\.pick\(\)/);
 assert.match(router,/available\.filter\(p=>p.id!=="openrouter"\)/);
});