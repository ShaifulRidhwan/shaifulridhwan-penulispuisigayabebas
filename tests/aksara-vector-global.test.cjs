"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const Vector=require("../netlify/functions/aksara-vector-rag");
const Knowledge=require("../netlify/functions/aksara-knowledge-engine");
const D1=require("../netlify/functions/aksara-global-performance");
const Registry=require("../netlify/functions/aksara-model-registry");
const Index=require("../scripts/aksara-vector-index.cjs");
const originalFetch=global.fetch;
const env={CLOUDFLARE_ACCOUNT_ID:"0123456789abcdef0123456789abcdef",
 AKSARA_CF_RAG_TOKEN:"test-token-for-unit-test-only",
 AKSARA_VECTORIZE_INDEX:"aksara-public-knowledge",
 AKSARA_CF_D1_DATABASE_ID:"12345678-1234-1234-1234-123456789abc",
 AKSARA_CF_METRICS_TOKEN:"test-token-for-unit-test-only"};
function json(body){return new Response(JSON.stringify({success:true,result:body}),{status:200,headers:{"Content-Type":"application/json"}});}
test("Cloudflare RAG requires server credentials and a fixed multilingual vector dimension",()=>{
 assert.equal(Vector.config({}),null);
 assert.equal(Vector.config(env).index,"aksara-public-knowledge");
 assert.equal(Vector.DIM,1024);
 assert.equal(Vector.parseEmbeddings({data:[Array(1024).fill(0.01)]})[0].length,1024);
 assert.throws(()=>Vector.parseEmbeddings({data:[[1,2,3]]}),/dimensions/);
 assert.equal(Vector.validateMatch({id:"x",score:.9,metadata:{kind:"private",title:"Secret",excerpt:"Pvt"}}),null);
});
test("Real vector query uses public metadata, never includes personal notes",async t=>{
 t.after(()=>global.fetch=originalFetch);
 const calls=[];
 global.fetch=async(url,opts)=>{
  calls.push({url,body:JSON.parse(opts.body)});
  if(url.includes("/ai/run/"))return json({data:[Array(1024).fill(.01)]});
  if(url.includes("/query"))return json({matches:[
   {id:"public-a",score:.88,metadata:{kind:"public-work",title:"Di Ambang Aporia",excerpt:"Aku meranduk perbatasan"}},
   {id:"private-b",score:.94,metadata:{kind:"private",title:"Rahsia",excerpt:"don't expose"}}
  ]});
  throw Error("Unexpected endpoint");
 };
 const rows=await Vector.retrieve("makna pengetahuan",{env,timeout:2000,topK:2});
 assert.equal(rows.length,1);assert.equal(rows[0].title,"Di Ambang Aporia");
 assert.equal(calls.length,2);
 assert.equal(calls[0].body.text[0],"makna pengetahuan");
 assert.equal(calls[1].body.vector.length,1024);
 assert.equal(calls[1].body.returnMetadata,"all");
 assert.ok(calls.every(c=>!JSON.stringify(c.body).includes("Rahsia")));
});
test("Vector indexing sends ONLY repository works as bounded NDJSON",async t=>{
 t.after(()=>global.fetch=originalFetch);
 const docs=Index.sourceDocuments();
 assert.ok(docs.length>0);
 assert.ok(docs.every(d=>d.id.length===32&&d.text.length<=2200));
 const data=docs.slice(0,2),payloads=[];
 global.fetch=async(url,opts)=>{
  payloads.push({url,body:opts.body});
  if(url.includes("/ai/run/"))return json({data:data.map(()=>Array(1024).fill(.02))});
  return json({mutationId:"123"});
 };
 const result=await Vector.upsertPublic(data,{env,timeout:10000});
 assert.ok(result);
 const ndjson=payloads[1].body.trim().split("\n").map(x=>JSON.parse(x));
 assert.equal(ndjson.length,2);
 assert.ok(ndjson.every(d=>d.metadata.kind==="public-work"&&d.values.length===1024));
 assert.ok(ndjson.every(d=>!JSON.stringify(d).includes("sessionMemory")));
});
test("Hybrid retrieval respects privacy and works offline without Cloudflare",async t=>{
 t.after(()=>global.fetch=originalFetch);
 global.fetch=async()=>{throw Error("should not be called");};
 const privateOnly=await Knowledge.retrieveHybrid({question:"nota kebenaran",includePublic:false,
  memoryNotes:"nota kebenaran pengguna",allowPrivate:true});
 assert.ok(privateOnly.some(x=>x.kind==="private"));
 const lexical=await Knowledge.retrieveHybrid({question:"aporia akal",includePublic:true,limit:3});
 assert.ok(Array.isArray(lexical));
});
test("D1 global stats use parameterized atomic upserts and accept ratings only from developer methods",async t=>{
 t.after(()=>global.fetch=originalFetch);
 assert.equal(D1.config({}),null);
 assert.ok(D1.config(env));
 const bodies=[];
 global.fetch=async(_url,opts)=>{
  bodies.push(JSON.parse(opts.body));return json([{success:true,results:[{
   provider:"groq",task:"general",success:8,failure:2,latency_total_ms:13000,
   quality_count:7,quality_total:32,updated_at:"2026-10-30"
  }]}]);
 };
 await D1.init({env});
 assert.equal(await D1.record("groq","general",{ok:true,latencyMs:1250},{env}),true);
 assert.equal(await D1.rateByDeveloper("groq","general",5,{env}),true);
 const rows=await D1.snapshot({env});
 assert.equal(rows[0].qualityCount,7);
 assert.match(bodies[1].sql,/ON CONFLICT/);
 assert.deepEqual(bodies[1].params,["groq","general","1","0","1250"]);
 assert.deepEqual(bodies[2].params,["groq","general","5"]);
 await assert.rejects(()=>D1.rateByDeveloper("other","general",5,{env}),/Invalid/);
});
test("Quality is human-scored: successful HTTP calls alone cannot fabricate high ratings",async t=>{
 t.after(()=>global.fetch=originalFetch);
 const qualityRows=[
 {provider:"groq",task:"general",success:50,failure:5,latency_total_ms:100000,quality_count:10,quality_total:12},
 {provider:"openrouter",task:"general",success:45,failure:5,latency_total_ms:90000,quality_count:10,quality_total:48}
 ];
 global.fetch=async()=>json([{success:true,results:qualityRows}]);
 await Registry.refreshGlobal({force:true,env,timeout:2000});
 const ordered=Registry.select([{id:"groq"},{id:"openrouter"}],{thinking:"high",task:"general",prefer:"groq"});
 assert.equal(ordered[0].id,"openrouter","Audited response quality can overcome default provider bias");
 assert.ok(Registry.globalScore("openrouter","general")>Registry.globalScore("groq","general"));
 const withoutRating=D1.normalizeRows([{provider:"groq",task:"technical",success:999,failure:0,quality_count:0,quality_total:0}]);
 assert.equal(withoutRating[0].qualityCount,0);
});
