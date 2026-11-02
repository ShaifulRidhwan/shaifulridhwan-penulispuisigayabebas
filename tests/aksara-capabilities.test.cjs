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
 assert.equal(C.urlTrace({candidates:[{urlContextMetadata:{urlMetadata:[{
  retrievedUrl:"https://www.wikipedia.org/",urlRetrievalStatus:"URL_RETRIEVAL_STATUS_SUCCESS"
 }]}}]},[{url_context:{}}],"https://www.wikipedia.org/").status,"success");
 assert.equal(C.urlTrace({candidates:[{urlContextMetadata:{urlMetadata:[{
  retrievedUrl:"https://www.wikipedia.org/",urlRetrievalStatus:"URL_RETRIEVAL_STATUS_SUCCESS"
 }]}}]},[{url_context:{}}],"https://example.com/").status,"target_not_reported");
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

test("Gemini news reply without verified live search is blocked even when fluent",async t=>{
 setupEvidenceEnvironment(t);
 const {handler}=require("../netlify/functions/bilik-antara");
 let geminiCalled=false;
 global.fetch=async(url)=>{
  const u=String(url);
  if(u.includes("api.groq.com"))return Response.json({error:{message:"rate limited"}},{status:429,headers:{"retry-after":"1"}});
  if(u.includes("googleapis")){
   geminiCalled=true;
   return Response.json({candidates:[{content:{parts:[{text:"Three made-up headlines about tomorrow."}]},finishReason:"STOP"}]});
  }
  throw Error("Unexpected provider "+u);
 };
 const out=await handler({httpMethod:"POST",headers:{
  origin:"https://shaifulridhwan-penulispuisigayabebas.netlify.app",
  "x-nf-client-connection-ip":"qa-gemini-ungrounded-news"
 },body:JSON.stringify({question:"Cari tiga berita AI terkini pada 2 November 2026 dan sertakan sumber."})});
 const data=JSON.parse(out.body);
 assert.equal(out.statusCode,200);
 assert.equal(geminiCalled,true);
 assert.equal(data.provider,"local");
 assert.deepEqual(data.sources,[]);
 assert.match(data.reply,/bukan hasil carian web yang disahkan/);
 assert.doesNotMatch(data.reply,/made-up headlines/);
 assert.equal(data.model,"gemini-news-evidence-guard");
});
test("Gemini cannot call a URL read verified from another retrieved URL",async t=>{
 setupEvidenceEnvironment(t);
 process.env.GROQ_FREE_CONFIRMED="false";
 const {handler}=require("../netlify/functions/bilik-antara");
 global.fetch=async url=>{
  if(!String(url).includes("googleapis"))throw Error("Only Gemini expected");
  return Response.json({candidates:[{content:{parts:[{text:"Wikipedia looks just like I remember."}]},
   urlContextMetadata:{urlMetadata:[{
    retrievedUrl:"https://somewhere-else.example.net/",
    urlRetrievalStatus:"URL_RETRIEVAL_STATUS_SUCCESS"
   }]},finishReason:"STOP"}]});
 };
 const out=await handler({httpMethod:"POST",headers:{
  origin:"https://shaifulridhwan-penulispuisigayabebas.netlify.app",
  "x-nf-client-connection-ip":"qa-gemini-wrong-url"
 },body:JSON.stringify({question:"Buka https://www.wikipedia.org/ dan terangkan kandungan halaman yang benar-benar dapat dibaca."})});
 const data=JSON.parse(out.body);
 assert.equal(out.statusCode,200);
 assert.equal(data.provider,"local");
 assert.equal(data.urlTrace.status,"target_not_reported");
 assert.deepEqual(data.sources,[]);
 assert.doesNotMatch(data.reply,/looks just like/);
});
test("Gemini matching URL Context retrieval is surfaced as evidence of text access",async t=>{
 setupEvidenceEnvironment(t);
 process.env.GROQ_FREE_CONFIRMED="false";
 const {handler}=require("../netlify/functions/bilik-antara");
 global.fetch=async url=>{
  if(!String(url).includes("googleapis"))throw Error("Only Gemini expected");
  return Response.json({candidates:[{content:{parts:[{text:"This is a response grounded in the homepage text."}]},
   urlContextMetadata:{urlMetadata:[{
    retrievedUrl:"https://www.wikipedia.org/",
    urlRetrievalStatus:"URL_RETRIEVAL_STATUS_SUCCESS"
   }]},finishReason:"STOP"}]});
 };
 const out=await handler({httpMethod:"POST",headers:{
  origin:"https://shaifulridhwan-penulispuisigayabebas.netlify.app",
  "x-nf-client-connection-ip":"qa-gemini-valid-url"
 },body:JSON.stringify({question:"Buka https://www.wikipedia.org/ dan terangkan kandungan halaman yang benar-benar dapat dibaca."})});
 const data=JSON.parse(out.body);
 assert.equal(out.statusCode,200);
 assert.equal(data.provider,"gemini");
 assert.ok(data.toolsUsed.includes("url_context"));
 assert.equal(data.urlTrace.status,"success");
 assert.match(data.disclaimer,/URL Context berjaya/);
});

test("Google Search Grounding is active only for eligible public current-news queries",()=>{
 const G=require("../netlify/functions/aksara-google-grounding");
 const intent={question:"Cari tiga berita AI terkini pada 2 November 2026 dan sertakan sumber.",search:true};
 assert.equal(G.MODEL,"gemini-2.5-flash-lite");
 assert.equal(G.eligible(intent,{}),true);
 assert.equal(G.eligible(intent,{AKSARA_GOOGLE_SEARCH_GROUNDING:"false"}),false);
 assert.equal(G.eligible({...intent,privateContext:true},{}),false);
 assert.equal(G.eligible({...intent,attachment:true},{}),false);
 assert.equal(G.eligible({...intent,sensitive:true},{}),false);
 assert.equal(G.eligible({...intent,hasLink:true},{}),false);
 assert.equal(G.eligible({...intent,question:"Kunci API aku ialah api_key=secret"},{}) ,false);
 assert.equal(C.manifest({}).gemini.googleSearchGrounding,true);
 assert.equal(C.manifest({AKSARA_GOOGLE_SEARCH_GROUNDING:"false"}).gemini.googleSearchGrounding,false);
});
test("Google grounding only trusts real search queries plus verifiable HTTPS citations",()=>{
 const G=require("../netlify/functions/aksara-google-grounding");
 const grounded={candidates:[{content:{parts:[{text:"Berita sebenar."}]},
  groundingMetadata:{webSearchQueries:["AI news 2 November 2026"],
   groundingChunks:[{web:{uri:"https://example.org/news",title:"Verified source"}}]}}]};
 assert.equal(G.verified(grounded).sources[0].url,"https://example.org/news");
 assert.equal(G.verified({candidates:[{content:{parts:[{text:"Memorized news"}]},
  groundingMetadata:{groundingChunks:[{web:{uri:"https://example.org/news",title:"Source"}}]}}]}),null);
 assert.equal(G.verified({candidates:[{content:{parts:[{text:"Missing source"}]},
  groundingMetadata:{webSearchQueries:["AI news"]}}]}),null);
});
test("Gemini free-tier grounding POST has google_search tool and no private history",async()=>{
 const G=require("../netlify/functions/aksara-google-grounding");
 let body;
 const resp=await G.search({question:"Cari berita AI terkini",apiKey:"mock-key",
  fetchImpl:async(_url,options)=>{
   body=JSON.parse(options.body);
   return Response.json({candidates:[{content:{parts:[{text:"Satu berita telah ditemui."}]},
    groundingMetadata:{webSearchQueries:["AI news"],
     groundingChunks:[{web:{uri:"https://example.org/story",title:"News story"}}]}}]});
  }});
 assert.equal(resp.status,"success");
 assert.equal(resp.model,"gemini-2.5-flash-lite");
 assert.deepEqual(body.tools,[{google_search:{}}]);
 assert.equal(body.contents.length,1);
 assert.ok(!JSON.stringify(body).includes("history"));
});
test("Groq browser 429 hands public news to verified Google Search Grounding without touching main model",async t=>{
 setupEvidenceEnvironment(t);
 process.env.AKSARA_GOOGLE_SEARCH_GROUNDING="true";
 t.after(()=>{delete process.env.AKSARA_GOOGLE_SEARCH_GROUNDING;});
 const {handler}=require("../netlify/functions/bilik-antara");
 let searchCalled=0,ordinaryGemini=0;
 global.fetch=async(url,opts)=>{
  const u=String(url);
  if(u.includes("api.groq.com"))return Response.json({error:{message:"Too many requests"}},{status:429,headers:{"retry-after":"1"}});
  if(u.includes("googleapis")){
   const payload=JSON.parse(opts.body);
   if(payload.tools?.some(x=>x.google_search)){
    searchCalled++;
    assert.ok(u.includes("gemini-2.5-flash-lite"));
    assert.ok(!JSON.stringify(payload).includes("PRIVATE_SESSION_CONTENT"));
    return Response.json({candidates:[{content:{parts:[{text:"Sumber berita yang benar-benar dijumpai."}]},
     groundingMetadata:{webSearchQueries:["AI news 2026"],
      groundingChunks:[{web:{uri:"https://example.org/news",title:"News article"}}]}}]});
   }
   ordinaryGemini++;return Response.json({candidates:[{content:{parts:[{text:"Outdated knowledge"}]}}]});
  }
  throw Error("unexpected external call: "+u);
 };
 const out=await handler({httpMethod:"POST",headers:{
  origin:"https://shaifulridhwan-penulispuisigayabebas.netlify.app",
  "x-nf-client-connection-ip":"qa-grounding-after-groq-rate-limit"
 },body:JSON.stringify({question:"Cari tiga berita AI terkini pada 2 November 2026 dan sertakan sumber.",
  summary:"PRIVATE_SESSION_CONTENT"})});
 const data=JSON.parse(out.body);
 assert.equal(out.statusCode,200);
 assert.equal(data.provider,"gemini");
 assert.equal(data.model,"gemini-2.5-flash-lite");
 assert.equal(data.researchStatus,"google-grounded");
 assert.ok(data.toolsUsed.includes("google_search"));
 assert.equal(data.sources[0].url,"https://example.org/news");
 assert.equal(searchCalled,1);
 assert.equal(ordinaryGemini,0);
});

test("Google grounding exposes model access, quota and empty evidence distinctly",async()=>{
 const G=require("../netlify/functions/aksara-google-grounding");
 for(const [http,status] of [[404,"model_unavailable"],[429,"quota_exceeded"],[403,"access_denied"],[400,"invalid_request"]]){
  const out=await G.search({question:"Cari berita AI terkini",apiKey:"mock",
   fetchImpl:async()=>Response.json({error:{message:"DO_NOT_LEAK_UPSTREAM_ERROR"}},{status:http})});
  assert.equal(out.status,status);
  assert.equal(out.http,http);
  assert.ok(!JSON.stringify(out).includes("DO_NOT_LEAK_UPSTREAM_ERROR"));
 }
 const empty=await G.search({question:"Cari berita AI terkini",apiKey:"mock",
  fetchImpl:async()=>Response.json({candidates:[{content:{parts:[{text:"Ungrounded guess"}]},
   groundingMetadata:{webSearchQueries:["AI news 2026"]},finishReason:"STOP"}]})});
 assert.equal(empty.status,"no_grounding_evidence");
 assert.equal(empty.hasSearchQueries,true);
 assert.equal(empty.hasSources,false);
});
test("Production news guard reports Google 2.5 HTTP 404 after Groq 429, without guessing news",async t=>{
 setupEvidenceEnvironment(t);
 const oldGround=process.env.AKSARA_GOOGLE_SEARCH_GROUNDING;
 process.env.AKSARA_GOOGLE_SEARCH_GROUNDING="true";
 t.after(()=>oldGround===undefined?delete process.env.AKSARA_GOOGLE_SEARCH_GROUNDING:
  process.env.AKSARA_GOOGLE_SEARCH_GROUNDING=oldGround);
 const {handler}=require("../netlify/functions/bilik-antara");
 let googleSearchCalled=0,ordinaryGeminiCalled=0;
 global.fetch=async(url,options)=>{
  const u=String(url);
  if(u.includes("api.groq.com"))return Response.json({error:{message:"Requests per minute limit reached"}},
   {status:429,headers:{"retry-after":"1"}});
  if(u.includes("googleapis")){
   const body=JSON.parse(options.body);
   if(u.includes("gemini-2.5-flash-lite")&&body.tools?.some(x=>x.google_search)){
    googleSearchCalled++;
    return Response.json({error:{message:"model unavailable private upstream text"}},{status:404});
   }
   ordinaryGeminiCalled++;
   return Response.json({candidates:[{content:{parts:[{text:"Fabricated recent news"}]},finishReason:"STOP"}]});
  }
  throw Error("Unexpected route "+u);
 };
 const out=await handler({httpMethod:"POST",headers:{
  origin:"https://shaifulridhwan-penulispuisigayabebas.netlify.app",
  "x-nf-client-connection-ip":"qa-grounding-diagnostic-404"
 },body:JSON.stringify({question:"Cari tiga berita AI terkini pada 2 November 2026 dan sertakan sumber."})});
 const data=JSON.parse(out.body);
 assert.equal(out.statusCode,200);
 assert.equal(googleSearchCalled,1);
 assert.equal(ordinaryGeminiCalled,1);
 assert.equal(data.provider,"local");
 assert.equal(data.routing.googleGrounding.status,"model_unavailable");
 assert.equal(data.routing.googleGrounding.http,404);
 assert.match(data.reply,/Google Search Grounding/);
 assert.match(data.reply,/HTTP 404/);
 assert.doesNotMatch(data.reply,/Fabricated recent news|private upstream text/);
});

test("Publisher RSS extracts exact-dated source links and rejects untrusted article hosts",()=>{
 const R=require("../netlify/functions/aksara-public-news-rss");
 const q="Cari tiga berita AI terkini pada 2 November 2026 dan sertakan pautan sumber";
 assert.equal(R.eligible({question:q,search:true},{}),true);
 assert.equal(R.requestedDate(q),"2026-11-02");
 assert.equal(R.eligible({question:q,search:true,privateContext:true},{}),false);
 assert.equal(R.eligible({question:q,search:true,attachment:true},{}),false);
 assert.equal(R.eligible({question:q,search:true},{AKSARA_PUBLIC_RSS_ENABLED:"false"}),false);
 const xml="<rss><channel><item><title>Model AI baharu &amp; benchmark</title>"+
  "<link>https://techcrunch.com/2026/11/02/model-ai/</link>"+
  "<pubDate>Mon, 02 Nov 2026 12:01:00 GMT</pubDate>"+
  "<description>AI story</description></item>"+
  "<item><title>Fake host</title><link>https://untrusted.example/2026/story</link>"+
  "<pubDate>Mon, 02 Nov 2026 11:59:00 GMT</pubDate></item>"+
  "<item><title>Old story</title><link>https://techcrunch.com/2026/11/01/old/</link>"+
  "<pubDate>Sun, 01 Nov 2026 12:01:00 GMT</pubDate></item></channel></rss>";
 const sources=R.parse(xml,R.FEEDS[0],Date.UTC(2026,10,2,14,30),"2026-11-02");
 assert.equal(sources.length,1);
 assert.equal(sources[0].date,"2026-11-02");
 assert.equal(sources[0].title,"Model AI baharu & benchmark");
 const out=R.render({sources,targetDate:"2026-11-02"});
 assert.match(out,/metadata RSS penerbit/);
 assert.match(out,/https:\/\/techcrunch\.com\/2026\/11\/02\/model-ai\//);
});
test("RSS fallback fetches only its fixed publisher feed endpoints",async()=>{
 const R=require("../netlify/functions/aksara-public-news-rss");
 let seen=[];
 const r=await R.search({question:"Berita AI terkini 2 November 2026",
  now:Date.UTC(2026,10,2,15,0),fetchImpl:async url=>{
   seen.push(url);
   const isTech=String(url).includes("techcrunch.com");
   const xml=isTech?"<rss><channel><item><title>AI original headline</title>"+
    "<link>https://techcrunch.com/2026/11/02/news/</link>"+
    "<pubDate>Mon, 02 Nov 2026 09:00:00 GMT</pubDate></item></channel></rss>":
    "<rss><channel/></rss>";
   return new Response(xml,{headers:{"content-type":"application/rss+xml"}});
  }});
 assert.equal(r.status,"success");
 assert.equal(r.sources.length,1);
 assert.equal(seen.length,R.FEEDS.length);
 assert.ok(seen.every(x=>R.FEEDS.some(f=>f.url===x)));
 assert.doesNotMatch(R.render(r),/2\. \*\*/);
});
test("Groq 429 + Google Grounding 404 can return dated publisher RSS links",async t=>{
 setupEvidenceEnvironment(t);
 const old=process.env.AKSARA_PUBLIC_RSS_ENABLED;
 process.env.AKSARA_PUBLIC_RSS_ENABLED="true";
 t.after(()=>old===undefined?delete process.env.AKSARA_PUBLIC_RSS_ENABLED:
  process.env.AKSARA_PUBLIC_RSS_ENABLED=old);
 const {handler}=require("../netlify/functions/bilik-antara");
 let rssCalled=0,googleGroundingCalled=0,ordinaryGeminiCalled=0;
 global.fetch=async(url,opts={})=>{
  const u=String(url);
  if(u.includes("api.groq.com"))return Response.json({error:{message:"rate limited"}},
   {status:429,headers:{"retry-after":"1"}});
  if(u.includes("googleapis")){
   const body=JSON.parse(opts.body);
   if(body.tools?.some(x=>x.google_search)){
    googleGroundingCalled++;
    return Response.json({error:{code:404,message:"Legacy model blocked"}},{status:404});
   }
   ordinaryGeminiCalled++;
   return Response.json({candidates:[{content:{parts:[{text:"unverified answer"}]}}]});
  }
  if(u.includes("techcrunch.com")||u.includes("arstechnica.com")||
     u.includes("news.mit.edu")||u.includes("feeds.bbci.co.uk")){
   rssCalled++;
   const outlet=u.includes("techcrunch.com")?"https://techcrunch.com/2026/11/02/ai-product/":
     u.includes("arstechnica.com")?"https://arstechnica.com/ai/2026/11/02/ai-research/":
     u.includes("news.mit.edu")?"https://news.mit.edu/2026/ai-science-1102":
     "https://www.bbc.com/news/technology-123";
   const xml="<rss><channel><item><title>AI published headline</title>"+
     "<link>"+outlet+"</link><pubDate>Mon, 02 Nov 2026 12:00:00 GMT</pubDate>"+
     "<description>Artificial intelligence reporting</description></item></channel></rss>";
   return new Response(xml,{headers:{"content-type":"application/rss+xml"}});
  }
  throw Error("Unexpected external URL "+u);
 };
 const out=await handler({httpMethod:"POST",headers:{
  origin:"https://shaifulridhwan-penulispuisigayabebas.netlify.app",
  "x-nf-client-connection-ip":"qa-groq-google-rss-news"
 },body:JSON.stringify({question:"Cari tiga berita AI terkini pada 2 November 2026 dan sertakan pautan sumber yang disahkan."})});
 const data=JSON.parse(out.body);
 assert.equal(out.statusCode,200);
 assert.equal(googleGroundingCalled,1);
 assert.equal(ordinaryGeminiCalled,0);
 assert.equal(rssCalled,4);
 assert.equal(data.mode,"public-rss");
 assert.equal(data.researchStatus,"publisher-rss");
 assert.deepEqual(data.toolsUsed,["publisher_rss"]);
 assert.equal(data.sources.length,3);
 assert.equal(data.routing.googleGrounding.status,"model_unavailable");
 assert.match(data.reply,/metadata RSS penerbit/);
 assert.match(data.disclaimer,/belum diaudit/);
});
