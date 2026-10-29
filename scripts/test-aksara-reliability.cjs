"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {boundedHistory,boundedText,readSSE}=require("../netlify/functions/lib/aksara-transport");
const I=require("../netlify/functions/antara-intelligence"),Brain=require("../bilik-antara-brain");
const ORIGIN="https://shaifulridhwan-penulispuisigayabebas.netlify.app";
const savedFetch=global.fetch;
const envKeys=["GEMINI_API_KEY","AKSARA_FREE_FALLBACKS","GROQ_API_KEY","GROQ_FREE_CONFIRMED","MISTRAL_API_KEY","MISTRAL_FREE_CONFIRMED","OPENROUTER_API_KEY","GEMINI_MODEL_FAST","GEMINI_MODEL_COMPLEX"];
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
 assert.equal(r.statusCode,200);assert.equal(JSON.parse(r.body).provider,"groq");assert.ok(payload.messages[0].content.includes(Brain.CORE));assert.ok(payload.messages[0].content.includes(Brain.TEXT_DELIVERY));assert.equal(payload.messages.length,5);
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
 setup(t);process.env.OPENROUTER_API_KEY="mock";
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
 const r=await handler(event({question:"Hai"},{onDelta:x=>chunks.push(x)}));assert.equal(r.statusCode,200);assert.equal(chunks.join(""),"Aku jawab.");assert.equal(JSON.parse(r.body).reply,"Aku jawab. 🙂 ✨");
 global.fetch=async()=>sse([{candidates:[{content:{parts:[{text:"separuh"}]}}]}]);
 const failed=await handler(event({question:"Hai"},{onDelta:()=>{}}));assert.equal(JSON.parse(failed.body).code,"STREAM_INTERRUPTED");
});
test("fallback streaming never combines partial responses from different providers",async t=>{
 setup(t);process.env.OPENROUTER_API_KEY="mock";let attempts=0;
 const router=require("../netlify/functions/aksara-provider-router");
 global.fetch=async()=>{attempts++;return sse([{choices:[{delta:{content:"separuh ".repeat(40)}}]}]);};
 await assert.rejects(router.complete({system:"persona",history:[],question:"Hai",onDelta:()=>{}}));assert.equal(attempts,1);
});
test("stream endpoint reuses the validated handler and emits a final committed answer",async t=>{
 setup(t);global.fetch=async()=>sse([{candidates:[{content:{parts:[{text:"Hai kau."}]},finishReason:"STOP"}]}]);
 const stream=(await import("../netlify/functions/bilik-antara-stream.mjs")).default;
 const r=await stream(new Request(ORIGIN+"/.netlify/functions/bilik-antara-stream",{method:"POST",headers:{origin:ORIGIN,"content-type":"application/json"},body:JSON.stringify({question:"helo"})}));
 const lines=(await r.text()).trim().split("\n").map(JSON.parse);assert.equal(lines[0].type,"start");assert.ok(lines.some(x=>x.type==="delta"));assert.equal(lines.at(-1).type,"done");assert.equal(lines.at(-1).reply,"Hai kau. 🙂 ✨");
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

test("a backup that starts responding gets the remaining global budget instead of a five-second body cutoff",async t=>{
 setup(t);const router=require("../netlify/functions/aksara-provider-router");
 let timer,cancelled=false;const chunks=[];
 global.fetch=async(_url,{signal})=>new Response(new ReadableStream({
  start(c){
   const enc=new TextEncoder(),send=x=>c.enqueue(enc.encode("data: "+JSON.stringify(x)+"\n\n"));
   signal.addEventListener("abort",()=>{clearTimeout(timer);c.error(new DOMException("abort","AbortError"));},{once:true});
   send({choices:[{delta:{content:"Aku "}}]});
   timer=setTimeout(()=>{send({choices:[{delta:{content:"selesai."},finish_reason:"stop"}]});},120);
  },cancel(){cancelled=true;clearTimeout(timer);}
 }),{headers:{"content-type":"text/event-stream"}});
 const r=await router.complete({system:"persona",history:[],question:"Soalan",timeoutMs:40,deadline:Date.now()+1000,onDelta:x=>chunks.push(x)});
 assert.equal(r.reply,"Aku selesai.");assert.equal(chunks.join(""),r.reply);assert.equal(cancelled,true);
});
test("a finished SSE response does not need to wait for the provider to close its socket",async()=>{
 const enc=new TextEncoder();let cancelled=0,values=[];
 const body=new ReadableStream({start(c){c.enqueue(enc.encode('data: {"text":"siap"}\n\ndata: [DONE]\n\n'));},cancel(){cancelled++;}});
 await readSSE(body,x=>values.push(x.text));assert.deepEqual(values,["siap"]);assert.equal(cancelled,1);
});
test("interrupted backup response returns a typed error from the main handler instead of throwing to the generic wrapper",async t=>{
 const handler=setup(t);global.fetch=async url=>url.includes("googleapis")?new Response("",{status:503}):sse([{choices:[{delta:{content:"Jawapan separa ".repeat(20)}}]}]);
 const chunks=[];const r=await handler(event({question:"Terangkan warna langit"},{onDelta:x=>chunks.push(x)}));
 assert.equal(r.statusCode,502);assert.equal(JSON.parse(r.body).code,"STREAM_INTERRUPTED");assert.match(JSON.parse(r.body).error,/sandaran/);assert.ok(chunks.length);
});
test("Cuba semula submits the preserved question, checks health only for an empty input, and ignores double clicks while busy",()=>{
 const html=fs.readFileSync(path.join(__dirname,"../bilik-antara.html"),"utf8");
 const start=html.indexOf('ui.retry.addEventListener("click",()=>{'),end=html.indexOf('const providers=',start);
 const make=new Function('ui','busy','fileState','submit','probe',html.slice(start,end));
 const run=(text,busy,file)=>{let listener,submitted=0,probed=0;make({retry:{addEventListener(_n,fn){listener=fn}},input:{value:text}},busy,file,()=>submitted++,()=>probed++);listener();return {submitted,probed};};
 assert.deepEqual(run("siapa shaiful ridhwan",false,null),{submitted:1,probed:0});
 assert.deepEqual(run("",false,null),{submitted:0,probed:1});
 assert.deepEqual(run("",false,{name:"karya.txt"}),{submitted:1,probed:0});
 assert.deepEqual(run("Soalan",true,null),{submitted:0,probed:0});
});

function retryHarness(ask,{offline=false,onPause}={}){
 const html=fs.readFileSync(path.join(__dirname,"../bilik-antara.html"),"utf8");
 const start=html.indexOf('function reconnectable('),end=html.indexOf('async function submit',start);
 let now=1000;const waits=[],nav={onLine:!offline};
 const pause=async(ms,signal)=>{waits.push(ms);now+=ms;onPause?.({signal,nav,waits});if(signal.aborted)throw new DOMException("stop","AbortError");};
 const make=new Function('ask','navigator','Date','wait',html.slice(start,end)+';const actualPause=reconnectPause;reconnectPause=wait;return {askWithReconnect,reconnectable,actualPause};');
 return {...make(ask,nav,{now:()=>now},pause),waits,nav};
}
test("automatic reconnect retries transient failures twice, reuses the same question and replaces partial text before resending",async()=>{
 let calls=0,text="",resets=0;const payload={question:"Soalan asal",history:[{role:"user",content:"Konteks"}]},seen=[];
 const h=retryHarness(async(p,_signal,delta)=>{seen.push(p);calls++;delta(calls<3?"separuh lama":"jawapan baharu");if(calls<3)throw Object.assign(new TypeError("network"),{code:"STREAM_INTERRUPTED"});return {reply:"jawapan baharu"};});
 const result=await h.askWithReconnect(payload,new AbortController().signal,d=>text+=d,()=>{},()=>{resets++;text="";});
 assert.equal(result.reply,"jawapan baharu");assert.equal(calls,3);assert.equal(resets,2);assert.equal(text,"jawapan baharu");assert.ok(seen.every(x=>x===payload));assert.equal(h.waits.reduce((a,b)=>a+b,0),9000);
});
test("reconnect honors API cooldown, stops after the retry limit and never retries validation or unsupported-capability errors",async()=>{
 let calls=0;
 const h=retryHarness(async()=>{calls++;throw Object.assign(new Error("quota"),{status:429,retryAfterSeconds:30});});
 await assert.rejects(h.askWithReconnect({},new AbortController().signal,()=>{},()=>{},()=>{}),{status:429});
 assert.equal(calls,3);assert.equal(h.waits.reduce((a,b)=>a+b,0),60000);
 for(const failure of [Object.assign(new Error("bad"),{status:400}),Object.assign(new Error("blocked"),{status:403}),Object.assign(new Error("unsupported"),{status:503,code:"CAPABILITY_UNAVAILABLE"})]){
  let count=0;const h=retryHarness(async()=>{count++;throw failure;});
  await assert.rejects(h.askWithReconnect({},new AbortController().signal,()=>{},()=>{},()=>{}));assert.equal(count,1);assert.equal(h.waits.length,0);
 }
});
test("Henti cancels a pending reconnect countdown and an already-cancelled request makes no API call",async()=>{
 const ctrl=new AbortController();let calls=0;
 const h=retryHarness(async()=>{calls++;throw new TypeError("offline");},{onPause(){ctrl.abort();}});
 await assert.rejects(h.askWithReconnect({},ctrl.signal,()=>{},()=>{},()=>{}),{name:"AbortError"});assert.equal(calls,1);
 await assert.rejects(h.askWithReconnect({},ctrl.signal,()=>{},()=>{},()=>{}),{name:"AbortError"});assert.equal(calls,1);
 const pausedCtrl=new AbortController(),promise=h.actualPause(10000,pausedCtrl.signal);pausedCtrl.abort();await assert.rejects(promise,{name:"AbortError"});
});
test("reconnect waits for internet recovery instead of repeatedly sending requests while offline",async()=>{
 let calls=0,offlineStatuses=0;
 const h=retryHarness(async()=>{calls++;if(calls===1)throw new TypeError("offline");assert.equal(h.nav.onLine,true);return {reply:"pulih"};},{offline:true,onPause({nav,waits}){if(waits.length===5)nav.onLine=true;}});
 const r=await h.askWithReconnect({},new AbortController().signal,()=>{},({offline})=>{if(offline)offlineStatuses++;},()=>{});
 assert.equal(r.reply,"pulih");assert.equal(calls,2);assert.ok(offlineStatuses>=5);assert.equal(h.waits.reduce((a,b)=>a+b,0),5000);
});
test("a truncated or malformed client stream is marked retryable even when the HTTP connection closes normally",async()=>{
 const html=fs.readFileSync(path.join(__dirname,"../bilik-antara.html"),"utf8"),start=html.indexOf("let streamAvailable=true;"),end=html.indexOf("function reconnectable",start);
 const make=new Function("fetch","ReadableStream","STREAM_ENDPOINT","ENDPOINT",html.slice(start,end)+";return ask;");
 for(const body of ['{"type":"start"}\n{"type":"delta","text":"separuh"}\n','{"type":"start"}\n{broken}\n']){
  const ask=make(async()=>new Response(body,{headers:{"content-type":"application/x-ndjson"}}),ReadableStream,"/stream","/json");
  await assert.rejects(ask({},new AbortController().signal,()=>{}),{code:"STREAM_INTERRUPTED",status:502});
 }
});
test("classifier-only output is rejected before display and a conversational provider can answer instead",async t=>{
 setup(t);process.env.OPENROUTER_API_KEY="mock";
 const router=require("../netlify/functions/aksara-provider-router");const displayed=[];
 global.fetch=async url=>url.includes("groq.com")?sse([{model:"example/guard",choices:[{delta:{content:"User Safety: safe\nResponse Safety: safe"},finish_reason:"stop"}]}]):reply("Aku Aksara A.I.");
 const r=await router.complete({system:"persona",history:[],question:"siapa kau ek",onDelta:x=>displayed.push(x)});
 assert.equal(r.provider,"openrouter");assert.equal(r.reply,"Aku Aksara A.I.");assert.ok(!displayed.join("").includes("User Safety"));
});
test("classifier labels from an ordinary-looking model are also rejected, while a normal safety refusal remains valid",async t=>{
 setup(t);const router=require("../netlify/functions/aksara-provider-router"),displayed=[];
 global.fetch=async()=>sse([{model:"mock-chat",choices:[{delta:{content:"User Safety: safe\nResponse Safety: safe"},finish_reason:"stop"}]}]);
 const bad=await router.complete({system:"persona",history:[],question:"Hai",onDelta:x=>displayed.push(x)});
 assert.equal(bad.error,"all_providers_unavailable");assert.equal(displayed.length,0);
});
test("OpenRouter chat requests specify only reviewed free chat models and validate a JSON response",async t=>{
 setup(t);delete process.env.GROQ_API_KEY;process.env.OPENROUTER_API_KEY="mock";
 const router=require("../netlify/functions/aksara-provider-router");let body;const displayed=[];
 global.fetch=async(_url,opts)=>{body=JSON.parse(opts.body);return reply("Aku tak boleh bantu perbuatan itu, tetapi aku boleh cadangkan pilihan yang selamat.");};
 const r=await router.complete({system:"persona",history:[],question:"Soalan",onDelta:x=>displayed.push(x)});
 assert.equal(r.provider,"openrouter");assert.equal(body.model,undefined);assert.equal(body.stream,true);assert.equal(body.models.length,3);assert.ok(body.models.every(x=>x.endsWith(":free")&&!/guard|classifier|moderation/.test(x)));assert.equal(displayed.join(""),r.reply);
});
test("colloquial identity questions use the existing grounded Aksara introduction",async t=>{
 const handler=setup(t);global.fetch=()=>{throw Error("Identity must not need a provider");};
 for(const question of ["siapa kau ek","kau siapa weh?","siapa kau sebenarnya eh?"]){
  const r=await handler(event({question}));assert.equal(r.statusCode,200,question);const data=JSON.parse(r.body);assert.equal(data.model,"project-identity");assert.match(data.reply,/Aksara A\.I\./);assert.doesNotMatch(data.reply,/User Safety:/);
 }
});
test("non-streaming OpenRouter clients get the full-answer budget",async t=>{
 setup(t);delete process.env.GROQ_API_KEY;process.env.OPENROUTER_API_KEY="mock";
 const router=require("../netlify/functions/aksara-provider-router");let calls=0;
 global.fetch=async(_url,{signal})=>{calls++;return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>resolve(reply("Jawapan lengkap yang mengambil masa sedikit lebih lama.")),100);
  signal.addEventListener("abort",()=>{clearTimeout(timer);reject(new DOMException("abort","AbortError"));},{once:true});
 });};
 const r=await router.complete({system:"persona",history:[],question:"Kenapa langit biru?",timeoutMs:30,bufferedTimeoutMs:600,deadline:Date.now()+1000});
 assert.equal(r.provider,"openrouter");assert.match(r.reply,/Jawapan lengkap/);assert.equal(calls,1);
});
test("direct founder biography needs no external model call but follow-up discussion stays generative",async t=>{
 const handler=setup(t);global.fetch=()=>{throw Error("No inference needed");};
 const r=await handler(event({question:"siapa shaiful ridhwan"}));assert.equal(r.statusCode,200);const d=JSON.parse(r.body);assert.equal(d.model,"project-identity");assert.match(d.reply,/The Coder Poet/);
 assert.equal(require("../bilik-antara-identity").answerIdentity("Kenapa Shaiful gabungkan puisi dengan kod?"),null);
});
test("a session's last successful provider is tried directly, without waiting for Gemini to fail first",async t=>{
 const handler=setup(t);process.env.OPENROUTER_API_KEY="mock";const requests=[];
 global.fetch=async url=>{requests.push(url);assert.ok(url.includes("openrouter.ai"));return reply("Atom ialah unit asas jirim.");};
 const r=await handler(event({question:"Apa itu atom?",preferredProvider:"openrouter"}));assert.equal(r.statusCode,200);assert.equal(JSON.parse(r.body).provider,"openrouter");assert.equal(requests.length,1);
});
test("provider preference cannot bypass consent for private context, and a failed preferred provider still falls back",async t=>{
 const handler=setup(t);process.env.OPENROUTER_API_KEY="mock";let backups=0,google=0;
 global.fetch=async url=>{if(url.includes("openrouter")){backups++;return new Response("",{status:503});}if(url.includes("groq.com"))return reply("Jawapan daripada Groq.");google++;return Response.json({candidates:[{content:{parts:[{text:"Jawapan daripada Gemini."}]},finishReason:"STOP"}]});};
 const privateReply=await handler(event({question:"Ringkaskan fail",documentText:"teks peribadi",preferredProvider:"openrouter"}));assert.equal(privateReply.statusCode,200);assert.equal(backups,0);
 const fallback=await handler(event({question:"Apa itu graviti?",preferredProvider:"openrouter"}));assert.equal(fallback.statusCode,200);assert.equal(backups,1);assert.equal(google,1);assert.equal(JSON.parse(fallback.body).provider,"groq");
});
test("short conversational follow-ups use bounded output and low reasoning, while complex work keeps its larger budget",async t=>{
 setup(t);const router=require("../netlify/functions/aksara-provider-router");let payload;
 global.fetch=async(_url,opts)=>{payload=JSON.parse(opts.body);return reply("Contoh mudah.");};
 await router.complete({system:"persona",history:[],question:"Bagi contoh",task:"explain",reasoningLevel:"medium",maxTokens:5600});assert.equal(payload.max_tokens,1500);assert.equal(payload.reasoning_effort,"low");
 await router.complete({system:"persona",history:[],question:"Analisis kod",task:"technical",reasoningLevel:"high",maxTokens:6000});assert.equal(payload.max_tokens,6000);assert.equal(payload.reasoning_effort,"high");
});
test("loaded project facts answer immediately in the browser without a network call, while attachments still reach the server",async()=>{
 const html=fs.readFileSync(path.join(__dirname,"../bilik-antara.html"),"utf8"),start=html.indexOf("let streamAvailable=true;"),end=html.indexOf("function reconnectable",start);
 const make=new Function("fetch","ReadableStream","STREAM_ENDPOINT","ENDPOINT","window",html.slice(start,end)+";return ask;");
 let calls=0;const ask=make(async()=>{calls++;return new Response('{"type":"done","reply":"Analisis fail","model":"mock"}\n',{headers:{"content-type":"application/x-ndjson"}});},ReadableStream,"/stream","/json",{BilikAntaraIdentity:require("../bilik-antara-identity")});
 const direct=await ask({question:"siapa shaiful ridhwan"},new AbortController().signal,()=>{});assert.equal(direct.model,"project-identity");assert.match(direct.reply,/The Coder Poet/);assert.equal(calls,0);
 const attached=await ask({question:"siapa shaiful ridhwan",media:[{mimeType:"image/png",data:"mock"}]},new AbortController().signal,()=>{});assert.equal(attached.reply,"Analisis fail");assert.equal(calls,1);
});
test("short acknowledgements stay on the last conversational turn instead of inheriting founder stories or technical tasks",()=>{
 const h=[{role:"user",content:"siapa buat bilik antara no"},{role:"assistant",content:"Shaiful Ridhwan yang membangunkan Bilik Antara."}];
 for(const question of ["ooo","ohh","hmm","ok","faham","haha"]){const intent=I.resolveIntent(question,h,false);assert.equal(intent.reaction,true,question);assert.equal(intent.task,"conversation");assert.equal(intent.depth,"low");assert.equal(intent.search,false);assert.equal(intent.works,false);}
 assert.notEqual(I.resolveIntent("Jelaskan lagi kenapa dia buat sistem ini",h,false).reaction,true);
 assert.notEqual(I.resolveIntent("ooo",h,true).reaction,true,"Attachments must still be analysed");
 assert.equal(I.resolveIntent("ooo",[{role:"user",content:"Aku sedih sangat"},{role:"assistant",content:"Aku dengar."}],false).task,"support");
});
test("reaction guidance reaches the chosen provider together with the actual previous dialogue",async t=>{
 const handler=setup(t);let request;
 global.fetch=async(_url,opts)=>{request=JSON.parse(opts.body);return reply("Haa, dia yang bangunkan ruang ni.");};
 const history=[{role:"user",content:"siapa buat bilik antara no"},{role:"assistant",content:"Shaiful Ridhwan yang membangunkan Bilik Antara."}];
 const r=await handler(event({question:"ooo",history,preferredProvider:"groq"}));assert.equal(r.statusCode,200);assert.match(request.messages.filter(x=>x.role==="system").map(x=>x.content).join("\n"),/REAKSI PENDEK PADA GILIRAN TERAKHIR/);assert.equal(request.messages.at(-2).content,history[1].content);assert.equal(request.reasoning_effort,"low");
});
test("a follow-up retains dialogue and Aksara's personality when a provider fails over",async t=>{
 const handler=setup(t);let googleBody;
 global.fetch=async(url,opts)=>{
  if(url.includes("groq.com"))return new Response("",{status:503});
  googleBody=JSON.parse(opts.body);
  return Response.json({candidates:[{content:{parts:[{text:"Supaya ada pilihan bila model sibuk."}]},finishReason:"STOP"}]});
 };
 const history=[{role:"user",content:"Siapa Aku"},{role:"assistant",content:require("../bilik-antara-identity").answerIdentity("Siapa Aku")}];
 const response=await handler(event({question:"Kenapa?",history,preferredProvider:"groq"}));
 const result=JSON.parse(response.body);
 assert.equal(response.statusCode,200);assert.equal(result.provider,"gemini");
 assert.equal(googleBody.contents[0].parts[0].text,"Siapa Aku");
 assert.equal(googleBody.contents[1].parts[0].text,history[1].content);
 assert.match(googleBody.systemInstruction.parts[0].text,/mwehehe/i);
 assert.match(googleBody.systemInstruction.parts[0].text,/jangan reka atau meneka kejadian, tabiat, emosi, tidur/i);
});
test("creator humour is generated with a reminder not to invent private habits",async t=>{
 const handler=setup(t);let request;
 global.fetch=async(_url,opts)=>{request=JSON.parse(opts.body);return reply("Puisi bebas, tapi rangkap pun ada grid. Mwehehe. 😈📜");};
 const response=await handler(event({question:"Usik sikit pencipta kau secara santai",preferredProvider:"groq"}));
 assert.equal(response.statusCode,200);assert.equal(JSON.parse(response.body).provider,"groq");
 const system=request.messages.filter(m=>m.role==="system").map(m=>m.content).join("\n");
 assert.match(system,/USIKAN BERASASKAN FAKTA/);assert.match(system,/Jangan cipta atau meneka tabiat, waktu tidur/);
});
test("accepting an offered action is not downgraded to a mere acknowledgement",()=>{
 const history=[{role:"user",content:"Tolong bantu tulis puisi"},{role:"assistant",content:"Nak aku buat versi empat rangkap?"}];
 assert.notEqual(I.resolveIntent("ok",history,false).reaction,true);assert.notEqual(I.resolveIntent("ya",history,false).reaction,true);
 assert.equal(I.resolveIntent("ooo",history,false).reaction,true);
});
test("plain acknowledgements do not inherit canned laughter or an automatic invitation to ask another question",async t=>{
 const handler=setup(t);global.fetch=async()=>reply("Haha, faham. Ada apa-apa lagi nak tanya?");
 const r=await handler(event({question:"ooo",history:[{role:"user",content:"siapa buat bilik antara no"},{role:"assistant",content:"Shaiful Ridhwan yang membangunkan Bilik Antara."}],preferredProvider:"groq"}));
 assert.equal(r.statusCode,200);const text=JSON.parse(r.body).reply;assert.match(text,/faham/i);assert.doesNotMatch(text,/haha|apa-apa lagi|nak tanya/i);
});
test("a short acknowledgement after a known identity answer uses the model and previous conversation",async t=>{
 const handler=setup(t),ID=require("../bilik-antara-identity");let calls=0,request;global.fetch=async(_url,opts)=>{calls++;request=JSON.parse(opts.body);return reply("Haa, dia yang bangunkan ruang ni.");};
 const question="siapa buat bilik antara no",history=[{role:"user",content:question},{role:"assistant",content:ID.answerIdentity(question)}];
 const r=await handler(event({question:"ooo",history,preferredProvider:"groq"}));
 assert.equal(r.statusCode,200);assert.equal(JSON.parse(r.body).provider,"groq");assert.equal(calls,1);
 assert.equal(request.messages.at(-2).content,history[1].content);
 assert.equal(request.messages.at(-1).content,"ooo");
});

test("chat enforces two complete emoji graphemes and preserves literal code",()=>{
 const style=require("../bilik-antara-chat-style");
 for(const value of ["Hai.","Hai 🙂", "Hai 👨‍👩‍👧‍👦 🇲🇾 👍🏽 😀", "Nombor 1 dan 2 bukan emoji.","Tekan 1️⃣ 2️⃣ 3️⃣"]){
  const reply=style.reply(value);assert.equal(style.count(reply),2);assert.equal(style.reply(reply),reply);
 }
 assert.equal(style.reply(""),"");
 assert.equal(style.reply("Hai",{complete:false}),"Hai");
 const code='```js\nconst icons = "😀 😄 😁";\n```';
 assert.ok(style.reply(code).includes(code),"Source literals remain exact");
 assert.equal(style.count(style.reply("Aku faham kau sedang sedih.")),2);
 assert.ok(!style.reply("Aku faham kau sedang sedih.").includes("🙂"));
});
test("emoji formatting preserves grounded identity follow-up continuity",()=>{
 const ID=require("../bilik-antara-identity"),style=require("../bilik-antara-chat-style");
 const question="siapa buat bilik antara no";
 const history=[{role:"user",content:question},{role:"assistant",content:style.reply(ID.answerIdentity(question))}];
 assert.equal(style.count(history[1].content),2);
 assert.equal(I.resolveIntent("ooo",history,false).reaction,true);
});
test("opening the page tests providers before showing Connected and never installs message actions",async()=>{
 const html=fs.readFileSync(path.join(__dirname,"../bilik-antara.html"),"utf8");
 assert.match(html,/restore\(\);renderIdeas\(\);renderHistory\(\);update\(\);probe\(\);/);
 assert.match(html,/async function probe\(\)\{[\s\S]*?return checkProviders\(true\)/);
 const source=html.slice(html.indexOf("async function checkProviders("),html.indexOf('ui.conn.addEventListener("click"'));
 let resolve,requests=[],states=[];
 const pending=new Promise(done=>resolve=done);
 const run=new Function("fetch","status","renderProviderRows","el","multiChecked","ENDPOINT",'let busy=false,multiChecking=false,multiLastCheck=0,connectionRevision=0,lastProvider="",lastProviderAt=0;const providers=[["gemini"],["groq"]];'+source+';return checkProviders;')(
  async(_url,opts)=>{requests.push(JSON.parse(opts.body));return pending;},(...args)=>states.push(args),()=>{},()=>({}),{},"/mock"
 );
 const waiting=run(true);
 assert.equal(requests[0].providerStatus,true);
 assert.ok(!states.some(x=>x[1]==="Multi A.I Connected"));
 resolve({ok:true,json:async()=>({providers:[{id:"groq",status:"online"}],someOnline:true})});await waiting;
 assert.ok(states.some(x=>x[0]==="ready"&&x[1]==="Multi A.I Connected"));
 const suite=fs.readFileSync(path.join(__dirname,"../bilik-antara-suite.js"),"utf8");
 assert.doesNotMatch(suite,/function quickActions|bubble\.appendChild\(row\)/);
 assert.match(html,/if\(data\.disclaimer\)/,"Fallback provenance is retained");
});

test("first ordinary text turn selects a configured chat provider without waiting for Google",async t=>{
 const handler=setup(t),calls=[];let payload;
 global.fetch=async(url,options)=>{calls.push(url);payload=JSON.parse(options.body);assert.ok(url.includes("groq.com"));return reply("Sambungan terus.");};
 const r=await handler(event({question:"Aku cuma datang nak borak."}));
 assert.equal(r.statusCode,200);assert.equal(calls.length,1);
 assert.ok(payload.messages[0].content.includes(Brain.CORE),"Keep the whole intentional personality");
 const identity=require("../bilik-antara-identity");
 assert.ok(!payload.messages[0].content.includes(identity.PROMPT),"An unrelated chat must not carry the full creator dossier");
 assert.ok(JSON.parse(r.body).timings.systemChars<19000);
});
test("a founder acknowledgement is generated from the actual previous dialogue",async t=>{
 const handler=setup(t),ID=require("../bilik-antara-identity"),style=require("../bilik-antara-chat-style");
 let request;global.fetch=async(_url,opts)=>{request=JSON.parse(opts.body);return reply("Haa, penulisan dan coding bertemu dalam projek yang sama.");};
 const q="siapa shaiful ridhwan",history=[{role:"user",content:q},{role:"assistant",content:style.reply(ID.answerIdentity(q))}];
 const r=JSON.parse((await handler(event({question:"menarik",history,preferredProvider:"groq"}))).body);
 assert.equal(r.provider,"groq");assert.match(r.reply,/penulisan dan coding/);assert.equal(style.count(r.reply),2);
 assert.equal(request.messages.at(-2).content,history[1].content);
});
test("Malay casual wording does not accidentally require a calculator or current-news provider",()=>{
 for(const q of ["Aku kira dia memang macam tu", "Aku lapar sekarang", "Cerita kau berharga", "Menarik juga."]){
  const intent=I.resolveIntent(q,[],false);assert.equal(intent.search,false,q);assert.equal(intent.calculate,false,q);
 }
 const basic=I.resolveIntent("Kira 18 + 24",[],false);assert.equal(basic.simpleCalculation,true);assert.deepEqual(I.getTools(basic),[]);
 assert.ok(I.getTools(I.resolveIntent("Kirakan integral x kuasa dua",[],false)).some(x=>x.code_execution));
 assert.equal(I.resolveIntent("menarik",[],false).reaction,true);
 assert.ok(!I.resolveIntent("menarik?",[],false).reaction);
});
test("accepting an offer still executes it when two emoji follow the question",()=>{
 const history=[{role:"user",content:"Terangkan graviti"},{role:"assistant",content:"Graviti menarik jirim. Nak aku beri contoh? 🙂 ✨"}];
 const intent=I.resolveIntent("ok",history,false);
 assert.equal(intent.acceptingOffer,true);assert.equal(intent.task,"explain");assert.ok(!intent.reaction);
});
test("a short streamed reply reaches the reader before its terminal event",async t=>{
 setup(t);const router=require("../netlify/functions/aksara-provider-router");let end,displayed=[];
 const body=new ReadableStream({start(controller){
  controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify({model:"chat",choices:[{delta:{content:"Haa, betul."}}]})+'\n\n'));
  end=()=>{controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify({choices:[{delta:{},finish_reason:"stop"}]})+'\n\n'));controller.close();};
 }});
 global.fetch=async()=>new Response(body,{headers:{"content-type":"text/event-stream"}});
 const pending=router.complete({system:"persona",history:[],question:"Hai",onDelta:x=>displayed.push(x)});
 for(let i=0;i<25;i++)await Promise.resolve();
 assert.equal(displayed.join(""),"Haa, betul.","Do not hold a short answer until 160 characters or completion");
 end();assert.equal((await pending).reply,"Haa, betul.");
});
test("buffered Groq gets the full response budget, not a streaming first-token deadline",async t=>{
 setup(t);const router=require("../netlify/functions/aksara-provider-router");
 global.fetch=async(_url,{signal})=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>resolve(reply("Jawapan lengkap.")),80);
  signal.addEventListener("abort",()=>{clearTimeout(timer);reject(new DOMException("abort","AbortError"));},{once:true});
 });
 const answer=await router.complete({system:"persona",history:[],question:"Soalan",timeoutMs:20,bufferedTimeoutMs:500,deadline:Date.now()+1000});
 assert.equal(answer.provider,"groq");assert.equal(answer.reply,"Jawapan lengkap.");
});
test("provider Retry-After is propagated and a failed provider is not attempted twice",async t=>{
 const handler=setup(t);let groq=0,google=0;
 global.fetch=async url=>{if(url.includes("groq.com")){groq++;return new Response("",{status:429,headers:{"retry-after":"7"}});}google++;return new Response("",{status:429});};
 const r=await handler(event({question:"Aku cuma nak borak"})),data=JSON.parse(r.body);
 assert.equal(r.statusCode,503);assert.equal(data.code,"ALL_PROVIDERS_BUSY");assert.equal(groq,1);assert.equal(google,1);
 assert.ok(data.retryAfterSeconds>0&&data.retryAfterSeconds<=7);assert.equal(data.providerFailures[0].status,429);assert.equal(data.providerFailures[0].reason,"rate_limit");
});
test("health checks are coalesced and do not consume the conversation request limit",async t=>{
 const handler=setup(t);let calls=0;
 global.fetch=async url=>{calls++;return url.includes("groq.com")?reply("OK"):Response.json({candidates:[{content:{parts:[{text:"OK"}]}}]});};
 const request=event({providerStatus:true});request.headers["x-nf-client-connection-ip"]="shared-health-test";
 const results=await Promise.all([handler(request),handler(request),handler(request),handler(request),handler(request),handler(request)]);
 assert.ok(results.every(r=>r.statusCode===200));assert.equal(calls,2,"One Google and one Groq health request shared by all openings");
 assert.equal(JSON.parse(results[0].body).someOnline,true);assert.ok(JSON.parse(results[0].body).preferredProvider);
 const chat=event({question:"siapa kau"});chat.headers=request.headers;
 assert.equal((await handler(chat)).statusCode,200,"Health traffic cannot consume chat capacity");
});
test("a failed Google network path can still use the healthy chat provider",async t=>{
 const handler=setup(t),calls=[];
 global.fetch=async url=>{calls.push(url);if(url.includes("googleapis"))throw new TypeError("network");return reply("Aku boleh jawab.");};
 const r=await handler(event({question:"Apa itu atom?",preferredProvider:"gemini"}));
 assert.equal(r.statusCode,200);assert.equal(JSON.parse(r.body).provider,"groq");assert.equal(calls.length,2);
});
test("code fences and explicit JSON reply envelopes keep distinct meanings",()=>{
 const code='```python\nprint("Hai")\n```';assert.equal(I.parseReply(code),code);
 const json='```json\n{"reply":"Hai"}\n```';assert.equal(I.parseReply(json),"Hai");
 assert.equal(I.parseReply('```json\n{"answer": 42}\n```'),'```json\n{"answer": 42}\n```');
});
test("complexity alone does not silently add another model review",()=>{
 const long="Terangkan bagaimana algoritma komputer memproses data. "+"Beri penerangan lengkap dengan contoh. ".repeat(10);
 const ordinary=I.resolveIntent(long,[],false);assert.equal(ordinary.depth,"high");assert.equal(ordinary.review,false);
 assert.equal(I.resolveIntent("Semak ketepatan analisis mendalam algoritma ini",[],false).review,true);
});

test("OpenRouter health leaves room for visible text rather than spending the whole probe on reasoning",async t=>{
 setup(t);delete process.env.GROQ_API_KEY;process.env.OPENROUTER_API_KEY="mock";
 const router=require("../netlify/functions/aksara-provider-router");let body;
 global.fetch=async(_url,options)=>{body=JSON.parse(options.body);return reply("OK");};
 const rows=await router.checkStatus();assert.equal(rows.find(x=>x.id==="openrouter").status,"online");
 assert.equal(body.max_tokens,512);assert.equal(body.reasoning.effort,"low");assert.equal(body.reasoning.exclude,true);
});
test("the stream watchdog sends a terminal error and cancels a hung upstream",async()=>{
 const source=fs.readFileSync(path.join(__dirname,"../netlify/functions/bilik-antara-stream.mjs"),"utf8").replace(/^import main[^\n]*\n/,"").replace("export default async function", "return async function");
 let trigger,upstreamSignal;
 const stream=new Function("main","setTimeout","clearTimeout",source)(
  {handler:async event=>{upstreamSignal=event.signal;return new Promise(()=>{});}},
  (callback,delay)=>{assert.equal(delay,26000);trigger=callback;return 1;},()=>{}
 );
 const response=await stream(new Request(ORIGIN,{method:"POST",headers:{origin:ORIGIN},body:'{"question":"ujian"}'}));
 const reader=response.body.getReader(),decoder=new TextDecoder();
 assert.equal(JSON.parse(decoder.decode((await reader.read()).value)).type,"start");
 trigger();
 const terminal=JSON.parse(decoder.decode((await reader.read()).value));
 assert.equal(terminal.type,"error");assert.equal(terminal.status,504);assert.equal(upstreamSignal.aborted,true);
 assert.equal((await reader.read()).done,true);
});
test("upstream RetryInfo is honored and an existing Google cooldown is never extended by another user question",async t=>{
 const handler=setup(t);let now=100000,google=0;
 t.mock.method(Date,"now",()=>now);
 global.fetch=async url=>{
  if(url.includes("groq.com"))return new Response("",{status:429,headers:{"retry-after":"2"}});
  google++;
  if(google===1)return Response.json({error:{details:[{"@type":"type.googleapis.com/google.rpc.RetryInfo",retryDelay:"2s"}]}},{status:429});
  return Response.json({candidates:[{content:{parts:[{text:"Sambungan pulih."}]},finishReason:"STOP"}]});
 };
 const payload={question:"Apa itu atom?",preferredProvider:"gemini"};
 await handler(event(payload));now+=1500;await handler(event(payload));
 assert.equal(google,1,"Do not call a quota-limited provider before its wait expires");
 now+=601;const response=await handler(event(payload));
 assert.equal(google,2,"A repeated question must not push a two-second wait forward by two minutes");assert.equal(response.statusCode,200);
});
test("failed provider chains stop at the first-response budget instead of consuming the whole answer deadline",async t=>{
 setup(t);process.env.OPENROUTER_API_KEY="mock";
 const router=require("../netlify/functions/aksara-provider-router");let now=100000,calls=0;
 t.mock.method(Date,"now",()=>now);
 global.fetch=async()=>{calls++;now+=200;return new Response("",{status:503});};
 await router.complete({system:"persona",history:[],question:"Hai",deadline:now+5000,firstResponseDeadline:now+600});
 assert.equal(calls,1,"Preserve time to report failure or try the primary; don't run a chain until platform timeout");
});

test("free multilingual OpenRouter text streams early and never exposes a reasoning delta",async t=>{
 setup(t);delete process.env.GROQ_API_KEY;process.env.OPENROUTER_API_KEY="mock";
 const router=require("../netlify/functions/aksara-provider-router");let body;const displayed=[];
 global.fetch=async(_url,options)=>{
  body=JSON.parse(options.body);
  return sse([{model:"google/gemma-4-31b-it:free",choices:[{delta:{reasoning:"hidden planning"}}]},
   {choices:[{delta:{content:"Aku dengar."}}]},{choices:[{delta:{},finish_reason:"stop"}]}]);
 };
 const response=await router.complete({system:"persona",history:[],question:"Hai",onDelta:x=>displayed.push(x)});
 assert.equal(body.models[0],"google/gemma-4-31b-it:free");assert.equal(body.stream,true);
 assert.equal(response.provider,"openrouter");assert.equal(displayed.join(""),"Aku dengar.");
});

test("the unchanged personality is a stable first system message across tasks",async t=>{
 const handler=setup(t),systems=[];
 global.fetch=async(_url,options)=>{const body=JSON.parse(options.body);systems.push(body.messages.filter(x=>x.role==="system"));return reply("Jawapan sah.");};
 await handler(event({question:"Aku cuma nak borak."}));
 await handler(event({question:"Kenapa API kadang lambat?"}));
 assert.equal(systems[0].length,2);assert.equal(systems[0][0].content,systems[1][0].content);
 assert.ok(systems[0][0].content.includes(Brain.CORE));assert.notEqual(systems[0][1].content,systems[1][1].content);
});
test("daily free-provider exhaustion is distinguished from a short token window",async t=>{
 const handler=setup(t);process.env.OPENROUTER_API_KEY="mock";
 global.fetch=async url=>url.includes("openrouter")?Response.json({error:{code:429,message:"Rate limit exceeded: free-models-per-day"}},{status:429}):url.includes("googleapis")?new Response("",{status:429}):reply("Aku boleh jawab.");
 const response=JSON.parse((await handler(event({question:"Aku datang nak borak.",preferredProvider:"openrouter"}))).body);
 assert.equal(response.provider,"groq");assert.equal(response.routing.failedAttempts[0].quotaKind,"daily");
 assert.equal(response.routing.failedAttempts[0].retryAfterSeconds,300);
});

test("cached health cannot claim a quota-blocked provider is still online",async t=>{
 setup(t);const router=require("../netlify/functions/aksara-provider-router");
 let calls=0;
 global.fetch=async()=>{calls++;return reply("OK");};
 const first=await router.checkStatus();
 assert.equal(first.find(x=>x.id==="groq").status,"online");
 global.fetch=async()=>{calls++;return Response.json({error:{message:"Requests per minute exceeded"}},{status:429,headers:{"retry-after":"11"}});};
 const failed=await router.complete({system:"persona",history:[],question:"Hai",only:["groq"],deadline:Date.now()+1000});
 assert.equal(failed.error,"all_providers_unavailable");
 const current=await router.checkStatus();
 const groq=current.find(x=>x.id==="groq");
 assert.equal(groq.status,"offline");
 assert.equal(groq.reason,"cooldown");
 assert.ok(groq.retryAfterSeconds>0&&groq.retryAfterSeconds<=11);
 assert.equal(calls,2,"A cached health refresh does not consume a third completion");
});
test("a brief health probe never displaces a model that completed a real conversation",async t=>{
 setup(t);process.env.OPENROUTER_API_KEY="mock";
 const router=require("../netlify/functions/aksara-provider-router");
 global.fetch=async url=>{
  if(url.includes("openrouter.ai"))await new Promise(resolve=>setTimeout(resolve,20));
  return reply("OK");
 };
 const first=await router.complete({system:"persona",history:[],question:"Hai",only:["openrouter"],deadline:Date.now()+1500});
 assert.equal(first.provider,"openrouter");
 const health=await router.checkStatus();
 assert.equal(health.find(x=>x.id==="groq").status,"online");
 assert.equal(health.find(x=>x.id==="openrouter").status,"online");
 const next=await router.complete({system:"persona",history:[],question:"Sambung cerita",task:"technical",deadline:Date.now()+1500});
 assert.equal(next.provider,"openrouter","Routing follows a real successful response rather than a shorter OK probe");
});
test("health check treats a daily free-tier quota as unavailable without immediately probing again",async t=>{
 setup(t);const router=require("../netlify/functions/aksara-provider-router");
 let attempts=0;
 global.fetch=async()=>{attempts++;return Response.json({error:{message:"Rate limit: free-models-per-day"}},{status:429});};
 const status=await router.checkStatus();
 const groq=status.find(x=>x.id==="groq");
 assert.equal(groq.status,"offline");assert.equal(groq.quotaKind,"daily");
 assert.ok(groq.retryAfterSeconds>=3500);
 const again=await router.checkStatus();
 assert.equal(again.find(x=>x.id==="groq").status,"offline");
 assert.equal(attempts,1);
});

test("a ready provider wins the retry countdown over other providers still in cooldown",async t=>{
 const handler=setup(t);process.env.OPENROUTER_API_KEY="mock";
 let now=100000,groq=0;t.mock.method(Date,"now",()=>now);
 global.fetch=async url=>{
  if(url.includes("groq.com")){groq++;return new Response("",{status:429,headers:{"retry-after":groq===1?"2":"1"}});}
  if(url.includes("openrouter.ai"))return new Response("",{status:429,headers:{"retry-after":"30"}});
  now+=3000;throw new DOMException("primary timed out","AbortError");
 };
 const r=await handler(event({question:"Aku cuma nak borak"})),data=JSON.parse(r.body);
 assert.equal(r.statusCode,503);assert.equal(data.retryAfterSeconds,1);
 assert.equal(groq,2,"Only one lawful recovery attempt after the first wait expires");
});
test("a quota-limited chat provider can recover in the same request once its real wait expires",async t=>{
 const handler=setup(t);let now=100000,calls=0;t.mock.method(Date,"now",()=>now);
 global.fetch=async url=>{
  if(url.includes("groq.com")){
   calls++;
   return calls===1?new Response("",{status:429,headers:{"retry-after":"2"}}):reply("Sambungan sudah pulih.");
  }
  now+=3000;throw new DOMException("primary timed out","AbortError");
 };
 const r=await handler(event({question:"Apa itu atom?"})),data=JSON.parse(r.body);
 assert.equal(r.statusCode,200);assert.equal(data.provider,"groq");assert.equal(calls,2);
 assert.match(data.reply,/pulih/);assert.equal(data.routing.failedAttempts[0].status,429);
});

test("a technical topic still follows the user's explanatory goal instead of inventing a coding task",()=>{
 assert.equal(I.resolveIntent("Kenapa sistem API boleh jadi lambat?",[],false).task,"explain");
 assert.equal(I.resolveIntent("Terangkan maksud database",[],false).task,"explain");
 assert.equal(I.resolveIntent("Baiki API yang lambat ini",[],false).task,"technical");
 assert.equal(I.resolveIntent("Semak ketepatan analisis mendalam algoritma ini",[],false).task,"technical");
});
test("math concepts do not require a code-only model, while explicit computations retain execution",()=>{
 const concept=I.resolveIntent("Apa itu integral?",[],false);assert.equal(concept.task,"explain");assert.equal(concept.calculate,false);assert.deepEqual(I.getTools(concept),[]);
 const why=I.resolveIntent("Kenapa 2+2 jadi 4?",[],false);assert.equal(why.task,"explain");assert.deepEqual(I.getTools(why),[]);
 assert.ok(I.getTools(I.resolveIntent("Kirakan integral x kuasa dua",[],false)).some(x=>x.code_execution));
});

test("light turns choose an allowlisted low-latency Gemini model while deep tasks keep the larger model",t=>{
 setup(t);
 assert.equal(I.chooseModel("gemini-3.6-flash",{depth:"low"}),"gemini-3.1-flash-lite");
 assert.equal(I.chooseModel("gemini-3.6-flash",{depth:"high"}),"gemini-3.6-flash");
 process.env.GEMINI_MODEL_FAST="paid-or-unreviewed-model";
 assert.equal(I.chooseModel("gemini-3.6-flash",{depth:"low"}),"gemini-3.1-flash-lite");
});
test("model-specific quota blocks that model, and project-wide quota blocks every Gemini variant",async t=>{
 for(const scope of ["model","project","mixed"]){
  const modelScoped=scope==="model";
  const handler=setup(t);let google=0;
  global.fetch=async url=>{
   if(!url.includes("googleapis"))return reply("Sandaran tersedia.");
   google++;
   if(url.includes("gemini-3.1-flash-lite"))return Response.json({error:{details:[
    {"@type":"type.googleapis.com/google.rpc.QuotaFailure",violations:[{quotaId:scope!=="project"?"GenerateContentRequestsPerDayPerProjectPerModel-FreeTier":"GenerateContentRequestsPerDayPerProject"},...(scope==="mixed"?[{quotaId:"GenerateContentRequestsPerDayPerProject"}]:[])]},
    {"@type":"type.googleapis.com/google.rpc.RetryInfo",retryDelay:"30s"}
   ]}},{status:429});
   return Response.json({candidates:[{content:{parts:[{text:"Jawapan model besar."}]},finishReason:"STOP"}]});
  };
  await handler(event({question:"Apa itu atom?",preferredProvider:"gemini"}));
  const result=JSON.parse((await handler(event({question:"Analisis mendalam algoritma komputer.",preferredProvider:"gemini"}))).body);
  assert.equal(google,modelScoped?2:1);
  assert.equal(result.model,modelScoped?"gemini-3.6-flash":"mock");
 }
});

test("a one-second token reset recovers before spending another model's first-token timeout",async t=>{
 const handler=setup(t);let calls=0,google=0;const started=Date.now();
 global.fetch=async url=>{
  if(url.includes("googleapis")){google++;throw Error("This route should not be needed");}
  calls++;
  return calls===1?Response.json({error:{message:"Tokens per minute exceeded"}},{status:429,headers:{"retry-after":"1"}}):reply("Sambung topik tadi.");
 };
 const response=await handler(event({question:"Ringkaskan punca tadi kepada dua perkara."}));
 assert.equal(response.statusCode,200);assert.equal(calls,2);assert.equal(google,0);
 assert.ok(Date.now()-started>=1000,"The real quota reset is honoured before retrying");
 assert.equal(JSON.parse(response.body).routing.failedAttempts[0].status,429);
});
test("stopping during a short quota reset cancels it without sending another completion",async t=>{
 const handler=setup(t),controller=new AbortController();let calls=0;
 global.fetch=async()=>{calls++;return Response.json({error:{message:"Tokens per minute exceeded"}},{status:429,headers:{"retry-after":"1"}});};
 const pending=handler(event({question:"Sambung perbualan tadi."},{signal:controller.signal}));
 setTimeout(()=>controller.abort(),20);
 const response=await pending;
 assert.equal(response.statusCode,499);assert.equal(calls,1);
});
test("a failed short quota recovery is not repeated again after another model times out",async t=>{
 const handler=setup(t);let calls=0,offset=0;const realNow=Date.now.bind(Date);
 t.mock.method(Date,"now",()=>realNow()+offset);
 global.fetch=async url=>{
  if(url.includes("googleapis")){offset+=3000;throw new DOMException("Primary timed out","AbortError");}
  calls++;return Response.json({error:{message:"Tokens per minute exceeded"}},{status:429,headers:{"retry-after":"1"}});
 };
 const response=await handler(event({question:"Terangkan apa itu api."}));
 assert.equal(response.statusCode,503);assert.equal(calls,2,"A request gets at most one recovery attempt");
});

test("Mistral direct provider remains disabled even when its keys are still configured",async t=>{
 setup(t);process.env.MISTRAL_API_KEY="mock";process.env.MISTRAL_FREE_CONFIRMED="true";
 const router=require("../netlify/functions/aksara-provider-router");
 assert.ok(!router.configured().some(p=>p.id==="mistral"));
 let calls=[];global.fetch=async url=>{calls.push(String(url));return reply("Hai");};
 await router.checkStatus();await router.complete({system:"persona",history:[],question:"Hai"});
 assert.ok(calls.every(url=>!url.includes("api.mistral.ai")));
});
