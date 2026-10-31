import {test} from "node:test";
import assert from "node:assert/strict";
import {probeNvidia,chooseProbeModels} from "./src/nvidia-inference.mjs";
import {nvidiaDiagnostic} from "./src/nvidia-diagnostic.mjs";
const mkSSE=events=>new Response(events.map(v=>"data: "+JSON.stringify(v)+"\n\n").join("")+"data: [DONE]\n\n",
 {headers:{"content-type":"text/event-stream"}});
const okSSE=()=>mkSSE([
 {choices:[{delta:{reasoning_content:"Internal reasoning should never count as visible reply."}}]},
 {choices:[{delta:{content:"Metafora ialah perbandingan secara kiasan."}}]}
]);
const key="TEST_API_KEY_NVIDIA_DO_NOT_LOG";
test("Real streamed visible content counts as evidence; private reasoning does not",async()=>{
 const calls=[];
 const outcome=await probeNvidia("nvidia/nemotron-3.5-lightning-30b-a3b",key,async(url,opts)=>{
  calls.push({url,opts});
  return okSSE();
 });
 assert.equal(outcome.ok,true);
 assert.equal(outcome.http,200);
 assert.equal(outcome.reason,"reply_received");
 assert.ok(outcome.streamEvents>=2);
 assert.equal(calls.length,1);
 assert.equal(calls[0].opts.headers.Authorization,"Bearer "+key);
 const body=JSON.parse(calls[0].opts.body);
 assert.equal(body.stream,true);
 assert.ok(body.max_tokens>=1024);
 assert.equal(body.messages.at(-1).role,"user");
 assert.equal(JSON.stringify(outcome).includes(key),false);
});
test("Streamed reasoning alone is never a successful answer",async()=>{
 const r=await probeNvidia("nvidia/nemotron-3.5-bolt-e4b",key,
  async()=>mkSSE([{choices:[{delta:{reasoning_content:"not visible"}}]}]));
 assert.equal(r.ok,false);
 assert.equal(r.reason,"empty_visible_content");
});
test("Non-stream JSON fallback and provider errors have meaningful statuses",async()=>{
 const ok=await probeNvidia("mistralai/mistral-large-4-1t-a52b",key,async()=>
   Response.json({choices:[{message:{content:"Jawapan yang boleh dilihat."}}]}));
 assert.equal(ok.ok,true);
 const rate=await probeNvidia("mistralai/mistral-large-4-1t-a52b",key,async()=>
  new Response("PRIVATE_PROVIDER_ERROR",{status:429}));
 assert.equal(rate.reason,"rate_limited");
 assert.equal(rate.http,429);
 assert.doesNotMatch(JSON.stringify(rate),/PRIVATE_PROVIDER_ERROR/);
});
test("Automatic candidate selection prioritizes small/current Chat models, no duplicates",()=>{
 const list=[{id:"deepseek-ai/deepseek-v4.1-flash",trialEndpointLabel:true},
  {id:"z-ai/glm-5-3-flash",trialEndpointLabel:true},
  {id:"nvidia/nemotron-3.5-bolt-e4b",trialEndpointLabel:true},
  {id:"nvidia/nemotron-3.5-lightning-30b-a3b",trialEndpointLabel:true}];
 assert.deepEqual(chooseProbeModels(list,"deepseek-ai/deepseek-v4.1-flash",3),
 ["nvidia/nemotron-3.5-bolt-e4b","nvidia/nemotron-3.5-lightning-30b-a3b","z-ai/glm-5-3-flash"]);
 assert.deepEqual(chooseProbeModels(list.slice(0,1),"deepseek-ai/deepseek-v4.1-flash",3),
 ["deepseek-ai/deepseek-v4.1-flash"]);
});
test("Authenticated owner auto test tries alternative then stops on streamed real evidence",async()=>{
 const origin="https://aksara-apps.example.workers.dev";
 const token="token-only-for-unit-tests-0123456789abcdef0123456789";
 const env={AKSARA_NVIDIA_TEST_TOKEN:token,NVIDIA_API_KEY:key};
 let quota=0,postCount=0;
 const fetcher=async(url,opts)=>{
  if(url.endsWith("/models"))return Response.json({data:[
   {id:"nvidia/nemotron-3.5-bolt-e4b"},
   {id:"nvidia/nemotron-3.5-lightning-30b-a3b"},
   {id:"deepseek-ai/deepseek-v4.1-flash"}]});
  postCount++;
  if(postCount===1)return new Response("NVIDIA BUSY",{status:503});
  return okSSE();
 };
 const req=new Request(origin+"/api/aksara-nvidia-test",{
  method:"POST",headers:{"origin":origin,"content-type":"application/json"},
  body:JSON.stringify({token,mode:"auto",model:"deepseek-ai/deepseek-v4.1-flash"})
 });
 const res=await nvidiaDiagnostic(req,env,async(_env,kind)=>{
  if(kind==="nvidia-test")quota++;
  return {ok:true};
 },fetcher);
 assert.equal(res.status,200);
 const payload=await res.json();
 assert.equal(payload.ok,true);
 assert.equal(payload.model,"nvidia/nemotron-3.5-lightning-30b-a3b");
 assert.equal(payload.hasAnswer,true);
 assert.equal(payload.proof,"real_streamed_response");
 assert.equal(payload.attempts.length,2);
 assert.equal(quota,2);
 assert.equal(postCount,2);
 assert.doesNotMatch(JSON.stringify(payload),/NVIDIA BUSY|Metafora|TEST_API_KEY/);
});
