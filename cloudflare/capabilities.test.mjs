import {test} from "node:test";
import assert from "node:assert/strict";
import {publicEvidence,verifyTurnstile,ownerTool,consumeArchiveQueue,capabilityFlags} from "./src/capabilities.mjs";
test("Optional capabilities default closed, no account bindings required",()=>{
 assert.deepEqual(capabilityFlags({}),{aiGateway:false,aiSearch:false,vectorize:false,
 turnstile:false,audioVision:false,browserRun:false,r2Queues:false});
});
test("AI Search takes only canonical public poetry title and excludes private dialogue",async()=>{
 let request;
 const env={AKSARA_AI_SEARCH_ENABLED:"true",
  AKSARA_AI_SEARCH:{search:async p=>{request=p;return {chunks:[{metadata:{title:"WANITA YANG DIAM",url:"https://shaifulridhwan-penulispuisigayabebas.netlify.app/"},content:"Diam bukan setuju."}]};}}};
 const output=await publicEvidence(env,"Jelaskan puisi WANITA YANG DIAM, private note: password secret");
 assert.equal(request.query,"WANITA YANG DIAM");
 assert.ok(!JSON.stringify(request).includes("password"));
 assert.match(output,/Diam bukan setuju/);
 assert.match(output,/TAJUK/);
});
test("Vectorize only accepts 1024-dim multilingual embedding with public metadata",async()=>{
 let called=0;
 const env={AKSARA_VECTORIZE_ENABLED:"true",AKSARA_VECTORS:{query:async v=>{
 called++;assert.equal(v.length,1024);
 return {matches:[{metadata:{title:"ANTARA TAHU DAN APORIA",excerpt:"Batas pengetahuan.",url:"https://shaifulridhwan-penulispuisigayabebas.netlify.app/"}}]};
 }}};
 const ai={run:async(_m,p)=>({data:[new Array(1024).fill(0.2)]})};
 const text=await publicEvidence(env,"Contoh puisi beserta maksud",ai);
 assert.equal(called,1);assert.match(text,/Batas pengetahuan/);
});
test("Turnstile requires real server verification and hostname match",async()=>{
 const url="https://apps.example.com/.netlify/functions/bilik-antara";
 const req=new Request(url,{method:"POST",headers:{"x-aksara-turnstile-token":"fake-token"}});
 const env={AKSARA_TURNSTILE_REQUIRED:"true",AKSARA_TURNSTILE_SECRET_KEY:"test-secret"};
 assert.equal((await verifyTurnstile(req,env,async()=>Response.json({success:true,hostname:"apps.example.com"}))).ok,true);
 assert.equal((await verifyTurnstile(req,env,async()=>Response.json({success:true,hostname:"evil.example"}))).ok,false);
 assert.equal((await verifyTurnstile(new Request(url),env)).ok,false);
});
test("No public owner tools without token, no arbitrary browser URL accepted",async()=>{
 const req=new Request("https://apps.example.com/api/aksara-owner-tools",{method:"POST",body:JSON.stringify({action:"browser-homepage",url:"http://169.254.169.254"})});
 assert.equal((await ownerTool(req,{},null)).status,404);
});
test("Queue indexes only curated public poems and never writes private text",async()=>{
 const events=[];const message={body:{kind:"index-public-poem",key:"public-poetry/1.json"},ack:()=>events.push("ack")};
 const env={AKSARA_VECTORIZE_ENABLED:"true",
  AKSARA_R2:{get:async()=>({json:async()=>({id:1,title:"TRAGEDI SESEORANG MENCINTAIMU",visibility:"public"})})},
  AKSARA_VECTORS:{upsert:async docs=>events.push(docs[0])},
  AI:{run:async()=>({data:[new Array(1024).fill(0.3)]})}};
 await consumeArchiveQueue({messages:[message]},env);
 assert.equal(events.at(-1),"ack");assert.equal(events[0].metadata.visibility,"public");
});
