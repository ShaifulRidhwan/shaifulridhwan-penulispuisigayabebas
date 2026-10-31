import {test} from "node:test";
import assert from "node:assert/strict";
import {nvidiaDiagnostic} from "./src/nvidia-diagnostic.mjs";

const origin="https://aksara-apps.example.workers.dev";
const path="/api/aksara-nvidia-test";
const token="token-only-for-unit-tests-0123456789abcdef0123456789";
const env={AKSARA_NVIDIA_TEST_TOKEN:token,NVIDIA_API_KEY:"unit-test-private-nvidia-token"};
function post(value,options={}){
 return new Request(origin+path,{method:"POST",headers:{
  "Content-Type":"application/json",...(options.crossOrigin?{"Origin":"https://bad.example"}:{"Origin":origin})},
  body:JSON.stringify({token:value})});
}
test("owner page contains no real credentials or untrusted network scripts",async()=>{
 const response=await nvidiaDiagnostic(new Request(origin+path),env,async()=>{throw Error("not needed")});
 const html=await response.text();
 assert.equal(response.status,200);
 assert.match(html,/type="password"/);
 assert.match(html,/bukan API key NVIDIA/);
 assert.doesNotMatch(html,/unit-test-private-nvidia-token/);
 assert.match(response.headers.get("content-security-policy"),/connect-src 'self'/);
 assert.match(response.headers.get("x-robots-tag"),/noindex/);
});
test("unauthenticated and foreign-origin requests never call NVIDIA or quota",async()=>{
 let calls=0;
 const quota=async()=>{calls++;return {ok:true}};
 const fetcher=async()=>{calls++;throw Error("must never reach NVIDIA")};
 for(const request of [post("incorrect"),post(token,{crossOrigin:true})]){
  const response=await nvidiaDiagnostic(request,env,quota,fetcher);
  assert.equal(response.status,403);
 }
 assert.equal(calls,0);
});
test("owner-only smoke calls NVIDIA once with safe fixed prompt; no key or reply leaked",async()=>{
 const calls=[];
 const quota=async(_env,kind)=>{assert.ok(["health","nvidia-test"].includes(kind));return {ok:true}};
 const fetcher=async(url,opts)=>{
  calls.push({url,opts});
  if(url.endsWith("/models"))return Response.json({data:[{id:"deepseek-ai/deepseek-v4.1-flash"}]});
  return Response.json({choices:[{message:{content:"Metafora ialah perbandingan secara kiasan."}}]});
 };
 const res=await nvidiaDiagnostic(post(token),env,quota,fetcher);
 const body=await res.text();
 assert.equal(res.status,200);
 assert.match(body,/"hasAnswer":true/);
 assert.doesNotMatch(body,/Metafora|unit-test-private-nvidia-token|token-only-for/);
 assert.equal(calls.length,2);
 assert.equal(calls[0].url,"https://integrate.api.nvidia.com/v1/models");
 assert.equal(calls[1].url,"https://integrate.api.nvidia.com/v1/chat/completions");
 assert.equal(calls[1].opts.headers.Authorization,"Bearer "+env.NVIDIA_API_KEY);
 const request=JSON.parse(calls[1].opts.body);
 assert.equal(request.model,"deepseek-ai/deepseek-v4.1-flash");
 assert.equal(request.temperature,1);
 assert.equal(request.top_p,0.95);
 assert.ok(request.messages.every(x=>typeof x.content==="string"&&x.content.length<160));
});
test("catalog safely verifies key access without spending an inference slot",async()=>{
 const calls=[];
 const quota=async(_env,kind)=>{calls.push("quota:"+kind);return {ok:true}};
 const fetcher=async(url,options)=>{
  calls.push(url);
  assert.equal(options.method,"GET");
  return Response.json({data:[{id:"deepseek-ai/deepseek-v4.1-flash"},{id:"nvidia/nemotron-3.5-lightning-30b-a3b"},{id:"nvidia/nemotron-3.5-embed-1b"}]});
 };
 const req=new Request(origin+path,{method:"POST",headers:{"Origin":origin},
  body:JSON.stringify({token,mode:"catalog"})});
 const res=await nvidiaDiagnostic(req,env,quota,fetcher);
 const body=await res.text();
 assert.equal(res.status,200);
 assert.match(body,/"credentialAccepted":true/);
 assert.match(body,/"modelListed":true/);
 assert.doesNotMatch(body,/unit-test-private-nvidia-token|token-only-for/);
 assert.deepEqual(calls,["quota:health","https://integrate.api.nvidia.com/v1/models"]);
});
test("unavailable NVIDIA and exhausted quota are reported without provider error body",async()=>{
 const upstream=await nvidiaDiagnostic(post(token),env,async()=>({ok:true}),
  async(url)=>url.endsWith("/models")?Response.json({data:[{id:"deepseek-ai/deepseek-v4.1-flash"}]}):new Response("VERY_PRIVATE_UPSTREAM_ERROR",{status:402}));
 assert.equal(upstream.status,200);
 const body=await upstream.text();
 assert.match(body,/"upstreamHttp":402/);
 assert.match(body,/"no_model_answered"/);
 assert.doesNotMatch(body,/VERY_PRIVATE_UPSTREAM_ERROR/);
 const quota=await nvidiaDiagnostic(post(token),env,async()=>({
  error:Response.json({error:"Had dua ujian NVIDIA sehari tercapai."},{status:429})
 }),async()=>{throw Error("Must not run")});
 assert.equal(quota.status,429);
});
