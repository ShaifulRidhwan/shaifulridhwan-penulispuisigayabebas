"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const Rest=require("../netlify/functions/aksara-cloudflare-rest");
const Router=require("../netlify/functions/aksara-provider-router");
const ACCOUNT="a".repeat(32),TOKEN="fake-token-for-tests-only";
const configured={AKSARA_FREE_FALLBACKS:"true",CLOUDFLARE_ACCOUNT_ID:ACCOUNT,CLOUDFLARE_API_TOKEN:TOKEN};

test("Netlify Workers AI is unavailable without explicit free fallbacks and valid server secrets",()=>{
 assert.equal(Rest.create({env:{}}),null);
 assert.equal(Rest.create({env:{...configured,AKSARA_FREE_FALLBACKS:"false"}}),null);
 assert.equal(Rest.create({env:{...configured,AKSARA_WORKERS_REST_ENABLED:"false"}}),null);
 assert.equal(Rest.create({env:{...configured,CLOUDFLARE_ACCOUNT_ID:"bogus"}}),null);
 assert.equal(Rest.create({env:{...configured,CLOUDFLARE_API_TOKEN:""}}),null);
});
test("REST bridge uses only the native GLM model, server-side token and direct endpoint",async()=>{
 let seen={};
 const ai=Rest.create({env:configured,fetchFn:async(url,options)=>{
  seen={url,options};
  return new Response(JSON.stringify({success:true,result:{model:Rest.MODEL,
   choices:[{message:{content:"Aku Aksara A.I., dari Workers AI."},finish_reason:"stop"}]}}),
   {status:200,headers:{"content-type":"application/json"}});
 }});
 const answer=await ai.run(Rest.MODEL,{messages:[{role:"user",content:"Siapa kau?"}],max_completion_tokens:2500});
 assert.match(answer.choices[0].message.content,/Aksara/);
 assert.equal(seen.url,"https://api.cloudflare.com/client/v4/accounts/"+ACCOUNT+"/ai/run/"+Rest.MODEL);
 assert.equal(seen.options.headers.Authorization,"Bearer "+TOKEN);
 const body=JSON.parse(seen.options.body);
 assert.equal(body.max_completion_tokens,1700);
 assert.equal(body.store,false);
 assert.equal(body.messages[0].content,"Siapa kau?");
 assert.equal(seen.options.redirect,"error");
 assert.equal(seen.options.cache,"no-store");
 await assert.rejects(ai.run("@cf/meta/llama-3.1-8b-instruct",{messages:[{role:"user",content:"x"}]}),/not allowed/);
});
test("Native REST stream is consumed by the existing hybrid router without synthetic output",async()=>{
 const encoder=new TextEncoder();
 const ai=Rest.create({env:configured,fetchFn:async(_url,opts)=>{
  assert.equal(JSON.parse(opts.body).stream,true);
  return new Response(new ReadableStream({start(controller){
   for(const event of [
    {choices:[{delta:{content:"Aku Aksara."}}]},
    {choices:[{delta:{reasoning_content:"private thinking",content:" Sambungan dah pulih."},finish_reason:"stop"}]}
   ])controller.enqueue(encoder.encode("data: "+JSON.stringify(event)+"\n\n"));
   controller.enqueue(encoder.encode("data: [DONE]\n\n"));
   controller.close();
  }}),{status:200,headers:{"content-type":"text/event-stream"}});
 }});
 const restore={f:process.env.AKSARA_FREE_FALLBACKS,g:process.env.GROQ_API_KEY,o:process.env.OPENROUTER_API_KEY};
 process.env.AKSARA_FREE_FALLBACKS="true";delete process.env.GROQ_API_KEY;delete process.env.OPENROUTER_API_KEY;
 const chunks=[];
 try{
  const answer=await Router.complete({cloudflareAI:ai,system:"Aksara bahasa Melayu santai",history:[],question:"Apa khabar",onDelta:x=>chunks.push(x),deadline:Date.now()+10000});
  assert.equal(answer.provider,"workers_ai");
  assert.match(answer.reply,/Sambungan dah pulih/);
  assert.equal(chunks.join(""),"Aku Aksara. Sambungan dah pulih.");
  assert.doesNotMatch(chunks.join(""),/private thinking/);
 }finally{
  for(const [key,value] of Object.entries({AKSARA_FREE_FALLBACKS:restore.f,GROQ_API_KEY:restore.g,OPENROUTER_API_KEY:restore.o}))
   if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
});
test("REST authorization and quota errors are classified without leaking secrets",async()=>{
 for(const status of [401,403,429,503]){
  const ai=Rest.create({env:configured,fetchFn:async()=>new Response(JSON.stringify({error:"dont show tokens "+TOKEN}),{status})});
  await assert.rejects(ai.run(Rest.MODEL,{messages:[{role:"user",content:"hi"}]}),err=>{
   assert.equal(err.status,status);
   assert.doesNotMatch(err.message,/fake-token|aaaa/);
   assert.match(err.errorType,status===429?/rate_limit/:status===503?/upstream_http/:/authorization_or_access/);
   return true;
  });
 }
});
test("Cloudflare bridge only activates after native binding fallback and stays server-side",()=>{
 const js=fs.readFileSync("netlify/functions/bilik-antara.js","utf8");
 const html=fs.readFileSync("bilik-antara.html","utf8");
 assert.match(js,/event\.aiBinding\|\|CloudflareRest\.create\(\{env:process\.env\}\)/);
 assert.doesNotMatch(html,/CLOUDFLARE_(?:API_TOKEN|AUTH_TOKEN|WORKERS_AI_TOKEN)/);
});


test("Cloudflare diagnostic identifies missing configuration without leaking credentials",()=>{
 assert.deepEqual(Rest.readiness({}),{enabled:false,reason:"fallbacks_disabled"});
 assert.deepEqual(Rest.readiness({...configured,AKSARA_WORKERS_REST_ENABLED:"false"}),
  {enabled:false,reason:"rest_disabled"});
 assert.equal(Rest.readiness({...configured,CLOUDFLARE_ACCOUNT_ID:"invalid"}).reason,"missing_or_invalid_account");
 assert.equal(Rest.readiness({...configured,CLOUDFLARE_API_TOKEN:""}).reason,"missing_or_invalid_token");
 assert.deepEqual(Rest.readiness(configured),{enabled:true,reason:"adapter_configured"});
});
test("Explicit Workers AI inference probe uses a synthetic request and verifies output",async()=>{
 let called=0;
 const ai=Rest.create({env:configured,fetchFn:async(_url,options)=>{
  called++;
  const body=JSON.parse(options.body);
  assert.deepEqual(body.messages,[{role:"user",content:"Reply with the word OK."}]);
  assert.equal(body.stream,false);
  assert.equal(body.chat_template_kwargs.enable_thinking,false);
  return Response.json({success:true,result:{choices:[{message:{content:"OK"},finish_reason:"stop"}]}});
 }});
 const report=await Rest.probe(ai);
 assert.equal(report.status,"online");
 assert.equal(report.reason,"inference_verified");
 assert.equal(called,1);
 assert.equal(report.model,Rest.MODEL);
});
test("Workers AI manual probe distinguishes access denial, quota and timeout",async()=>{
 const access=Rest.create({env:configured,fetchFn:async()=>new Response("No access",{status:403})});
 const quota=Rest.create({env:configured,fetchFn:async()=>new Response("Busy",{status:429})});
 assert.equal((await Rest.probe(access)).reason,"authorization_or_access");
 assert.equal((await Rest.probe(quota)).reason,"quota");
 const abort=Rest.create({env:configured,fetchFn:async()=>{const err=new Error("Synthetic timeout");err.name="TimeoutError";throw err;}});
 const status=await Rest.probe(abort);
 assert.equal(status.status,"ready");
 assert.equal(status.reason,"probe_timeout");
});
test("Server provider status can verify Cloudflare without making a Gemini call",async()=>{
 const {handler}=require("../netlify/functions/bilik-antara");
 const names=["AKSARA_FREE_FALLBACKS","GEMINI_API_KEY","GEMINI_API_KEY_2","GEMINI_API_KEY_3","GEMINI_API_KEY_4","GROQ_API_KEY","OPENROUTER_API_KEY"];
 const previous=Object.fromEntries(names.map(x=>[x,process.env[x]]));
 let runs=0;
 try{
  process.env.AKSARA_FREE_FALLBACKS="true";
  for(const name of names.slice(1))delete process.env[name];
  const input={httpMethod:"POST",headers:{"x-nf-client-connection-ip":"cf-manual-proof-test"},
   body:JSON.stringify({providerStatus:true,workersAiLiveCheck:true}),
   aiBinding:{run:async(model,payload)=>{
    runs++;
    assert.equal(model,Rest.MODEL);
    assert.deepEqual(payload.messages,[{role:"user",content:"Reply with the word OK."}]);
    return {choices:[{message:{content:"OK"},finish_reason:"stop"}]};
   }}};
  const result=await handler(input);
  assert.equal(result.statusCode,200);
  const data=JSON.parse(result.body);
  const workers=data.providers.find(x=>x.id==="workers_ai");
  assert.equal(workers?.status,"online");
  assert.equal(workers?.reason,"inference_verified");
  assert.equal(data.workersAiDiagnostic.verified,true);
  assert.equal(runs,1);
 }finally{
  for(const [name,value] of Object.entries(previous))
   if(value===undefined)delete process.env[name];else process.env[name]=value;
 }
});
test("Workers AI HTTP and stream transport remain under Netlify's 26s budget",()=>{
 const bridge=fs.readFileSync("netlify/functions/aksara-cloudflare-rest.js","utf8");
 assert.match(bridge,/payload.stream\?17000:12000/);
 assert.match(bridge,/AbortSignal.any\(\[signal,AbortSignal.timeout\(ms\)\]\)/);
 const frontend=fs.readFileSync("bilik-antara.html","utf8");
 assert.match(frontend,/workersAiLiveCheck:force===true/);
 assert.doesNotMatch(frontend,/CLOUDFLARE_(?:API_TOKEN|AUTH_TOKEN|WORKERS_AI_TOKEN)/);
});
