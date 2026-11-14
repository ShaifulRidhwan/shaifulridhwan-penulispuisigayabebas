"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Policy=require("../netlify/functions/agentic/policy");
const Tools=require("../netlify/functions/agentic/tools");
const Controller=require("../netlify/functions/agentic/controller");
const endpoint=require("../netlify/functions/aksara-agentic");
test("agent disabled by default and has honest runtime status",()=>{
  const s=Controller.status({});
  assert.equal(s.enabled,false);
  assert.equal(s.privacy.githubWrites,false);
  assert.equal(s.privacy.linuxShell,false);
});
test("explicit consent, bounded sizes and modes",()=>{
  assert.throws(()=>Policy.validate({mission:"Buat penyelidikan lengkap",mode:"deep"}),/Kebenaran/);
  assert.equal(Policy.validate({mission:"Buat penyelidikan lengkap",mode:"deep",consent:true}).limits.steps,9);
  assert.throws(()=>Policy.validate({mission:"x".repeat(3001),consent:true}),/antara/);
});
test("never choose unconfirmed paid providers",()=>{
  assert.deepEqual(Policy.providers({GROQ_API_KEY:"abc",GEMINI_API_KEY:"def"}),[]);
  const p=Policy.providers({OPENROUTER_API_KEY:"free",GROQ_API_KEY:"groq",GROQ_FREE_CONFIRMED:"true"});
  assert.equal(p.length,2);
  assert.equal(p.find(x=>x.id==="openrouter").model,"openrouter/free");
});
test("tool registry exposes only bounded read-only tools",()=>{
  const x=Tools.createRegistry({toolCalls:4});
  assert.deepEqual(Object.keys(x.registry).sort(),["calculate","github_read_public","knowledge_search","web_research"]);
  assert.equal(x.registry.github_read_public.description.includes("Read-only"),true);
});
test("invalid public repo paths fail closed",async()=>{
  const x=Tools.createRegistry({toolCalls:1});
  const result=await x.registry.github_read_public.execute({path:"android-native/../../.env"});
  assert.equal(result.ok,false);
  assert.equal(x.trace[0].ok,false);
});
test("disabled backend rejects before any provider call",async()=>{
  await assert.rejects(()=>Controller.execute({mission:"Semak seni bina Aksara",mode:"light",consent:true},{env:{},headers:{}}),/belum diaktifkan/);
});
test("GET health and malformed request work without npm ESM packages",async()=>{
  const status=await endpoint.handler({httpMethod:"GET"});
  assert.equal(JSON.parse(status.body).enabled,false);
  const invalid=await endpoint.handler({httpMethod:"POST",body:"{broken"});
  assert.equal(invalid.statusCode,400);
});

const Owner=require("../netlify/functions/agentic/owner-auth");
const Budget=require("../netlify/functions/agentic/budget");
const OWNER_KEY="AksaraOwnerQA_0123456789abcdefghijklmnopqrstuvwxyz_2026";
test("owner key never ships in client and fails closed if not configured",()=>{
  assert.equal(Owner.configured({}),false);
  assert.equal(Owner.configured({AKSARA_AGENT_OWNER_KEY:"short"}),false);
  const env={AKSARA_AGENT_OWNER_KEY:OWNER_KEY};
  assert.equal(Owner.configured(env),true);
  assert.throws(()=>Owner.authenticate({},env),x=>x.status===401);
  assert.throws(()=>Owner.authenticate({authorization:"Bearer "+OWNER_KEY+"wrong"},env),x=>x.status===401);
  assert.equal(Owner.authenticate({authorization:"Bearer "+OWNER_KEY},env).length,24);
});
test("unauthorized request is rejected before budget or model invocation",async()=>{
  const env={AKSARA_AGENT_ENABLED:"true",AKSARA_AGENT_OWNER_KEY:OWNER_KEY,OPENROUTER_API_KEY:"mock"};
  await assert.rejects(
    ()=>Controller.execute({mission:"Audit keselamatan Android",mode:"light",consent:true},{env,headers:{}}),
    x=>x.status===401 && x.category==="authorization"
  );
});
test("quota persistence is fail-closed, reserves until cap and rejects overspending",async()=>{
  const db=new Map();
  const store={
    async get(key){return db.get(key)||null;},
    async setJSON(key,value){db.set(key,value);}
  };
  const id="a".repeat(24),env={AKSARA_AGENT_DAILY_CAP:"2"};
  assert.equal((await Budget.reserve(id,{env,store,now:Date.UTC(2026,10,13)})).spent,1);
  assert.equal((await Budget.reserve(id,{env,store,now:Date.UTC(2026,10,13)})).spent,2);
  await assert.rejects(()=>Budget.reserve(id,{env,store,now:Date.UTC(2026,10,13)}),x=>x.status===429);
  await assert.rejects(()=>Budget.reserve(id,{env,store:{get:()=>{throw Error("offline")}}}),x=>x.status===503);
});
test("status reveals no credentials",()=>{
  const status=Controller.status({AKSARA_AGENT_ENABLED:"true",AKSARA_AGENT_OWNER_KEY:OWNER_KEY,OPENROUTER_API_KEY:"secret-provider-key"});
  const json=JSON.stringify(status);
  assert.equal(status.ownerAuthRequired,true);
  assert.equal(status.ownerAuthConfigured,true);
  assert.equal(status.readyForOwnerMission,true);
  assert.ok(!json.includes(OWNER_KEY));
  assert.ok(!json.includes("secret-provider-key"));
});
