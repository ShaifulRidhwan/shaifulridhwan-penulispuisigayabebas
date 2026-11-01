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

test("Owner-only Browser Run and public R2/Queues archive are executable after binding",async()=>{
 const {createHash}=await import("node:crypto");
 const token="synthetic-fixture-long-owner-token-not-a-secret";
 const digest=createHash("sha256").update(token).digest("hex");
 const calls=[],url="https://apps.example.com/api/aksara-owner-tools";
 const env={
  AKSARA_OWNER_TOOL_TOKEN_SHA256:digest,
  AKSARA_BROWSER_RUN_ENABLED:"true",AKSARA_ARCHIVE_ENABLED:"true",
  BROWSER:{quickAction:async(_type,input)=>{calls.push(input.url);return new Response("# Home");}},
  AKSARA_R2:{put:async(key,data)=>{calls.push(key);assert.ok(data.includes("TRAGEDI SESEORANG MENCINTAIMU"));}},
  AKSARA_QUEUE:{send:async msg=>calls.push(msg.kind)}
 };
 const make=(body,authorized=true)=>new Request(url,{method:"POST",headers:{
  "x-aksara-owner-token":authorized?token:"wrong-token","content-type":"application/json"},body:JSON.stringify(body)});
 assert.equal((await ownerTool(make({action:"browser-homepage"},false),env)).status,403);
 const browser=await ownerTool(make({action:"browser-homepage",url:"http://127.0.0.1/private"}),env);
 assert.equal(browser.status,200);assert.deepEqual(calls[0],"https://shaifulridhwan-penulispuisigayabebas.netlify.app/");
 const archive=await ownerTool(make({action:"archive-public-poem",title:"TRAGEDI SESEORANG MENCINTAIMU"}),env);
 assert.equal(archive.status,200);assert.ok(calls.includes("index-public-poem"));
 assert.equal((await ownerTool(make({action:"archive-public-poem",title:"private-not-allowed"}),env)).status,404);
});
test("Owner-only audio and visual model adapters accept bounded inputs when explicitly enabled",async()=>{
 const {createHash}=await import("node:crypto");
 const token="synthetic-fixture-long-owner-token-not-a-secret";
 const digest=createHash("sha256").update(token).digest("hex");
 const used=[];
 const ai={run:async(model,input)=>{used.push(model);return model.includes("whisper")?{text:"Ujian suara"}:{description:"Imej ujian"};}};
 const base="https://apps.example.com/api/aksara-owner-tools";
 const env={AKSARA_OWNER_TOOL_TOKEN_SHA256:digest,AKSARA_MEDIA_AI_ENABLED:"true"};
 const request=body=>new Request(base,{method:"POST",headers:{"x-aksara-owner-token":token},
  body:JSON.stringify(body)});
 const media=Buffer.from("safe-synthetic-payload".repeat(8)).toString("base64");
 const voice=await ownerTool(request({action:"transcribe-audio",audioBase64:media}),env,ai);
 const image=await ownerTool(request({action:"inspect-image",imageBase64:media}),env,ai);
 assert.equal(voice.status,200);assert.equal(image.status,200);
 assert.equal(used.length,2);
 assert.ok(used[0].includes("whisper")&&used[1].includes("llava"));
});
