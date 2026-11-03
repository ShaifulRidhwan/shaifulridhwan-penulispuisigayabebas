"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const ContextV6=require("../netlify/functions/aksara-context-consistency-v6");
const Efficiency=require("../netlify/functions/aksara-response-efficiency-v6");
const Recovery=require("../netlify/functions/aksara-recovery-v6");
const Telemetry=require("../netlify/functions/aksara-telemetry-v6");
const Quality=require("../netlify/functions/aksara-quality-evidence-v6");
const Sampling=require("../scripts/aksara-balanced-sampling-v6.cjs");
const Literary=require("../scripts/aksara-literary-benchmark-v6.cjs");
const ContextBenchmark=require("../scripts/aksara-context-regression-v6.cjs");
const Profile=require("../scripts/aksara-quality-profile-v6.cjs");
const Ops=require("../scripts/aksara-ops-report-v6.cjs");
const LiveV5=require("../scripts/aksara-evaluation-live-v5.cjs");
const LiveV3=require("../scripts/aksara-thinking-benchmark-v3.cjs");
test("12 multi-turn synthetic cases preserve latest corrections and numbered follow-ups",()=>{
 const x=ContextBenchmark.run();
 assert.equal(x.total,12);assert.equal(x.failed,0,JSON.stringify(x.tests.filter(t=>!t.pass)));
});
test("History-only flags never persist or echo sensitive text",()=>{
 const rows=[{role:"user",content:"RAHSIA-123 kekalkan mode CAHAYA."},{role:"assistant",content:"Baik"}];
 const x=ContextV6.inspect(rows,"yang tadi");
 assert.equal(x.stored,false);assert.equal(x.hasHistory,true);
 const y=ContextV6.guidance(rows,"yang tadi");
 assert.ok(y.includes("KONSISTENSI SESI"));assert.ok(!JSON.stringify(x).includes("RAHSIA-123"));assert.ok(!y.includes("RAHSIA-123"));
 assert.equal(ContextV6.guidance(rows,"aku sedih",{sensitive:true}),"");
});
test("Response efficiency OFF by default, no prompt truncation",()=>{
 const x=Efficiency.decide({system:"AKSARA",history:[],question:"Apa itu DNS?",intent:{task:"explain"},plan:{thinkingLevel:"low"},maxTokens:3000,env:{}});
 assert.equal(x.maxTokens,3000);assert.equal(x.reduced,false);
 assert.equal(x.estimate.approximate,true);
 assert.equal(x.scope,"output_budget_only_no_prompt_truncation");
});
test("Opt-in output cap only for short low-risk questions",()=>{
 const props={system:"P".repeat(1000),history:[],question:"Apa itu DNS?",
  intent:{task:"explain"},plan:{thinkingLevel:"low"},maxTokens:4000,env:{AKSARA_V6_RESPONSE_EFFICIENCY:"true"}};
 assert.equal(Efficiency.decide(props).maxTokens,1800);
 for(const extra of [{hasMedia:true},{hasPrivate:true},{dualPerspective:true},{hasJson:true},{intent:{task:"research",search:true}},{plan:{thinkingLevel:"high"}}])
  assert.equal(Efficiency.decide({...props,...extra}).maxTokens,4000);
});
test("Stream failure recovery never auto retries or splices providers",()=>{
 const x=Recovery.guide({status:502,code:"STREAM_INTERRUPTED"});
 assert.equal(x.automaticRetry,false);assert.equal(x.streamMustNotSplice,true);
 assert.equal(x.preserveInput,true);assert.equal(x.manualOnly,true);
});
test("429 cooling down does not bypass provider quotas",()=>{
 const x=Recovery.guide({status:429,code:"RATE_LIMIT",retryAfterSeconds:42});
 assert.equal(x.kind,"quota_or_rate_limit");
 assert.equal(x.retryAfterSeconds,42);
 assert.match(x.actionText,/kuota/i);
});
test("Telemetry disabled by default, and endpoint is restricted",()=>{
 assert.equal(Telemetry.config({}).enabled,false);
 assert.equal(Telemetry.config({AKSARA_V6_TELEMETRY:"true",AKSARA_V5_REDIS_REST_URL:"https://evil.example",AKSARA_V5_REDIS_REST_TOKEN:"123456789012"}).enabled,false);
 assert.equal(Telemetry.config({AKSARA_V6_TELEMETRY:"true",AKSARA_V5_REDIS_REST_URL:"https://sub.upstash.io",AKSARA_V5_REDIS_REST_TOKEN:"123456789012"}).enabled,true);
});
test("Telemetry emits aggregate metrics only; no reply, prompts, IP, secret or URLs",()=>{
 const raw={statusCode:200,body:JSON.stringify({reply:"SECRET PHRASE",question:"SECRET QUESTION",
  url:"https://private.example",provider:"gemini",mode:"fallback",model:"private-model"})};
 const x=Telemetry.bucket({response:raw,elapsedMs:2400,now:Date.parse("2026-11-03T08:30:00Z")});
 assert.ok(x.key.includes("20261103"));assert.ok(x.fields.includes("provider:gemini"));assert.ok(x.fields.includes("latency:le3s"));
 assert.ok(!JSON.stringify(x).includes("SECRET"));assert.ok(!JSON.stringify(x).includes("private.example"));
 assert.equal(Telemetry.bucket({response:{statusCode:200,body:JSON.stringify({ok:true})}}),null);
});
test("Live aggregate counters via mock Redis, fail open if Redis fails",async()=>{
 const env={AKSARA_V6_TELEMETRY:"true",AKSARA_V5_REDIS_REST_URL:"https://test.upstash.io",
  AKSARA_V5_REDIS_REST_TOKEN:"secret-123456"};
 let payload="";
 const r=await Telemetry.record({response:{statusCode:200,body:JSON.stringify({reply:"Do not record this",provider:"groq",mode:"fallback"})},
  elapsedMs:1800,env,fetchImpl:async(_url,options)=>{payload=options.body;return {ok:true,json:async()=>({result:1})}}});
 assert.equal(r.recorded,true);assert.ok(!payload.includes("Do not record this"));
 const broken=await Telemetry.record({response:{statusCode:502,body:"{}"},env,fetchImpl:async()=>{throw Error("offline")}});
 assert.equal(broken.recorded,false);
});
test("Private report renders approximate latency p50/p95 bins rather than invented exact timings",()=>{
 const x=Ops.decode({result:["request","10","http:2xx","9","latency:le1s","5","latency:le3s","4","latency:gt16s","1"]});
 const report=Ops.render(x);
 assert.equal(report.requests,10);assert.equal(report.latencyP50Band,"le1s");
 assert.equal(report.latencyP95Band,"gt16s");assert.equal(report.percentilesExact,false);
});
test("Manual quality profile requires unique graded live examples and exact model match",()=>{
 const rows=Array.from({length:10},(_,i)=>({id:"case-"+i,provider:"groq",model:"model-a",task:"technical",
  humanReviewed:true,evidenceReviewed:true,grade:0.85}));
 rows.push({...rows[0]});rows.push({...rows[1],id:"case-bad",humanReviewed:false,grade:1});
 const x=Profile.build(rows,{approved:true});
 assert.equal(x.scores.length,1);assert.equal(x.scores[0].n,10);
 assert.equal(x.scores[0].mean,0.85);
 const env={AKSARA_V6_QUALITY_ROUTER:"true",AKSARA_V6_QUALITY_PROFILE_JSON:JSON.stringify(x)};
 assert.ok(Quality.delta("groq","model-a","technical",{env})>0);
 assert.equal(Quality.delta("groq","model-b","technical",{env}),0);
 assert.equal(Quality.delta("groq","model-a","research",{env}),0);
 assert.equal(Quality.delta("groq","model-a","technical",{env:{...env,AKSARA_V6_QUALITY_ROUTER:"false"}}),0);
});
test("Unreviewed or fewer than ten samples cannot alter routing",()=>{
 const rows=Array.from({length:9},(_,i)=>({id:"case-"+i,provider:"workers_ai",model:"cf-model",
  task:"explain",humanReviewed:true,evidenceReviewed:true,grade:1}));
 const x=Quality.compile(rows,{approved:true});
 assert.equal(x.scores.length,0);assert.equal(x.excluded[0].n,9);
 assert.equal(Quality.compile([...rows,{...rows[0],id:"extra",evidenceReviewed:false}],{approved:true}).scores.length,0);
});
test("Small V5 and V3 live sample lists are stratified, not all explanation",()=>{
 const a=Sampling.pick(LiveV5.cases,5),b=Sampling.pick(LiveV3.cases,5);
 assert.equal(new Set(a.map(x=>x.task)).size,5);
 assert.equal(new Set(b.map(x=>x.task)).size,5);
 assert.equal(Sampling.pick(LiveV5.cases,5).map(x=>x.id).join(","),a.map(x=>x.id).join(","));
});
test("Literary benchmark tests structure without asserting artistic accuracy",()=>{
 const x=Literary.offline();assert.equal(x.total,20);
 assert.equal(x.failed,0,JSON.stringify(x.results.filter(r=>!r.pass)));
 assert.equal(x.philosophicalAccuracyVerified,false);
});
test("Routing remains 3+1 and quality changes are opt in",()=>{
 const r=fs.readFileSync("netlify/functions/aksara-model-registry.js","utf8");
 const p=fs.readFileSync("netlify/functions/aksara-provider-router.js","utf8");
 assert.match(r,/AKSARA_V6_QUALITY_ROUTER/);
 assert.match(p,/available\.filter\(p=>p.id!=="openrouter"\)/);
 assert.match(p,/available\.filter\(p=>p.id==="openrouter"\)/);
});
test("Chat integration preserves Gemini Voice Live and privacy defaults",()=>{
 const s=fs.readFileSync("netlify/functions/bilik-antara.js","utf8");
 assert.match(s,/ConsistencyV6\.guidance\(history,question\)/);
 assert.match(s,/EfficiencyV6\.decide/);
 assert.match(s,/RecoveryV6\.guide/);
 assert.match(s,/TelemetryV6\.record/);
 assert.match(s,/GeminiTextPool\.pick\(\)/);
 assert.match(s,/Modes\.instructions\(thoughtMode,"voice",true\)/);
 assert.match(s,/payload\.contextFallback===true\?sessionNotes:""/);
});
