"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
test("NVIDIA HTTP 402 free_quota_exhausted stays offline and free OpenRouter takes over",async()=>{
 const keys=["AKSARA_HYBRID_ROUTER","AKSARA_FREE_FALLBACKS","AKSARA_NVIDIA_ENABLED","NVIDIA_API_KEY","OPENROUTER_API_KEY","GROQ_API_KEY"];
 const old=Object.fromEntries(keys.map(x=>[x,process.env[x]]));
 const originalFetch=global.fetch;
 let orcaCalls=0,backupCalls=0;
 try{
  process.env.AKSARA_HYBRID_ROUTER="true";
  process.env.AKSARA_FREE_FALLBACKS="true";
  process.env.AKSARA_NVIDIA_ENABLED="true";
  process.env.NVIDIA_API_KEY="test-only";
  process.env.OPENROUTER_API_KEY="test-only";
  delete process.env.GROQ_API_KEY;
  const path=require.resolve("../netlify/functions/aksara-provider-router");
  delete require.cache[path];
  const Router=require(path);
  global.fetch=async(url)=>{
   if(url.includes("integrate.api.nvidia.com")){
    orcaCalls++;
    return {ok:false,status:402,headers:{get:()=>null},
      json:async()=>({error:{code:"free_quota_exhausted",message:"Free quota exhausted"}})};
   }
   if(url.includes("openrouter.ai")){
    backupCalls++;
    return {ok:true,status:200,headers:{get:()=>"application/json"},
      json:async()=>({model:"backup-free",choices:[{message:{content:"Jawapan sandaran percuma berjaya."},finish_reason:"stop"}]})};
   }
   throw Error("Unexpected live network attempted: "+url);
  };
  const response=await Router.complete({system:"Identiti Aksara",history:[],question:"Beri satu contoh metafora.",prefer:"nvidia",
    deadline:Date.now()+15000,only:["nvidia","openrouter"]});
  assert.equal(orcaCalls,1);
  assert.equal(backupCalls,1);
  assert.equal(response.provider,"openrouter");
  assert.equal(response.attempts[0].status,402);
  assert.equal(response.attempts[0].reason,"free_quota_exhausted");
  assert.equal(response.attempts[0].errorType,"free_quota_exhausted");
  const status=await Router.checkStatus();
  const orca=status.find(x=>x.id==="nvidia");
  assert.equal(orca.status,"offline");
  assert.equal(orca.reason,"free_quota_exhausted");
  assert.equal(orca.http,402);
  assert.equal(orca.retryAfterSeconds,undefined,"Never claim upstream quota resets in 15 seconds");
  assert.ok(Router.availability().find(x=>x.provider==="nvidia").retryAfterSeconds>60);
  const next=await Router.complete({system:"Identiti",history:[],question:"Sekali lagi.",only:["nvidia","openrouter"],deadline:Date.now()+10000});
  assert.equal(next.provider,"openrouter");
  assert.equal(orcaCalls,1,"Cannot retry exhausted free quota immediately");
 }finally{
  global.fetch=originalFetch;
  for(const k of keys)if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];
  delete require.cache[require.resolve("../netlify/functions/aksara-provider-router")];
 }
});
