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