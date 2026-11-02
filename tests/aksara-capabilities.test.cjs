"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const C=require("../netlify/functions/aksara-capabilities");
const Own=require("../netlify/functions/aksara-owned-page");
const {createPool}=require("../netlify/functions/lib/gemini-text-pool");
const question="Baca https://en.wikipedia.org/wiki/Albert_Einstein dan review.";
test("Groq provides browser search and code interpreter only when task is eligible",()=>{
 const task={question,hasLink:true};
 assert.deepEqual(C.offered("groq",task).map(x=>x.type),["browser_search"]);
 assert.deepEqual(C.offered("groq",{question,hasLink:true,calculate:true}).map(x=>x.type),["browser_search","code_interpreter"]);
 assert.deepEqual(C.offered("groq",{...task,sensitive:true}),[]);
 assert.deepEqual(C.offered("groq",{...task,privateContext:true}),[]);
 assert.deepEqual(C.offered("groq",task,{AKSARA_GROQ_BROWSER_ENABLED:"false"}),[]);
});
test("OpenRouter uses explicitly free HTTP web fetch; paid search is owner-gated",()=>{
 assert.deepEqual(C.offered("openrouter",{question,hasLink:true}),[
  {type:"openrouter:web_fetch",parameters:{engine:"openrouter",max_content_tokens:3500}}
 ]);
 assert.deepEqual(C.offered("openrouter",{question:"Semak berita teknologi terkini",search:true}),[]);
 assert.deepEqual(C.offered("openrouter",{question:"Semak berita teknologi terkini",search:true},
  {AKSARA_OPENROUTER_PAID_SEARCH_ENABLED:"true"}).map(x=>x.type),["openrouter:web_search"]);
 assert.deepEqual(C.offered("openrouter",{question,hasLink:true,attachment:true}),[]);
 assert.deepEqual(C.offered("openrouter",{question:"https://localhost/",hasLink:true}),[]);
});
test("URL and Groq execution must be evidenced, not inferred from offered tools",()=>{
 assert.equal(C.urlTrace({candidates:[{urlContextMetadata:{urlMetadata:[
  {urlRetrievalStatus:"URL_RETRIEVAL_STATUS_SUCCESS"}]}}]},[{url_context:{}}]).status,"success");
 assert.equal(C.urlTrace({candidates:[{urlContextMetadata:{urlMetadata:[
  {urlRetrievalStatus:"URL_RETRIEVAL_STATUS_ERROR"}]}}]},[{url_context:{}}]).status,"failed");
 assert.equal(C.urlTrace({},[{url_context:{}}]).status,"not_reported");
 assert.deepEqual(C.executed("groq",{choices:[{message:{executed_tools:[{name:"browser_search"},{name:"python"}]}}]}),
  ["browser_search","code_interpreter"]);
 assert.deepEqual(C.executed("openrouter",{choices:[{message:{content:"some text"}}]}),[]);
});
test("Gemini local function declaration is narrow and private-data free",()=>{
 const t=C.geminiFunctions({question:"Cari petikan karya puisi tentang ragu",works:true});
 assert.equal(t[0].functionDeclarations[0].name,"knowledge_search");
 assert.deepEqual(C.geminiFunctions({question:"Cari puisi https://example.org",works:true,hasLink:true}),[]);
 assert.deepEqual(C.geminiFunctions({question:"Cari petikan puisi",works:true,sensitive:true}),[]);
 assert.deepEqual(C.geminiFunctions({question:"Cari petikan puisi",works:true},{AKSARA_GEMINI_FUNCTIONS_ENABLED:"false"}),[]);
});
test("Gemini project throttling is slot-scoped and other keys remain eligible",()=>{
 const pool=createPool(),env={GEMINI_API_KEY:"a",GEMINI_API_KEY_2:"b",GEMINI_API_KEY_3:"c",GEMINI_API_KEY_4:"d"};
 assert.equal(pool.pick(env).slot,1);
 pool.failure(1,{status:429,retryAfterSeconds:30});
 assert.equal(pool.snapshot(env).find(x=>x.slot===1).status,"offline");
 assert.equal(pool.pick(env).slot,2);
 assert.deepEqual(pool.configured(env).map(x=>x.slot),[1,2,3,4]);
 const chat=fs.readFileSync("netlify/functions/bilik-antara.js","utf8");
 assert.match(chat,/function googleWait\(model,slot\)/);
 assert.match(chat,/googleCooldown\(model,error,poolKey\?\.slot\)/);
});
test("Owner-owned-page fetch rejects unlisted hosts and scripts, permits only static HTML",async()=>{
 assert.equal(Own.pageUrl("Baca https://localhost/admin"),null);
 assert.equal(Own.pageUrl("Baca https://shaifulridhwan-penulispuisigayabebas.netlify.app/.netlify/functions/bilik-antara"),null);
 const url="https://shaifulridhwan-penulispuisigayabebas.netlify.app/";
 let seen;
 const page=await Own.read("Baca "+url,{fetchImpl:async(input,opts)=>{
  seen={input,opts};
  return {ok:true,url,headers:{get(name){return name==="content-type"?"text/html":null}},
   text:async()=>'<html><head><title>AKSARA</title></head><body>Puisi <script>secret</script> cahaya</body></html>'};
 }});
 assert.equal(seen.input,url);
 assert.equal(seen.opts.redirect,"error");
 assert.match(page.text,/Puisi/);
 assert.doesNotMatch(page.text,/secret/);
 assert.match(page.text,/HTML statik/);
});
test("Fallback router receives web task capabilities from Bilik Antara",()=>{
 const s=fs.readFileSync("netlify/functions/bilik-antara.js","utf8");
 assert.match(s,/const webIntent=\{/);
 assert.match(s,/deadline,webIntent,firstResponseDeadline/);
 assert.match(s,/alternative\.toolsOffered/);
});

test("fresh-news requests without Gemini web evidence hand off to real Groq browser search",async t=>{
 const keys=["GEMINI_API_KEY","GEMINI_API_KEY_2","GEMINI_API_KEY_3","GEMINI_API_KEY_4","AKSARA_FREE_FALLBACKS",
  "GROQ_API_KEY","GROQ_FREE_CONFIRMED","AKSARA_HYBRID_ROUTER","AKSARA_DISABLE_RESEARCH","AKSARA_WEB_SEARCH_ENABLED"];
 const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]])),oldFetch=global.fetch;
 t.after(()=>{
  global.fetch=oldFetch;
  for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}
 });
 Object.assign(process.env,{GEMINI_API_KEY:"mock-primary",AKSARA_FREE_FALLBACKS:"true",
  GROQ_API_KEY:"mock-fallback",GROQ_FREE_CONFIRMED:"true",AKSARA_HYBRID_ROUTER:"true",
  AKSARA_DISABLE_RESEARCH:"false",AKSARA_WEB_SEARCH_ENABLED:"false"});
 for(const k of ["GEMINI_API_KEY_2","GEMINI_API_KEY_3","GEMINI_API_KEY_4"])delete process.env[k];
 const {handler}=require("../netlify/functions/bilik-antara");
 let groq;
 global.fetch=async(url,options)=>{
  if(String(url).includes("generativelanguage.googleapis.com")){
   return Response.json({candidates:[{content:{parts:[{text:"Unverified old model knowledge."}]},finishReason:"STOP"}]});
  }
  if(String(url).includes("api.groq.com")){
   groq=JSON.parse(options.body);
   return Response.json({model:"openai/gpt-oss-120b",choices:[{message:{
    content:"Bukti carian langsung kini ditemui.",
    executed_tools:[{name:"browser_search"}]},finish_reason:"stop"}]});
  }
  throw Error("Unexpected external provider in research handoff");
 };
 const response=await handler({httpMethod:"POST",headers:{
  origin:"https://shaifulridhwan-penulispuisigayabebas.netlify.app",
  "x-nf-client-connection-ip":"capability-live-research-proof"
 },body:JSON.stringify({question:"Cari berita AI terkini hari ini"})});
 const result=JSON.parse(response.body);
 assert.equal(response.statusCode,200);
 assert.equal(result.provider,"groq");
 assert.ok(result.toolsUsed.includes("browser_search"));
 assert.deepEqual(groq.tools,[{type:"browser_search"}]);
 assert.equal(groq.tool_choice,"required");
});

test("natural language computation and specific AKSARA works expose correct intents",()=>{
 const I=require("../netlify/functions/antara-intelligence");
 const math=I.resolveIntent("Gunakan alat pelaksanaan kod untuk mengira jumlah kuasa dua integer 1 hingga 1000",[],false);
 assert.equal(math.calculate,true);
 const work=I.resolveIntent("Cari petikan karya puisi AKSARA yang membincangkan keraguan",[],false);
 assert.equal(work.works,true);
 assert.equal(C.geminiFunctions({question:"Cari petikan karya puisi AKSARA yang membincangkan keraguan",works:work.works}).length,1);
 const chat=fs.readFileSync("netlify/functions/bilik-antara.js","utf8");
 assert.match(chat,/const explicitPoetrySearch=Capabilities\.geminiFunctions/);
 assert.match(chat,/explicitPoetrySearch\s*\?\s*null:PublicPoetry\.sample/);
});

test("explicit code execution uses actual Groq tool and requires proof",async t=>{
 const keys=["GEMINI_API_KEY","GEMINI_API_KEY_2","GEMINI_API_KEY_3","GEMINI_API_KEY_4",
  "AKSARA_FREE_FALLBACKS","GROQ_API_KEY","GROQ_FREE_CONFIRMED",
  "AKSARA_HYBRID_ROUTER","AKSARA_DISABLE_RESEARCH","AKSARA_GROQ_CODE_ENABLED"];
 const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]])),oldFetch=global.fetch;
 t.after(()=>{
  global.fetch=oldFetch;
  for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}
 });
 Object.assign(process.env,{
  GEMINI_API_KEY:"mock-primary",GROQ_API_KEY:"mock-groq",GROQ_FREE_CONFIRMED:"true",
  AKSARA_HYBRID_ROUTER:"true",AKSARA_FREE_FALLBACKS:"true",AKSARA_DISABLE_RESEARCH:"false",
  AKSARA_GROQ_CODE_ENABLED:"true"
 });
 for(const k of ["GEMINI_API_KEY_2","GEMINI_API_KEY_3","GEMINI_API_KEY_4"])delete process.env[k];
 const {handler}=require("../netlify/functions/bilik-antara");
 let groqRequest=null,geminiCalls=0;
 global.fetch=async(url,options)=>{
  if(String(url).includes("generativelanguage.googleapis.com")){
   geminiCalls++;
   return Response.json({candidates:[{content:{parts:[{text:"Gemini ordinary answer"}]},finishReason:"STOP"}]});
  }
  if(String(url).includes("api.groq.com")){
   groqRequest=JSON.parse(options.body);
   return Response.json({model:"openai/gpt-oss-120b",choices:[{message:{
    content:"333833500",executed_tools:[{name:"code_interpreter"}]},finish_reason:"stop"}]});
  }
  throw Error("Unexpected provider");
 };
 const out=await handler({httpMethod:"POST",headers:{
  origin:"https://shaifulridhwan-penulispuisigayabebas.netlify.app",
  "x-nf-client-connection-ip":"capability-explicit-code-test"
 },body:JSON.stringify({
  question:"Gunakan alat pelaksanaan kod untuk mengira jumlah kuasa dua integer 1 hingga 1000"
 })});
 const data=JSON.parse(out.body);
 assert.equal(out.statusCode,200);
 assert.equal(data.provider,"groq");
 assert.ok(data.toolsUsed.includes("code_interpreter"));
 assert.equal(geminiCalls,0);
 assert.deepEqual(groqRequest.tools,[{type:"code_interpreter"}]);
 assert.equal(groqRequest.tool_choice,"required");
 assert.match(data.disclaimer,/Code Interpreter/);
 const another=await handler({httpMethod:"POST",headers:{
  origin:"https://shaifulridhwan-penulispuisigayabebas.netlify.app",
  "x-nf-client-connection-ip":"capability-run-python-smoke"
 },body:JSON.stringify({question:"Run Python: print('hello')"})});
 const executedAgain=JSON.parse(another.body);
 assert.equal(another.statusCode,200);
 assert.equal(executedAgain.provider,"groq");
 assert.ok(executedAgain.toolsUsed.includes("code_interpreter"));
 assert.equal(geminiCalls,0);
 assert.deepEqual(groqRequest.tools,[{type:"code_interpreter"}]);
});

test("offered-but-unused code tool does not falsely claim execution",()=>{
 const x=C.executed("groq",{choices:[{message:{content:"I think the answer is 123"}}]});
 assert.deepEqual(x,[]);
 const router=fs.readFileSync("netlify/functions/aksara-provider-router.js","utf8");
 assert.match(router,/t\.type==="browser_search"\|\|t\.type==="code_interpreter"/);
 const chat=fs.readFileSync("netlify/functions/bilik-antara.js","utf8");
 assert.match(chat,/options\.requireCodeEvidence&&!alternative\.toolsUsed\?\.includes\("code_interpreter"\)/);
});

test("BM and English direct code requests activate calculation but tutorials do not",()=>{
 const I=require("../netlify/functions/antara-intelligence");
 for(const q of [
  "Run Python: print('hello')",
  "Execute code: print('hello')",
  "Jalankan Python: print('hai')",
  "Laksanakan kod: print('hai')"
 ])assert.equal(I.resolveIntent(q,[],false).calculate,true,q);
 assert.equal(I.resolveIntent("How do I run Python?",[],false).calculate,false);
});

function setupEvidenceEnvironment(t){
 const names=["GEMINI_API_KEY","GEMINI_API_KEY_2","GEMINI_API_KEY_3","GEMINI_API_KEY_4",
  "GROQ_API_KEY","GROQ_FREE_CONFIRMED","OPENROUTER_API_KEY","AKSARA_FREE_FALLBACKS",
  "AKSARA_HYBRID_ROUTER","AKSARA_WEB_SEARCH_ENABLED","AKSARA_DISABLE_RESEARCH",
  "AKSARA_GROQ_BROWSER_ENABLED","ENABLE_PUBLIC_WORKS","TAVILY_API_KEY"];
 const saved=Object.fromEntries(names.map(k=>[k,process.env[k]])),oldFetch=global.fetch;
 Object.assign(process.env,{GEMINI_API_KEY:"mock-evidence-gemini",
  GROQ_API_KEY:"mock-evidence-groq",GROQ_FREE_CONFIRMED:"true",
  OPENROUTER_API_KEY:"mock-evidence-openrouter",AKSARA_FREE_FALLBACKS:"true",
  AKSARA_HYBRID_ROUTER:"true",AKSARA_WEB_SEARCH_ENABLED:"false",
  AKSARA_DISABLE_RESEARCH:"true",AKSARA_GROQ_BROWSER_ENABLED:"true",
  ENABLE_PUBLIC_WORKS:"false"});
 for(const k of ["GEMINI_API_KEY_2","GEMINI_API_KEY_3","GEMINI_API_KEY_4","TAVILY_API_KEY"])delete process.env[k];
 t.after(()=>{
  global.fetch=oldFetch;
  for(const [k,v] of Object.entries(saved))if(v===undefined)delete process.env[k];else process.env[k]=v;
 });
}
test("a browser-search call cannot prove direct reading of an explicitly requested URL",async t=>{
 setupEvidenceEnvironment(t);
 const {handler}=require("../netlify/functions/bilik-antara");
 let groqUsed=false;
 global.fetch=async(url)=>{
  if(String(url).includes("googleapis"))return Response.json({candidates:[{
   content:{parts:[{text:"I know what that homepage looks like."}]},finishReason:"STOP"}]});
  if(String(url).includes("api.groq.com")){
   groqUsed=true;
   return Response.json({model:"openai/gpt-oss-120b",choices:[{message:{
    content:"I read the page and its exact layout.",executed_tools:[{name:"browser_search"}]
   },finish_reason:"stop"}]});
  }
  throw Error("Unexpected provider in exact-page evidence test");
 };
 const result=await handler({httpMethod:"POST",headers:{
  origin:"https://shaifulridhwan-penulispuisigayabebas.netlify.app",
  "x-nf-client-connection-ip":"qa-exact-url-proof"
 },body:JSON.stringify({question:"Buka https://www.wikipedia.org/ dan terangkan apa yang benar-benar dibaca."})});
 const data=JSON.parse(result.body);
 assert.equal(result.statusCode,200);
 assert.equal(groqUsed,true);
 assert.equal(data.provider,"local");
 assert.ok(data.toolsUsed.includes("browser_search"));
 assert.deepEqual(data.sources,[]);
 assert.match(data.reply,/tidak membuktikan/);
 assert.doesNotMatch(data.reply,/exact layout/);
});
test("failed Groq browser plus ungrounded OpenRouter must return truthful live-news status",async t=>{
 setupEvidenceEnvironment(t);
 const {handler}=require("../netlify/functions/bilik-antara");
 let routerCalled=false;
 global.fetch=async(url)=>{
  const u=String(url);
  if(u.includes("api.groq.com"))return Response.json({
   error:{message:"Requests per minute limit reached",code:"rate_limit_exceeded"}
  },{status:429,headers:{"retry-after":"1"}});
  if(u.includes("googleapis"))return Response.json({error:{code:503,message:"Service unavailable"}},{status:503});
  if(u.includes("openrouter.ai")&&u.includes("/chat/completions")){
   routerCalled=true;
   return Response.json({model:"mock-free",choices:[{message:{
    content:"Here are three totally invented AI headlines.",executed_tools:[]
   },finish_reason:"stop"}]});
  }
  throw Error("Unexpected provider in failed-news test: "+u);
 };
 const result=await handler({httpMethod:"POST",headers:{
  origin:"https://shaifulridhwan-penulispuisigayabebas.netlify.app",
  "x-nf-client-connection-ip":"qa-failed-news-proof"
 },body:JSON.stringify({question:"Cari tiga berita AI terkini pada 2 November 2026 dan sertakan sumber."})});
 const data=JSON.parse(result.body);
 assert.equal(result.statusCode,200);
 assert.equal(routerCalled,true);
 assert.equal(data.provider,"local");
 assert.deepEqual(data.sources,[]);
 assert.match(data.reply,/tiada hasil Browser Search/);
 assert.doesNotMatch(data.reply,/invented AI headlines/);
 assert.ok(data.routing.failedAttempts.some(x=>x.provider==="groq"&&x.status===429));
});
