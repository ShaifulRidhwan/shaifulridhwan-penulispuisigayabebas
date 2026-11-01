"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const Router=require("../netlify/functions/aksara-provider-router");
const Hybrid=require("../netlify/functions/aksara-hybrid-policy");
const model="@cf/zai-org/glm-4.7-flash";
test("3+1 never promotes OpenRouter above primary providers",()=>{
 const active=[{id:"openrouter"},{id:"groq"},{id:"workers_ai"}];
 const ranked=Router.rankProviders(active,"technical","openrouter",true);
 assert.equal(ranked.at(-1).id,"openrouter");
 assert.deepEqual(new Set(ranked.slice(0,-1).map(p=>p.id)),new Set(["groq","workers_ai"]));
 const policy=Hybrid.decide({task:"conversation",available:["gemini","groq","workers_ai","openrouter"]});
 assert.deepEqual(policy.primaries,["gemini","groq","workers_ai"]);
 assert.equal(policy.backup,"openrouter");
});
test("Workers AI is only enabled when a real native binding exists",()=>{
 const old=process.env.AKSARA_FREE_FALLBACKS;
 process.env.AKSARA_FREE_FALLBACKS="true";
 try{
  assert.equal(Router.configured().some(x=>x.id==="workers_ai"),false);
  assert.equal(Router.configured({run:async()=>({response:"OK"})}).find(x=>x.id==="workers_ai").model,model);
 }finally{if(old===undefined)delete process.env.AKSARA_FREE_FALLBACKS;else process.env.AKSARA_FREE_FALLBACKS=old;}
});
