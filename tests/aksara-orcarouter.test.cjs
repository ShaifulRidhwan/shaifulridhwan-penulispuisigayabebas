"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");

// Isolated mocked transport: no visitor data and no real NVIDIA inference.
// Licensed NVIDIA production adapter remains behind a strict entitlement gate.
const keys=["AKSARA_HYBRID_ROUTER","AKSARA_FREE_FALLBACKS","AKSARA_NVIDIA_ENABLED","AKSARA_NVIDIA_PRODUCTION_AUTHORIZED","NVIDIA_PRODUCTION_API_KEY","NVIDIA_PRODUCTION_CHAT_URL","NVIDIA_API_KEY","OPENROUTER_API_KEY","GROQ_API_KEY"];
const original=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
process.env.AKSARA_FREE_FALLBACKS="true";
process.env.AKSARA_HYBRID_ROUTER="false";
process.env.AKSARA_NVIDIA_ENABLED="true";
process.env.NVIDIA_API_KEY="trial-test-key-must-not-reach-public";
process.env.AKSARA_NVIDIA_PRODUCTION_AUTHORIZED="true";
process.env.NVIDIA_PRODUCTION_API_KEY="test-only-production-key";
process.env.NVIDIA_PRODUCTION_CHAT_URL="https://nim-enterprise.example.org/v1/chat/completions";
delete process.env.OPENROUTER_API_KEY;
delete process.env.GROQ_API_KEY;

const Router=require("../netlify/functions/aksara-provider-router");
const Registry=require("../netlify/functions/aksara-model-registry");
test.after(()=>{
 for(const k of keys){if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k];}
});

test("NVIDIA is configured, text-only and entitlement-gated, with no paid-model override",()=>{
 assert.ok(Router.configured().some(p=>p.id==="nvidia"));
 assert.equal(Router.configured().find(p=>p.id==="nvidia").model,"nvidia/nemotron-3.5-bolt-e4b");
 assert.equal(Registry.CAPS.nvidia.vision,false);
 assert.equal(Registry.CAPS.nvidia.cost,"licensed-production-only");
});

test("NVIDIA inherits Aksara identity, modes and multi-turn context",async()=>{
 const old=global.fetch;let captured;
 global.fetch=async(url,request)=>{
  captured={url,request,body:JSON.parse(request.body)};
  return {ok:true,status:200,headers:{get:()=> "application/json"},json:async()=>({
   model:"nvidia/nemotron-3.5-bolt-e4b",
   choices:[{message:{content:"Aku Aksara. Kita sambung hujah tentang aporia."},finish_reason:"stop"}],
   usage:{completion_tokens:18}
  })};
 };
 try{
  const answer=await Router.complete({
   system:"Kau Aksara A.I. MOD GELAP. Ikut identiti karya Shaiful.",task:"critique",
   history:[{role:"user",content:"Kita bincang aporia."},{role:"assistant",content:"Aporia membuka persoalan."}],
   question:"Sambung perbincangan tadi.",maxTokens:1000,deadline:Date.now()+12000
  });
  assert.equal(captured.url,"https://nim-enterprise.example.org/v1/chat/completions");
  assert.equal(captured.body.model,"nvidia/nemotron-3.5-bolt-e4b");
  assert.equal(captured.body.messages[0].role,"system");
  assert.match(captured.body.messages[0].content,/MOD GELAP/);
  assert.match(captured.body.messages[0].content,/CAHAYA\/GELAP/);
  assert.match(captured.body.messages[0].content,/Bahasa Melayu Malaysia santai/);
  assert.equal(captured.body.messages[1].content,"Kita bincang aporia.");
  assert.equal(captured.body.messages.at(-1).content,"Sambung perbincangan tadi.");
  assert.equal(captured.body.stream,undefined);
  assert.equal(captured.body.temperature,1);
  assert.equal(captured.body.top_p,0.95);
  assert.equal(captured.body.reasoning_effort,undefined);
  assert.equal(answer.provider,"nvidia");
  assert.equal(answer.model,"nvidia/nemotron-3.5-bolt-e4b");
  assert.match(answer.reply,/Aku Aksara/);
  const states=await Router.checkStatus();
  const orca=states.find(p=>p.id==="nvidia");
  assert.equal(orca.status,"online","Connected is earned by a real mocked reply");
  assert.equal(orca.model,"nvidia/nemotron-3.5-bolt-e4b");
  assert.ok(Registry.diagnostics().some(r=>r.provider==="nvidia"&&r.success>=1));
 }finally{global.fetch=old;}
});

test("NVIDIA streaming uses standard SSE without exposing reasoning",async()=>{
 const old=global.fetch,seen=[];let request;
 const event=(data)=>"data: "+JSON.stringify(data)+"\n\n";
 global.fetch=async(_,opts)=>{
  request=JSON.parse(opts.body);
  const payload=event({model:"nvidia/nemotron-3.5-bolt-e4b",choices:[{delta:{reasoning_content:"internal only",content:"Aku "}}]})+
   event({choices:[{delta:{content:"faham."}}]})+
   event({choices:[{delta:{},finish_reason:"stop"}]})+"data: [DONE]\n\n";
  return {ok:true,status:200,headers:{get:()=> "text/event-stream"},
   body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(payload));c.close();}})};
 };
 try{
  const reply=await Router.complete({system:"Kau Aksara A.I.",history:[],question:"Salam",
   onDelta:t=>seen.push(t),deadline:Date.now()+12000});
  assert.equal(request.model,"nvidia/nemotron-3.5-bolt-e4b");
  assert.equal(request.stream,true);
  assert.equal(seen.join(""),"Aku faham.");
  assert.equal(reply.reply,"Aku faham.");
  assert.ok(!reply.reply.includes("internal only"));
 }finally{global.fetch=old;}
});

test("NVIDIA remains after Groq when a first-layer reply succeeds",async()=>{
 const oldFetch=global.fetch,oldKey=process.env.GROQ_API_KEY,oldFlag=process.env.GROQ_FREE_CONFIRMED;
 const calls=[];process.env.GROQ_API_KEY="test-not-a-real-key";process.env.GROQ_FREE_CONFIRMED="true";
 global.fetch=async(url)=>{
  calls.push(url);
  return {ok:true,status:200,headers:{get:()=>"application/json"},
   json:async()=>({model:"openai/gpt-oss-120b",choices:[{message:{content:"Jawapan Groq berjaya."},finish_reason:"stop"}]})};
 };
 try{
  const response=await Router.complete({system:"Aksara",history:[],question:"Tanya sesuatu",deadline:Date.now()+12000});
  assert.equal(response.provider,"groq");
  assert.equal(calls.length,1);
  assert.match(calls[0],/api.groq.com/);
 }finally{
  global.fetch=oldFetch;
  if(oldKey===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=oldKey;
  if(oldFlag===undefined)delete process.env.GROQ_FREE_CONFIRMED;else process.env.GROQ_FREE_CONFIRMED=oldFlag;
 }
});

test("NVIDIA serves only after a failed first-layer provider",async()=>{
 const oldFetch=global.fetch,oldKey=process.env.GROQ_API_KEY,oldFlag=process.env.GROQ_FREE_CONFIRMED;
 process.env.GROQ_API_KEY="test-not-a-real-key";process.env.GROQ_FREE_CONFIRMED="true";
 const calls=[];
 global.fetch=async(url)=>{
  calls.push(url);
  if(url.includes("api.groq.com"))return {ok:false,status:503,headers:{get:()=>null},
   json:async()=>({error:{message:"temporarily unavailable"}})};
  return {ok:true,status:200,headers:{get:()=>"application/json"},
   json:async()=>({model:"nvidia/nemotron-3.5-bolt-e4b",
    choices:[{message:{content:"Aku sambung melalui sandaran kedua."},finish_reason:"stop"}]})};
 };
 try{
  const response=await Router.complete({system:"Aksara",history:[],question:"Tolong sambung",deadline:Date.now()+12000});
  assert.equal(response.provider,"nvidia");
  assert.deepEqual(calls.map(u=>u.includes("api.groq.com")?"groq":"nvidia"),["groq","nvidia"]);
  assert.equal(response.attempts[0].provider,"groq");
 }finally{
  global.fetch=oldFetch;
  if(oldKey===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=oldKey;
  if(oldFlag===undefined)delete process.env.GROQ_FREE_CONFIRMED;else process.env.GROQ_FREE_CONFIRMED=oldFlag;
 }
});

test("Existing image consent cannot send attachments to NVIDIA",async()=>{
 const old=global.fetch;let calls=0;
 global.fetch=async()=>{calls++;throw Error("Orca must not see image bytes");};
 try{
  const result=await Router.complete({system:"Aksara",history:[],question:"Baca foto",
   mediaImages:[{mimeType:"image/png",data:"YWJj"}],only:["nvidia"],deadline:Date.now()+12000});
  assert.equal(result.error,"all_providers_unavailable");
  assert.equal(calls,0);
 }finally{global.fetch=old;}
});

test("NVIDIA honors Retry-After 429 instead of hammering free quota",async()=>{
 const old=global.fetch;
 global.fetch=async()=>({ok:false,status:429,headers:{get:k=>k==="retry-after"?"65":null},
  json:async()=>({error:{message:"Rate limit, retry after 65 seconds"}})});
 try{
  const reply=await Router.complete({system:"Aksara",history:[],question:"Semak had",
   deadline:Date.now()+12000});
  assert.equal(reply.error,"all_providers_unavailable");
  assert.equal(reply.attempts[0].provider,"nvidia");
  assert.equal(reply.attempts[0].status,429);
  assert.ok(Router.availability().find(p=>p.provider==="nvidia").retryAfterSeconds>=60);
  const states=await Router.checkStatus();
  assert.equal(states.find(p=>p.id==="nvidia").status,"offline");
 }finally{global.fetch=old;}
});
