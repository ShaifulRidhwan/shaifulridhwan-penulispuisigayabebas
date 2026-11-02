"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const FP=require("../netlify/functions/aksara-free-potential");
const Multi=require("../netlify/functions/aksara-multi-url");
const Docs=require("../netlify/functions/aksara-document-intelligence");
const Workers=require("../netlify/functions/aksara-workers-free");
const Data=require("../netlify/functions/aksara-data-analysis");
const RSS=require("../netlify/functions/aksara-public-news-rss");
test("routing deadline protects time for RSS and skips Groq cooldown",()=>{
 const a=FP.budget({remainingMs:18000,hasGroq:true,hasGoogle:true,hasRss:true});
 assert.equal(a.tryGroq,true);assert.ok(a.groqMs<=7500);
 assert.equal(FP.budget({remainingMs:18000,groqCooldownSeconds:30,hasGroq:true,hasRss:true}).tryGroq,false);
 assert.equal(FP.budget({remainingMs:2500,hasGroq:true,hasRss:true}).tryGroq,false);
});
test("multi URL uses per-link Gemini retrieval evidence, not one success",()=>{
 const urls=Multi.extract("Banding https://www.wikipedia.org/ dan https://en.wikipedia.org/wiki/Physics");
 assert.equal(urls.length,2);
 for(const bad of ["http://example.com","https://127.0.0.1/x","https://localhost/a","https://user:pass@example.com/a"])
  assert.equal(Multi.allowed(bad),null);
 const data={candidates:[{urlContextMetadata:{urlMetadata:[
  {retrievedUrl:urls[0],urlRetrievalStatus:"URL_RETRIEVAL_STATUS_SUCCESS"},
  {retrievedUrl:urls[1],urlRetrievalStatus:"URL_RETRIEVAL_STATUS_ERROR"}]}}]};
 const r=Multi.summary(Multi.evidence(data,urls));
 assert.equal(r.status,"partial");assert.equal(r.verified,1);
});
test("PDF inline awareness is honest about large file workflow",()=>{
 const pdf=Docs.state({media:[{mimeType:"application/pdf"}]});
 assert.equal(pdf.method,"gemini_inline_pdf");
 assert.equal(pdf.largeFiles,"requires_separate_files_api_workflow");
 assert.match(Docs.guidance({media:[{mimeType:"application/pdf"}]}),/Jangan hantar lampiran/);
});
test("Workers RAG reranker only gets public passages and has opt-in",async()=>{
 const list=[{kind:"public",excerpt:"cahaya"},{kind:"public",excerpt:"rindu"}];
 const calls=[];
 const ai={run:async(...args)=>{calls.push(args);return {response:[{id:1,score:.9},{id:0,score:.2}]};}};
 assert.equal((await Workers.rerankPublic({ai,question:"rindu",results:list,env:{}})).status,"skipped");
 const a=await Workers.rerankPublic({ai,question:"rindu",results:list,env:{AKSARA_WORKERS_RERANK_ENABLED:"true"}});
 assert.equal(a.status,"verified_rerank");assert.equal(a.results[0].excerpt,"rindu");
 assert.equal(calls[0][0],Workers.RERANK_MODEL);
 assert.equal((await Workers.rerankPublic({ai,question:"rahsia",results:[{kind:"private",excerpt:"private"}],
  env:{AKSARA_WORKERS_RERANK_ENABLED:"true"}})).status,"skipped");
});
test("CSV local analysis includes median, grouped counts and missing",()=>{
 const x=Data.analyze("data.csv","region,amount\nNorth,2\nSouth,4\nNorth,\nNorth,6\n");
 assert.equal(x.numeric.amount.median,4);
 assert.equal(x.numeric.amount.missing,1);
 assert.equal(x.missingByColumn.amount,1);
 assert.equal(x.categorical.region[0].count,3);
});
test("Gateway opt-in disables caches and prompt logs",()=>{
 assert.equal(Workers.gatewayOptions({}),null);
 assert.deepEqual(Workers.gatewayOptions({AKSARA_WORKERS_GATEWAY_ENABLED:"true",AKSARA_WORKERS_GATEWAY_ID:"default"}),
  {gateway:{id:"default",collectLog:false,skipCache:true}});
 assert.equal(Workers.gatewayOptions({AKSARA_WORKERS_GATEWAY_ENABLED:"true",AKSARA_WORKERS_GATEWAY_ID:"../bad"}),null);
});
test("Capability diagnostics distinguish configured and verified",()=>{
 const report=FP.snapshot({env:{AKSARA_WORKERS_RERANK_ENABLED:"true"},ai:{run:async()=>{}},
  manifest:{gemini:{urlContext:true}},providers:[{id:"gemini"}]});
 assert.equal(report.scope,"configuration_not_execution");
 assert.equal(report.semantic.workersRerankEnabled,true);
 assert.equal(report.documents.filesApiLargeUpload,"not_integrated");
});
test("RSS does not restart Markdown numbering and favours separate publishers",async()=>{
 const x=await RSS.search({question:"Berita AI 2 November 2026",now:Date.UTC(2026,10,2,15),
  fetchImpl:async url=>{
   const tc=String(url).includes("techcrunch.com"),ars=String(url).includes("arstechnica.com");
   const host=tc?"https://techcrunch.com/2026/11/02/":
     ars?"https://arstechnica.com/ai/2026/11/02/":"";
   const items=tc?[["OpenAI news","openai"],["ChatGPT news","chatgpt"]]:
     ars?[["Gemini AI news","gemini"]]:[];
   const xml="<rss><channel>"+items.map(([title,slug])=>"<item><title>"+title+
     "</title><link>"+host+slug+"/</link><pubDate>Mon, 02 Nov 2026 11:00:00 GMT</pubDate></item>").join("")+"</channel></rss>";
   return new Response(xml,{headers:{"content-type":"application/rss+xml"}});
  }});
 assert.equal(x.status,"success");assert.equal(x.sources.length,3);
 assert.equal(x.sources[1].publisher,"Ars Technica");
 assert.match(RSS.render(x),/1\) \*\*/);
 assert.match(RSS.render(x),/2\) \*\*/);
});
