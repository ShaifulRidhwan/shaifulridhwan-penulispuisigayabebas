"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {boundedHistory,boundedText,readSSE}=require("../netlify/functions/lib/aksara-transport");
const I=require("../netlify/functions/antara-intelligence"),Brain=require("../bilik-antara-brain");
const ORIGIN="https://shaifulridhwan-penulispuisigayabebas.netlify.app";
const savedFetch=global.fetch;
const envKeys=["GEMINI_API_KEY","AKSARA_FREE_FALLBACKS","GROQ_API_KEY","GROQ_FREE_CONFIRMED","MISTRAL_API_KEY","MISTRAL_FREE_CONFIRMED","OPENROUTER_API_KEY"];
function setup(t){
 const old=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{GEMINI_API_KEY:"mock",AKSARA_FREE_FALLBACKS:"true",GROQ_API_KEY:"mock",GROQ_FREE_CONFIRMED:"true"});
 for(const k of ["MISTRAL_API_KEY","OPENROUTER_API_KEY"])delete process.env[k];
 for(const p of ["../netlify/functions/bilik-antara","../netlify/functions/aksara-provider-router"])delete require.cache[require.resolve(p)];
 t.after(()=>{global.fetch=savedFetch;for(const k of envKeys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}});
 return require("../netlify/functions/bilik-antara").handler;
}
function event(payload,extra={}){return {httpMethod:"POST",headers:{origin:ORIGIN,"x-nf-client-connection-ip":Math.random()+"test"},body:JSON.stringify(payload),...extra};}
const reply=text=>new Response(JSON.stringify({choices:[{message:{content:text},finish_reason:"stop"}],model:"mock",usage:{total_tokens:10}}),{headers:{"content-type":"application/json"}});
function sse(chunks){return new Response(chunks.map(x=>"data: "+JSON.stringify(x)+"\n\n").join(""),{headers:{"content-type":"text/event-stream"}});}

test("Malay language questions stay explanatory while personal distress and explicit danger retain support",()=>{
 for(const q of ["Yang kedua tu mesti bermaksud sedih ke? Jawab pendek.","Apa maksud perkataan sedih?","Bezakan sepi dengan sedih"]){const x=I.resolveIntent(q,[],false);assert.equal(x.sensitive,false,q);assert.notEqual(x.task,"support",q);}
 for(const q of ["aku tengah sedih sangat", "Aku sedih, apa maksud hidup aku?", "aku nak bunuh diri", "mak aku meninggal semalam", "sedih sangat"]){assert.equal(I.resolveIntent(q,[],false).sensitive,true,q);}
});
test("long poetry keeps its ending; marked truncation stays inside a total recent-context budget",()=>{
 const poem="AWAL\n"+"rangkap\n".repeat(1600)+"PENUTUP PENTING";
 assert.equal(I.safeHistory([{role:"user",content:poem}])[0].content,poem);
 const cut=boundedText("AWAL"+"x".repeat(40000)+"AKHIR",32000);assert.ok(cut.length<=32000);assert.ok(cut.startsWith("AWAL"));assert.ok(cut.endsWith("AKHIR"));assert.match(cut,/dipendekkan/);
 const rows=boundedHistory(Array.from({length:24},(_,i)=>({role:i%2?"assistant":"user",content:poem})));assert.ok(rows.reduce((n,m)=>n+m.content.length,0)<=120000);
 assert.equal(boundedText("x".repeat(200),12).length,12);
});
test("linguistic follow-up can use the fallback and receives the unchanged complete personality",async t=>{
 const handler=setup(t);let payload;
 global.fetch=async(url,opts)=>{if(url.includes("googleapis"))return new Response("",{status:429});payload=JSON.parse(opts.body);return reply("Tak semestinya sedih.");};
 const r=await handler(event({question:"Yang kedua tu mesti bermaksud sedih ke? Jawab pendek.",history:[{role:"user",content:"Bezakan sunyi dengan sepi"},{role:"assistant",content:"Sunyi berkaitan bunyi; sepi juga berkaitan kesendirian."}]}));
 assert.equal(r.statusCode,200);assert.equal(JSON.parse(r.body).provider,"groq");assert.ok(payload.messages[0].content.includes(Brain.CORE));assert.ok(payload.messages[0].content.includes(Brain.TEXT_DELIVERY));assert.equal(payload.messages.length,4);
});
test("fallback carries summaries, public works and consented memory/text rather than dropping context",async t=>{
 const handler=setup(t);let payload;
 global.fetch=async(url,opts)=>{if(url.includes("googleapis"))return new Response("",{status:503});payload=JSON.parse(opts.body);return reply("Aku semak penutup karya itu.");};
 const r=await handler(event({question:"Perkemas penutup ini",summary:"KEPUTUSAN: jangan ubah tajuk",documentText:"KARYA ASAL\nPENUTUP ASAL",documentName:"puisi.txt",memoryNotes:"Jangan guna hanya",contextFallback:true}));
 assert.equal(r.statusCode,200);const context=payload.messages.at(-1).content;
 for(const expected of ["PENUTUP ASAL","jangan ubah tajuk","Jangan guna hanya"])assert.ok(context.includes(expected));
});
test("private context without consent and unsupported media never silently go to text providers",async t=>{
 const handler=setup(t);let backups=0;
 global.fetch=async url=>{if(!url.includes("googleapis"))backups++;return new Response("",{status:503});};
 for(const payload of [{question:"Semak karya ini",documentText:"private"},{question:"Tolong ikut memori",memoryNotes:"private"},{question:"Lihat gambar",contextFallback:true,media:[{mimeType:"image/png",data:"QUJDRA=="}]}]){
  const r=await handler(event(payload));assert.equal(JSON.parse(r.body).code,"CAPABILITY_UNAVAILABLE");
 }
 assert.equal(backups,0);
});
test("probe distinguishes configuration from a successful model call",async t=>{
 const handler=setup(t);global.fetch=()=>{throw Error("Probe must not make an inference call");};
 const r=JSON.parse((await handler(event({probe:true}))).body);assert.equal(r.connectionState,"configured");assert.equal(r.geminiVerified,false);
});
test("sequential backup attempts obey one deadline and cancellation stops a pending provider",async t=>{
 setup(t);process.env.MISTRAL_API_KEY="mock";process.env.MISTRAL_FREE_CONFIRMED="true";process.env.OPENROUTER_API_KEY="mock";
 const router=require("../netlify/functions/aksara-provider-router");let attempts=0;
 global.fetch=async(_url,{signal})=>{attempts++;return new Promise((_resolve,reject)=>signal.addEventListener("abort",()=>reject(new DOMException("abort","AbortError")),{once:true}));};
 const start=Date.now();await router.complete({system:"persona",history:[],question:"Hai",timeoutMs:600,deadline:Date.now()+1000});assert.equal(attempts,1);assert.ok(Date.now()-start<1100);
 const ctrl=new AbortController();setTimeout(()=>ctrl.abort(),20);
 await assert.rejects(router.complete({system:"persona",history:[],question:"Hai",signal:ctrl.signal,skip:["groq"],deadline:Date.now()+1000}),{name:"AbortError"});
});
test("SSE decodes split UTF-8, CRLF and multiple frames, and rejects upstream error frames",async()=>{
 const bytes=new TextEncoder().encode('data: {"text":"é 🌙"}\r\n\r\ndata: {"text":"akhir"}\n\ndata: [DONE]\n\n');let at=0;const values=[];
 const body=new ReadableStream({pull(c){if(at<bytes.length)c.enqueue(bytes.slice(at,++at));else c.close();}});
 await readSSE(body,x=>values.push(x.text));assert.deepEqual(values,["é 🌙","akhir"]);
 await assert.rejects(readSSE(sse([{error:{message:"no"}}]).body,()=>{}));
});
test("primary streaming hides reasoning and requires a terminal frame",async t=>{
 const handler=setup(t);let chunks=[];
 global.fetch=async()=>sse([{candidates:[{content:{parts:[{text:"hidden",thought:true},{text:"Aku "}]}}]},{candidates:[{content:{parts:[{text:"jawab."}]},finishReason:"STOP"}]}]);
 const r=await handler(event({question:"Hai"},{onDelta:x=>chunks.push(x)}));assert.equal(r.statusCode,200);assert.equal(chunks.join(""),"Aku jawab.");assert.equal(JSON.parse(r.body).reply,"Aku jawab.");
 global.fetch=async()=>sse([{candidates:[{content:{parts:[{text:"separuh"}]}}]}]);
 const failed=await handler(event({question:"Hai"},{onDelta:()=>{}}));assert.equal(JSON.parse(failed.body).code,"STREAM_INTERRUPTED");
});
test("fallback streaming never combines partial responses from different providers",async t=>{
 setup(t);process.env.MISTRAL_API_KEY="mock";process.env.MISTRAL_FREE_CONFIRMED="true";let attempts=0;
 const router=require("../netlify/functions/aksara-provider-router");
 global.fetch=async()=>{attempts++;return sse([{choices:[{delta:{content:"separuh"}}]}]);};
 await assert.rejects(router.complete({system:"persona",history:[],question:"Hai",onDelta:()=>{}}));assert.equal(attempts,1);
});
test("stream endpoint reuses the validated handler and emits a final committed answer",async t=>{
 setup(t);global.fetch=async()=>sse([{candidates:[{content:{parts:[{text:"Hai kau."}]},finishReason:"STOP"}]}]);
 const stream=(await import("../netlify/functions/bilik-antara-stream.mjs")).default;
 const r=await stream(new Request(ORIGIN+"/.netlify/functions/bilik-antara-stream",{method:"POST",headers:{origin:ORIGIN,"content-type":"application/json"},body:JSON.stringify({question:"helo"})}));
 const lines=(await r.text()).trim().split("\n").map(JSON.parse);assert.equal(lines[0].type,"start");assert.ok(lines.some(x=>x.type==="delta"));assert.equal(lines.at(-1).type,"done");assert.equal(lines.at(-1).reply,"Hai kau.");
 const blocked=await stream(new Request(ORIGIN,{method:"POST",headers:{origin:"https://other.example"},body:"{}"}));assert.equal(blocked.status,403);
});
test("client NDJSON failures never trigger a duplicate JSON request; unavailable endpoint does",async()=>{
 const html=fs.readFileSync(path.join(__dirname,"../bilik-antara.html"),"utf8"),start=html.indexOf("let streamAvailable=true;"),end=html.indexOf("async function submit",start);
 const make=new Function("fetch","ReadableStream","STREAM_ENDPOINT","ENDPOINT",html.slice(start,end)+";return ask;");
 let calls=[];
 let ask=make(async url=>{calls.push(url);return new Response('{"type":"error","status":429,"code":"ALL_PROVIDERS_BUSY","error":"Sibuk"}\n',{headers:{"content-type":"application/x-ndjson"}});},ReadableStream,"/stream","/json");
 await assert.rejects(ask({},new AbortController().signal,()=>{}),{code:"ALL_PROVIDERS_BUSY"});assert.deepEqual(calls,["/stream"]);
 calls=[];ask=make(async url=>{calls.push(url);return url==="/stream"?new Response("missing",{status:404}):Response.json({reply:"ok"});},ReadableStream,"/stream","/json");
 assert.equal((await ask({},new AbortController().signal,()=>{})).reply,"ok");assert.deepEqual(calls,["/stream","/json"]);
});
