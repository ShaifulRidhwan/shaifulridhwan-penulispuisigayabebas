"use strict";
// Audit baseline only. No network calls, providers, billing, file uploads or runtime changes.
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const I=require("../netlify/functions/antara-intelligence");
const C=require("../netlify/functions/aksara-context-manager");
const T=require("../netlify/functions/aksara-safe-tools");
const H=require("../netlify/functions/aksara-hybrid-policy");
const M=require("../netlify/functions/aksara-model-registry");
const R=require("../netlify/functions/aksara-research-workflow");
const file=p=>fs.readFileSync(p,"utf8");
const html=file("bilik-antara.html");
const server=file("netlify/functions/bilik-antara.js");
const stream=file("netlify/functions/bilik-antara-stream.mjs");
const reader=file("cloudflare/src/owned-page-evidence.mjs");
const cf=file("cloudflare/src/index.mjs");
const caps=file("cloudflare/src/capabilities.mjs");

test("Intent detects current information and externally supplied URLs separately",()=>{
 const recent=I.analyzeIntent("Cari berita terkini tentang teknologi");
 assert.equal(recent.search,true);
 const review=I.analyzeIntent("Review website ini https://example.com/");
 assert.equal(review.hasLink,true);
 assert.equal(review.search,false);
});
test("Follow-up context inherits a prior topic, not another unrelated subject",()=>{
 const history=[{role:"user",content:"Cari berita terkini mengenai sains"},{role:"assistant",content:"Maklumat semasa memerlukan sumber."}];
 const resolved=I.resolveIntent("yang tadi",history,false);
 assert.equal(resolved.search,true);
 assert.equal(resolved.contextFollowUp,true);
});
test("Context selection retains recent messages and caps request size",()=>{
 const messages=Array.from({length:20},(_,i)=>({role:i%2?"assistant":"user",content:"Fakta perbualan "+i}));
 const selected=C.selectHistory(messages,"yang tadi",{maxChars:210,keepRecent:5});
 assert.ok(selected.length>0);
 assert.ok(selected.some(x=>x.content==="Fakta perbualan 19"));
 assert.ok(selected.reduce((n,x)=>n+x.content.length,0)<=210);
});
test("Unreferenced old URL attachment can leave selected request context: documented gap",()=>{
 const rows=[{role:"user",content:"Pautan dahulu https://example.com/analisis"}];
 for(let i=0;i<15;i++)rows.push({role:i%2?"assistant":"user",content:"Perbincangan berbeza nombor "+i});
 const out=C.selectHistory(rows,"Tolong review website yang baharu",{keepRecent:5,maxChars:1500});
 assert.equal(out.some(x=>x.content.includes("https://example.com/analisis")),false);
});
test("Context composer marks prior material as reference, latest question as task",()=>{
 const composed=C.composeTurn("Apa keputusan?",["Data dan catatan terdahulu"]);
 assert.ok(composed.includes("[KONTEKS RUJUKAN"));
 assert.ok(composed.includes("[SOALAN PENGGUNA TERKINI"));
 assert.ok(composed.trim().endsWith("[TAMAT SOALAN TERKINI]"));
});
test("Tool awareness exposes a bounded local calculator and knowledge lookup",()=>{
 assert.deepEqual(Object.keys(T.SCHEMA).sort(),["calculate","knowledge_search"]);
 const local=T.calculatorIntent("kira 25 + 17");
 assert.equal(local.name,"calculate");
 assert.equal(T.execute(local).result,42);
 assert.equal(T.execute({name:"fetch_url",arguments:{url:"https://example.com"}}).ok,false);
});
test("Tool routing offers Gemini URL Context, but not general web search",()=>{
 const link=I.getTools({hasLink:true,calculate:false,simpleCalculation:false});
 assert.ok(link.some(x=>x.url_context));
 const current=I.getTools({hasLink:false,search:true,calculate:false,simpleCalculation:false});
 assert.equal(current.some(x=>x.google_search),false);
});
test("Hybrid router routes tool and media workloads to capable model lane",()=>{
 const tools=H.decide({task:"research",hasTools:true,available:["gemini","groq","workers_ai","openrouter"]});
 const image=H.decide({task:"general",hasMedia:true,available:["gemini","openrouter"]});
 assert.equal(tools.geminiFirst,true);
 assert.equal(image.geminiFirst,true);
 assert.equal(image.backup,"openrouter");
 const selected=M.select([{id:"groq"},{id:"openrouter"},{id:"workers_ai"}],{images:true});
 assert.deepEqual(selected.map(x=>x.id),["openrouter"]);
});
test("Grounding uses returned provider metadata, not invented links",()=>{
 const c={groundingMetadata:{
  groundingChunks:[{web:{title:"Sumber",uri:"https://example.com/bukti"}}],
  groundingSupports:[{segment:{text:"Fakta A"},groundingChunkIndices:[0]}]
 }};
 const sources=I.sourceList(c),evidence=I.groundingEvidence(c,sources);
 assert.equal(sources[0].url,"https://example.com/bukti");
 assert.deepEqual(evidence[0].sourceIndices,[0]);
 assert.deepEqual(I.sourceList({content:{parts:[{text:"Rekaan sumber"}]}}),[]);
});
test("Structured reply parses JSON with a reply field and leaves literal answers intact",()=>{
 assert.equal(I.parseReply('{"reply":"Jawapan sah"}'),"Jawapan sah");
 assert.equal(I.parseReply("Jawapan biasa"),"Jawapan biasa");
});
test("Research workflow curates only explicitly trusted encyclopedia domains",()=>{
 const out=R.curate([
  {title:"Contoh",url:"https://ms.wikipedia.org/wiki/Contoh",extract:"Penerangan contoh yang agak panjang."},
  {title:"Palsu",url:"https://malicious.example/rujukan",extract:"Claim without real evidence"}
 ]);
 assert.equal(out.length,1);
 assert.equal(out[0].verifiedLive,false);
});
test("Document UI accepts textual CSV and PDF media, but lacks DOCX",()=>{
 assert.ok(html.includes('["txt","md","csv"].includes(ext)'));
 assert.ok(html.includes('if(ext==="pdf")mime="application/pdf"'));
 assert.ok(html.includes('media:selectedFile&&selectedFile.media||null'));
 assert.ok(!html.includes('accept=".docx'));
 assert.ok(!html.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
});
test("Vision routes image data with consent and does not pretend backups handle audio",()=>{
 assert.ok(server.includes("mediaFallback===true"));
 assert.ok(server.includes('["image/jpeg","image/png","image/webp"]'));
 assert.ok(server.includes('code:"CAPABILITY_UNAVAILABLE"'));
 assert.ok(server.includes("Model utama belum available"));
});
test("Owned page reader is allowlisted and never a public arbitrary URL proxy",()=>{
 assert.ok(reader.includes("const PUBLIC_PAGES=new Set"));
 assert.ok(reader.includes("!PUBLIC_PAGES.has(target.pathname)"));
 assert.ok(reader.includes("env.ASSETS.fetch"));
 assert.ok(!reader.includes("fetch(target.href)"));
 assert.ok(cf.includes("ownedPageEvidence(request,env,payload.question)"));
});
test("Cloudflare AI Search is scoped to verified poems, not arbitrary questions",()=>{
 assert.ok(caps.includes("if(!PublicPoetry.poetryIntent(query))return"));
 assert.ok(caps.includes("AKSARA_AI_SEARCH_ENABLED"));
 assert.ok(caps.includes("PublicPoetry.select(query)?.title"));
});
test("Stream and client can surface explicit errors and retry, not blank-success",()=>{
 assert.ok(stream.includes('type:"error"'));
 assert.ok(html.includes("async function askWithReconnect"));
 assert.ok(html.includes("if(!answer||typeof answer.reply"));
 assert.ok(html.includes("if(!stoppedByUser)window.dispatchEvent"));
 assert.ok(server.includes('code:"ALL_PROVIDERS_BUSY"'));
});
test("Unverified external URL fallback states that a real page review did not occur",()=>{
 assert.ok(server.includes("Kandungan URL tidak berjaya dibaca atau disahkan"));
 assert.ok(server.includes("Ini bukan review laman sebenar"));
 assert.ok(server.includes("Jangan minta URL itu sekali lagi"));
});
test("CSV can enter the prompt as text; no dedicated CSV analytics tool is exposed",()=>{
 assert.ok(html.includes('texts.push("[FAIL: "+name+"]'));
 assert.ok(server.includes("const doc=documentText?"));
 assert.equal(Object.keys(T.SCHEMA).includes("csv_analyze"),false);
});
