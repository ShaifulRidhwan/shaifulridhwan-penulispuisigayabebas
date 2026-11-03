"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const engine=require("../bilik-antara-multi-ai-status.js");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const element=()=>({className:"",dataset:{},textContent:"",title:"",hidden:false,attrs:{},
 setAttribute(name,value){this.attrs[name]=value;}});
function fixture(){
 const nodes={pill:element(),label:element(),activity:element(),activityText:element(),
  retry:element(),stamp:element(),requestNote:element()};
 const api=engine.create(nodes);
 return {...nodes,api};
}
test("provider Connected requires recent real evidence, not Ready or an expired probe",()=>{
 const now=Date.now();
 assert.equal(engine.summarize([{status:"ready"}],now,now).state,"ready");
 assert.equal(engine.summarize([{status:"online"}],now,now).state,"connected");
 assert.equal(engine.summarize([{status:"online"}],now-130000,now).state,"stale");
 assert.equal(engine.summarize([{status:"unverified"}],now,now).state,"unverified");
 assert.equal(engine.summarize([{status:"off"}],now,now).state,"disabled");
 assert.equal(engine.summarize([{status:"offline"}],now,now).state,"offline");
});
test("a request never changes the provider pill or its verification class",()=>{
 const f=fixture();
 f.api.update({checkedAt:Date.now(),providers:[
  {id:"gemini",status:"online"},
  {id:"groq",status:"ready"},
  {id:"openrouter",status:"off"},
  {id:"workers_ai",status:"offline"}
 ]});
 assert.equal(f.label.textContent,"Multi A.I Connected");
 assert.equal(f.pill.dataset.healthState,"connected");
 f.api.request("connecting","Waiting for Capacity","Retry in 5s");
 assert.equal(f.label.textContent,"Multi A.I Connected");
 assert.equal(f.pill.dataset.healthState,"connected");
 assert.match(f.activityText.textContent,/Waiting for Capacity/);
 assert.match(f.requestNote.textContent,/Request Activity/);
 f.api.request("error","Request Failed","HTTP 503");
 assert.equal(f.label.textContent,"Multi A.I Connected");
 assert.equal(f.retry.hidden,false);
 f.api.request("online","Request Completed","");
 assert.equal(f.activity.className,"connection-info");
 assert.equal(f.requestNote.hidden,true);
 assert.equal(f.label.textContent,"Multi A.I Connected");
});
test("health failures never invent mass provider outages",()=>{
 const f=fixture();
 f.api.update({checkedAt:Date.now(),providers:[
  {id:"gemini",status:"online"},{id:"groq",status:"ready"}
 ]});
 f.api.failure();
 assert.equal(f.label.textContent,"Multi A.I Unverified");
 assert.equal(f.pill.dataset.healthState,"unverified");
 assert.ok(f.api.getRows().every(p=>p.status!=="offline"));
 assert.equal(f.activity.dataset.requestState,undefined);
});
test("real chat success can verify only the responding provider",()=>{
 const f=fixture();
 f.api.reply("groq","openai/gpt-oss-120b");
 assert.equal(f.label.textContent,"Multi A.I Connected");
 assert.deepEqual(f.api.getRows().filter(p=>p.status==="online").map(p=>p.id),["groq"]);
 f.api.reply("not-real","foo");
 assert.deepEqual(f.api.getRows().filter(p=>p.status==="online").map(p=>p.id),["groq"]);
 f.api.update({checkedAt:Date.now()-150000,providers:[{id:"gemini",status:"online"}]});
 assert.equal(f.api.getRows().find(p=>p.id==="gemini").status,"unverified");
 assert.equal(f.api.getRows().find(p=>p.id==="groq").status,"online");
 f.api.update({checkedAt:Date.now(),providers:[{id:"groq",status:"offline"}]});
 assert.equal(f.api.getRows().find(p=>p.id==="groq").status,"offline");
});
test("English-only compact UI, old Gemini pool and routing remain intact",()=>{
 const html=read("bilik-antara.html"),gemini=read("bilik-antara-gemini-status.js");
 const lib=read("bilik-antara-multi-ai-status.js"),router=read("netlify/functions/aksara-provider-router.js");
 assert.match(html,/id="connectionText">Multi A\.I Checking/);
 assert.match(html,/Multi A\.I · Provider Health/);
 assert.match(html,/id="multiAiCheckedAt"/);
 assert.match(html,/id="multiAiRequestActivity"/);
 assert.match(html,/bilik-antara-multi-ai-status\.js\?v=3/);
 assert.match(html,/bilik-antara-multi-ai-status\.css\?v=1/);
 assert.match(html,/multiHealth\.reply\(data\.provider,data\.model\)/);
 assert.doesNotMatch(html,/ba:voice-connected/);
 assert.doesNotMatch(html,/status\("connecting","Model tengah busy/);
 assert.ok(gemini.includes("for(let slot=1;slot<=4;slot++)"));
 assert.ok(gemini.includes('mode==="unverified"?"Unverified"'));
 assert.ok(lib.includes("REPLY_TTL=90000"));
 assert.match(router,/async function checkStatus/);
 assert.match(router,/function reflectCooldown/);
 assert.ok(html.length<80000,"Keep the primary HTML below 80 KB");
});

test("failed health probes show a reason without claiming every AI is offline",()=>{
 const f=fixture();
 f.api.failure({http:429,retryAfterSeconds:37});
 assert.equal(f.pill.dataset.healthState,"unverified");
 assert.match(f.stamp.textContent,/HTTP 429 · Retry in 37s/);
 assert.deepEqual(f.api.getRows().filter(p=>p.status==="offline"),[]);
 assert.equal(engine.formatHealthError({timeout:true}),"Timeout");
 assert.equal(engine.formatHealthError({http:503}),"HTTP 503");
 assert.equal(engine.formatHealthError({http:404}),"HTTP 404 · Endpoint unavailable");
});

test("server clock skew never makes the provider health time Unknown",()=>{
 const f=fixture();
 f.api.update({checkedAt:Date.now()+18000,providers:[{id:"groq",status:"online"}]});
 assert.match(f.stamp.textContent,/Last checked: just now/);
 assert.doesNotMatch(f.stamp.textContent,/Unknown/);
 assert.equal(f.pill.dataset.healthState,"connected");
});
