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
 global.fetch=async()=>{attempts++;return sse([{choices:[{delta:{content:"separuh ".repeat(40)}}]}]);};
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
 setup(t);process.env.MISTRAL_API_KEY="mock";process.env.MISTRAL_FREE_CONFIRMED="true";
 const router=require("../netlify/functions/aksara-provider-router");const displayed=[];
 global.fetch=async url=>url.includes("groq.com")?sse([{model:"example/guard",choices:[{delta:{content:"User Safety: safe\nResponse Safety: safe"},finish_reason:"stop"}]}]):reply("Aku Aksara A.I.");
 const r=await router.complete({system:"persona",history:[],question:"siapa kau ek",onDelta:x=>displayed.push(x)});
 assert.equal(r.provider,"mistral");assert.equal(r.reply,"Aku Aksara A.I.");assert.ok(!displayed.join("").includes("User Safety"));
});
test("classifier labels from an ordinary-looking model are also rejected, while a normal safety refusal remains valid",async t=>{
 setup(t);const router=require("../netlify/functions/aksara-provider-router"),displayed=[];
 global.fetch=async()=>sse([{model:"mock-chat",choices:[{delta:{content:"User Safety: safe\nResponse Safety: safe"},finish_reason:"stop"}]}]);
 const bad=await router.complete({system:"persona",history:[],question:"Hai",onDelta:x=>displayed.push(x)});
 assert.equal(bad.error,"all_providers_unavailable");assert.equal(displayed.length,0);
});
test("OpenRouter chat requests specify only reviewed free chat models and validate the buffered answer",async t=>{
 setup(t);delete process.env.GROQ_API_KEY;process.env.OPENROUTER_API_KEY="mock";
 const router=require("../netlify/functions/aksara-provider-router");let body;const displayed=[];
 global.fetch=async(_url,opts)=>{body=JSON.parse(opts.body);return reply("Aku tak boleh bantu perbuatan itu, tetapi aku boleh cadangkan pilihan yang selamat.");};
 const r=await router.complete({system:"persona",history:[],question:"Soalan",onDelta:x=>displayed.push(x)});
 assert.equal(r.provider,"openrouter");assert.equal(body.model,undefined);assert.equal(body.stream,false);assert.equal(body.models.length,3);assert.ok(body.models.every(x=>x.endsWith(":free")&&!/guard|classifier|moderation/.test(x)));assert.equal(displayed.join(""),r.reply);
});
test("colloquial identity questions use the existing grounded Aksara introduction",async t=>{
 const handler=setup(t);global.fetch=()=>{throw Error("Identity must not need a provider");};
 for(const question of ["siapa kau ek","kau siapa weh?","siapa kau sebenarnya eh?"]){
  const r=await handler(event({question}));assert.equal(r.statusCode,200,question);const data=JSON.parse(r.body);assert.equal(data.model,"project-identity");assert.match(data.reply,/Aksara A\.I\./);assert.doesNotMatch(data.reply,/User Safety:/);
 }
});
test("buffered OpenRouter answers are not cut off at the streaming first-token deadline",async t=>{
 setup(t);delete process.env.GROQ_API_KEY;process.env.OPENROUTER_API_KEY="mock";
 const router=require("../netlify/functions/aksara-provider-router");let calls=0;
 global.fetch=async(_url,{signal})=>{calls++;return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>resolve(reply("Jawapan lengkap yang mengambil masa sedikit lebih lama.")),100);
  signal.addEventListener("abort",()=>{clearTimeout(timer);reject(new DOMException("abort","AbortError"));},{once:true});
 });};
 const r=await router.complete({system:"persona",history:[],question:"Kenapa langit biru?",onDelta:()=>{},timeoutMs:30,bufferedTimeoutMs:600,deadline:Date.now()+1000});
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
 global.fetch=async url=>{if(url.includes("openrouter")){backups++;return new Response("",{status:503});}google++;return Response.json({candidates:[{content:{parts:[{text:"Jawapan daripada Gemini."}]},finishReason:"STOP"}]});};
 const privateReply=await handler(event({question:"Ringkaskan fail",documentText:"teks peribadi",preferredProvider:"openrouter"}));assert.equal(privateReply.statusCode,200);assert.equal(backups,0);
 const fallback=await handler(event({question:"Apa itu graviti?",preferredProvider:"openrouter"}));assert.equal(fallback.statusCode,200);assert.equal(backups,1);assert.equal(google,2);
});
