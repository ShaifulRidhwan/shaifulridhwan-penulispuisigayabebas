"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const path=require.resolve("../netlify/functions/aksara-provider-router");
const keys=["AKSARA_FREE_FALLBACKS","AKSARA_NVIDIA_ENABLED","AKSARA_NVIDIA_PRODUCTION_AUTHORIZED",
 "NVIDIA_API_KEY","NVIDIA_PRODUCTION_API_KEY","NVIDIA_PRODUCTION_CHAT_URL","GROQ_API_KEY","OPENROUTER_API_KEY"];
function withEnv(next,fn){
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 for(const k of keys)delete process.env[k];
 Object.assign(process.env,{AKSARA_FREE_FALLBACKS:"true",NVIDIA_API_KEY:"TRIAL_ONLY_KEY_SHOULD_NOT_BE_USED",...next});
 delete require.cache[path];
 const router=require(path);
 return Promise.resolve().then(()=>fn(router)).finally(()=>{
  for(const k of keys){
   if(old[k]===undefined)delete process.env[k];
   else process.env[k]=old[k];
  }
  delete require.cache[path];
 });
}
const publicConfig={
 AKSARA_NVIDIA_ENABLED:"true",
 AKSARA_NVIDIA_PRODUCTION_AUTHORIZED:"true",
 NVIDIA_PRODUCTION_API_KEY:"PRODUCTION_KEY_FOR_UNIT_TEST",
 NVIDIA_PRODUCTION_CHAT_URL:"https://nim-enterprise.example.org/v1/chat/completions"
};
test("Trial NVIDIA key alone never opens public Chat",()=>withEnv(
 {AKSARA_NVIDIA_ENABLED:"true"},router=>{
  assert.deepEqual(router.configured().filter(x=>x.id==="nvidia"),[]);
 }));
test("A declaration without a licensed endpoint and separate key is insufficient",()=>withEnv(
 {AKSARA_NVIDIA_ENABLED:"true",AKSARA_NVIDIA_PRODUCTION_AUTHORIZED:"true"},
 router=>assert.equal(router.configured().some(x=>x.id==="nvidia"),false)
));
test("Reject HTTPS NVIDIA hosted Trial, localhost and credential-bearing endpoints",async()=>{
 for(const u of ["https://integrate.api.nvidia.com/v1/chat/completions",
  "http://nim-enterprise.example.org/v1/chat/completions",
  "https://127.0.0.1/v1/chat/completions",
  "https://user:password@nim-enterprise.example.org/v1/chat/completions",
  "https://nim-enterprise.example.org/v1/chat/completions?token=exposed"]){
  await withEnv({...publicConfig,NVIDIA_PRODUCTION_CHAT_URL:u},
   router=>assert.equal(router.configured().some(p=>p.id==="nvidia"),false,u));
 }
});
test("Licensed route opts into Nemotron 3.5 Bolt and never sends trial key",()=>withEnv(
 publicConfig,async router=>{
  const configured=router.configured().find(x=>x.id==="nvidia");
  assert.ok(configured);
  assert.equal(configured.model,"nvidia/nemotron-3.5-bolt-e4b");
  let call=null;
  const oldFetch=global.fetch;
  global.fetch=async(url,opt)=>{
   call={url,opt};
   return Response.json({model:"nvidia/nemotron-3.5-bolt-e4b",choices:[{
    message:{content:"Metafora ialah perbandingan yang menyampaikan makna kiasan."},
    finish_reason:"stop"
   }]});
  };
  try{
   const answer=await router.complete({
    system:"Jawab dalam Bahasa Melayu Malaysia.",
    history:[],question:"Apakah maksud metafora?",
    only:["nvidia"],deadline:Date.now()+10000,
    timeoutMs:4500,bufferedTimeoutMs:4500
   });
   assert.equal(answer.provider,"nvidia");
   assert.ok(call);
   assert.equal(call.url,publicConfig.NVIDIA_PRODUCTION_CHAT_URL);
   assert.equal(call.opt.headers.Authorization,"Bearer "+publicConfig.NVIDIA_PRODUCTION_API_KEY);
   assert.ok(!JSON.stringify(call).includes("TRIAL_ONLY_KEY_SHOULD_NOT_BE_USED"));
   assert.equal(JSON.parse(call.opt.body).model,configured.model);
  }finally{global.fetch=oldFetch}
 }));
