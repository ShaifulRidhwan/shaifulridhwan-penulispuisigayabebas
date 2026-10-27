"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {handler}=require("../netlify/functions/bilik-antara-live-token");

const html=fs.readFileSync("bilik-antara.html","utf8");
const css=fs.readFileSync("bilik-antara.css","utf8");
const js=fs.readFileSync("bilik-antara-voice.js","utf8");
const pcm=fs.readFileSync("bilik-antara-pcm-worklet.js","utf8");
const fallback=fs.readFileSync("bilik-antara-voice-fallback.js","utf8");
const voiceFallback=fs.readFileSync("bilik-antara-voice-fallback.js","utf8");
const intelligence=fs.readFileSync("netlify/functions/antara-intelligence.js","utf8");
const netlify=fs.readFileSync("netlify.toml","utf8");
const backend=fs.readFileSync("netlify/functions/bilik-antara.js","utf8");
const origin="https://shaifulridhwan-penulispuisigayabebas.netlify.app";
function event(ip,host=origin){
 return {httpMethod:"POST",headers:{origin:host,"x-nf-client-connection-ip":ip},body:"{}"};
}

test("Recorded-audio fallback stays opt-in and does not expose any permanent API key",()=>{
 for(const id of ["voiceFallback","voiceFallbackStart","voiceFallbackStop","voiceFallbackStatus","voiceFallbackSpeak"]){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/bilik-antara-voice-fallback\.js\?v=3/);
 assert.match(voiceFallback,/ba:voice-live-failed/);
 assert.match(js,/dispatchEvent\(new Event\("ba:voice-live-failed"\)\)/);
 assert.match(voiceFallback,/getUserMedia/);
 assert.match(voiceFallback,/MediaRecorder/);
 assert.match(voiceFallback,/sendOnStop/);
 assert.match(voiceFallback,/audio\/webm/);
 assert.match(voiceFallback,/\.netlify\/functions\/bilik-antara/);
 assert.match(intelligence,/"audio\/webm"/);
 assert.doesNotMatch(voiceFallback,/GEMINI_API_KEY|localStorage\.setItem|sessionStorage\.setItem/);
});
test("Microphone is allowed only for this site's origin",()=>{
 assert.match(netlify,/Permissions-Policy = "camera=\(\), microphone=\(self\), geolocation=\(\)"/);
 assert.doesNotMatch(netlify,/microphone=\(\)/);
});
test("Opt-in voice UI, screen-reader status and independent original text input",()=>{
 for(const id of ["voiceDictate","voiceLive","voiceNotice","voicePanel","voiceStop",
  "voiceMuteMic","voiceMuteSpeaker","voiceTranscript","voiceStatus","voiceWave"]){
   assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(html,/id="voicePanel" hidden/);
 assert.match(html,/bilik-antara-voice\.js\?v=12/);
 assert.match(html,/bilik-antara\.css\?v=8/);
 assert.match(html,/id="composer"/);
 assert.match(html,/aria-live="polite"/);
 assert.match(html,/Audio dihantar kepada Google/i);
 assert.doesNotMatch(html,/id="voiceAutoplay"|Baca jawapan/);
 assert.doesNotMatch(js,/voice-read|readUtterance|speechSynthesis|equipRead/);
 assert.doesNotMatch(css,/\.voice-read\b|\.voice-autoread\b/);
 assert.match(html,/<header class="conversation-head">\s*<div class="voice-toolbar"/);
 assert.match(html,/Shaiful Ridhwan A\.I/);
 assert.match(js,/showNotice\(message\)/);
 assert.doesNotMatch(js,/panel\.hidden=false/);
 assert.match(css,/\.voice-panel\[hidden\]\{display:none!important\}/);
 assert.match(css,/\.voice-wave/);
});
test("Casual Malay UI uses Cakap instead of technical Dikte",()=>{
 assert.match(html,/id="voiceDictate"[^>]*>Cakap jadi teks<\/button>/);
 assert.match(html,/status\("ready","Pelayan sedia"/);
 assert.match(js,/dictate\.textContent="🎙 Cakap"/);
 assert.match(js,/dictate\.textContent="■ Berhenti"/);
 assert.doesNotMatch(html,/>🎙 Dikte<\/button>/);
 assert.doesNotMatch(js,/textContent="🎙 Dikte"/);
});
test("Fallback from retired Gemini models uses current Gemini Live",async()=>{
 const previous=process.env.GEMINI_LIVE_MODEL;
 process.env.GEMINI_LIVE_MODEL="gemini-2.5-flash-native-audio-preview-09-2025";
 process.env.GEMINI_API_KEY="test-only";
 const originalFetch=global.fetch;
 try{
  global.fetch=async(_url,opts)=>{
   const data=JSON.parse(opts.body);
   assert.equal(data.liveConnectConstraints.model,"models/gemini-3.8-live");
   return {ok:true,status:200,json:async()=>({name:"auth_tokens/model-validated"})};
  };
  const response=await handler(event("voice-old-model"));
  assert.equal(response.statusCode,200);
  assert.equal(JSON.parse(response.body).model,"gemini-3.8-live");
 }finally{
  global.fetch=originalFetch;
  delete process.env.GEMINI_API_KEY;
  if(previous===undefined)delete process.env.GEMINI_LIVE_MODEL;
  else process.env.GEMINI_LIVE_MODEL=previous;
 }
});
test("Live streaming uses ephemeral token with PCM input/output and transcription",()=>{
 assert.match(js,/bilik-antara-live-token/);
 assert.match(js,/BidiGenerateContentConstrained\?access_token=/);
 assert.match(js,/inputAudioTranscription:\{\}/);
 assert.match(js,/outputAudioTranscription:\{\}/);
 assert.match(js,/voiceName:"Charon"/);
 assert.match(js,/audio\/pcm;rate=16000/);
 assert.match(js,/decodePcm/);
 assert.match(js,/c\.interrupted/);
 assert.match(js,/MAX_DAY=24\*60\*60\*1000/);
 assert.match(js,/CONNECTION_SPAN=8\*60\*1000/);
 assert.match(js,/sessionResumption:handle\?\{handle\}:\{\}/);
 assert.match(js,/contextWindowCompression:\{slidingWindow:\{\}\}/);
 assert.match(js,/visibilitychange/);
 assert.match(js,/mediaStream\.getTracks\(\)\.forEach\(t=>t\.stop\(\)\)/);
 assert.match(pcm,/registerProcessor\("antara-pcm"/);
 assert.match(js,/AudioWorkletNode/);
});
test("PCM worklet converts 44.1/48 kHz to 16 kHz using 40ms chunks with anti-alias averaging",()=>{
 for(const rate of [44100,48000,16000]){
  let Processor=null;
  const posted=[];
  const AudioWorkletProcessor=class{constructor(){this.port={postMessage(x){posted.push(x);}};}};
  new Function("AudioWorkletProcessor","registerProcessor","sampleRate",pcm)(
   AudioWorkletProcessor,(_name,klass)=>{Processor=klass;},rate
  );
  const capture=new Processor();
  for(let n=0;n<rate;n+=128){
   const samples=new Float32Array(Math.min(128,rate-n)).fill(.5);
   capture.process([[samples]]);
  }
  const count=posted.reduce((n,item)=>n+item.pcm.byteLength/2,0);
  assert.equal(count,16000);
  assert.equal(posted.length,25);
  assert.ok(posted.every(item=>item.pcm.byteLength===1280));
  assert.ok(posted.every(item=>Math.abs(new Int16Array(item.pcm)[0]-16384)<2));
 }
 assert.match(js,/pcm-worklet\.js\?v=2/);
 assert.doesNotMatch(pcm,/this\.phase\+=ratio/);
});
test("Long-running Voice is opted in and reconnects in foreground without storing resume handles",()=>{
 assert.match(js,/MAX_DAY=24\*60\*60\*1000/);
 assert.match(js,/sessionResumptionUpdate/);
 assert.match(js,/sessionResumption:handle\?\{handle\}:\{\}/);
 assert.match(js,/contextWindowCompression:\{slidingWindow:\{\}\}/);
 assert.match(js,/window\.removeEventListener\("ba:voice-renew",renewListener\)/);
 assert.match(js,/document\.hidden/);
 assert.match(js,/connectionAttempts>=2/);
 assert.match(js,/connectedAt<9\*60\*1000/);
 assert.doesNotMatch(js,/localStorage\.setItem\([^;]*resumeHandle/);
 assert.match(html,/24 jam/);
 assert.match(html,/transkrip/);
});
test("Live speech detection tolerates Malay pauses and refuses to guess unclear speech",()=>{
 assert.match(js,/silenceDurationMs:900/);
 assert.match(js,/prefixPaddingMs:300/);
 assert.match(js,/START_SENSITIVITY_LOW/);
 assert.match(js,/TURN_INCLUDES_ONLY_ACTIVITY/);
 assert.match(js,/DENGAR BETUL-BETUL/);
 assert.match(js,/Aku dengar:/);
});
test("First-person AI persona uses aku not saya in both regular and live models",()=>{
 assert.match(js,/WAJIB gunakan kata ganti diri pertama AKU, bukan SAYA/);
 assert.match(backend,/WAJIB kata ganti diri AKU, bukan SAYA/);
 assert.match(html,/Assalamualaikum dan selamat sejahtera/);
});
test("Empty secret and disallowed cross-origin requests never issue Gemini tokens",async()=>{
 delete process.env.GEMINI_API_KEY;
 const missing=await handler(event("voice-test-empty"));
 assert.equal(missing.statusCode,503);
 const bad=await handler(event("voice-test-bad","https://not-our-site.test"));
 assert.equal(bad.statusCode,403);
});
test("One-use ten-minute token broker never returns permanent API key",async()=>{
 process.env.GEMINI_API_KEY="fake-permanent-api-key-test";
 delete process.env.GEMINI_LIVE_MODEL;
 let request;
 const old=global.fetch;
 try{
  global.fetch=async(url,opts)=>{
   request={url,opts,body:JSON.parse(opts.body)};
   return {ok:true,status:200,json:async()=>({name:"auth_tokens/unit-test-voice-token"})};
  };
  const res=await handler(event("voice-test-healthy"));
  assert.equal(res.statusCode,200);
  const data=JSON.parse(res.body);
  assert.equal(data.model,"gemini-3.8-live");
  assert.equal(data.token,"auth_tokens/unit-test-voice-token");
  assert.equal(data.durationSeconds,600);
  assert.ok(!res.body.includes("fake-permanent-api-key-test"));
  assert.equal(request.body.uses,1);
  assert.equal(request.body.liveConnectConstraints.model,"models/gemini-3.8-live");
  const ttl=new Date(request.body.expireTime)-new Date(request.body.newSessionExpireTime);
  assert.ok(ttl<=10*60*1000&&ttl>=8*60*1000);
  assert.equal(request.opts.headers["x-goog-api-key"],"fake-permanent-api-key-test");
  assert.ok(request.url.endsWith("/v1beta/auth_tokens"));
  assert.match(res.headers["Cache-Control"],/no-store/);
 }finally{global.fetch=old;delete process.env.GEMINI_API_KEY;}
});

test("Google TOKEN_CONSTRAINTS 400 falls back to documented 1-use 5-minute Live-only token",async()=>{
 process.env.GEMINI_API_KEY="fake-permanent-api-key-test";
 const originalFetch=global.fetch, requests=[];
 try{
  global.fetch=async(url,opts)=>{
   const body=JSON.parse(opts.body);requests.push({url,body});
   if(requests.length===1)return {
    ok:false,status:400,
    json:async()=>({error:{message:"Invalid liveConnectConstraints field",status:"INVALID_ARGUMENT"}})
   };
   return {ok:true,status:200,json:async()=>({name:"auth_tokens/short-lived-test-token"})};
  };
  const response=await handler(event("voice-token-constraints-"+Date.now()));
  assert.equal(response.statusCode,200);
  const result=JSON.parse(response.body);
  assert.equal(result.token,"auth_tokens/short-lived-test-token");
  assert.equal(result.model,"gemini-3.8-live");
  assert.equal(result.durationSeconds,300);
  assert.equal(result.tokenMode,"temporary-live-only");
  assert.equal(requests.length,2,"Do not retry unnecessary model configs");
  assert.equal(requests[0].body.liveConnectConstraints.model,"models/gemini-3.8-live");
  assert.equal(requests[1].body.liveConnectConstraints,undefined);
  assert.equal(requests[1].body.uses,1);
  assert.ok(new Date(requests[1].body.expireTime)-Date.now()<=5*60*1000);
  assert.ok(new Date(requests[1].body.newSessionExpireTime)-Date.now()<=90*1000);
  assert.ok(!response.body.includes("fake-permanent-api-key-test"));
 }finally{global.fetch=originalFetch;delete process.env.GEMINI_API_KEY;}
});
test("Repeated Google 400 on both token formats returns a useful error",async()=>{
 process.env.GEMINI_API_KEY="fake-permanent-api-key-test";
 const old=global.fetch,calls=[];
 try{
  global.fetch=async(_,opts)=>{
   calls.push(JSON.parse(opts.body));
   return {ok:false,status:400,json:async()=>({error:{message:calls.length===1?"Unknown field liveConnectConstraints":"Invalid auth token input",status:"INVALID_ARGUMENT"}})};
  };
  const res=await handler(event("voice-rejected-again-"+Date.now()));
  assert.equal(res.statusCode,502);
  assert.equal(JSON.parse(res.body).reason,"TOKEN_HTTP_400");
  assert.equal(calls.length,2);
  assert.equal(calls[1].liveConnectConstraints,undefined);
 }finally{global.fetch=old;delete process.env.GEMINI_API_KEY;}
});
test("403 project access rejection never retries an unbound Live token",async()=>{
 process.env.GEMINI_API_KEY="fake-permanent-api-key-test";
 const old=global.fetch,calls=[];
 try{
  global.fetch=async(_,opts)=>{
   calls.push(JSON.parse(opts.body));
   return {ok:false,status:403,json:async()=>({error:{message:"permission denied",status:"PERMISSION_DENIED"}})};
  };
  const res=await handler(event("voice-denied-"+Date.now()));
  assert.equal(res.statusCode,502);
  assert.equal(calls.length,1);
  assert.equal(JSON.parse(res.body).reason,"TOKEN_HTTP_403");
 }finally{global.fetch=old;delete process.env.GEMINI_API_KEY;}
});
test("A 400 audio-configuration rejection can recover using an allowlisted model-locked Live token",async()=>{
 process.env.GEMINI_API_KEY="fake-permanent-api-key-test";
 const old=global.fetch,sent=[];
 try{
  global.fetch=async(_,opts)=>{
   const body=JSON.parse(opts.body);sent.push(body);
   if(sent.length===1)return {ok:false,status:400,json:async()=>({error:{message:"Invalid model",status:"INVALID_ARGUMENT"}})};
   return {ok:true,status:200,json:async()=>({name:"auth_tokens/fallback-works"})};
  };
  const res=await handler(event("voice-recover-"+Date.now()));
  assert.equal(res.statusCode,200);
  assert.equal(sent.length,2);
  assert.equal(sent[0].liveConnectConstraints.config,undefined);
  assert.equal(sent[1].liveConnectConstraints.model,"models/gemini-3.8-live");
  assert.equal(JSON.parse(res.body).token,"auth_tokens/fallback-works");
  assert.ok(!res.body.includes("fake-permanent-api-key-test"));
 }finally{global.fetch=old;delete process.env.GEMINI_API_KEY;}
});
test("Voice composer microphone and send share identical 44px and responsive dimensions",()=>{
 assert.match(css,/2026-10-27: Match microphone and send touch targets/);
 assert.match(css,/\.composer #voiceFallbackStart,/);
 assert.match(css,/\.composer #voiceFallbackStop,/);
 assert.match(css,/\.composer #sendBtn/);
 assert.match(css,/width:44px;height:44px/);
 assert.match(css,/width:40px;height:40px/);
 assert.match(css,/width:38px;height:38px/);
});
test("Voice connection has explicit token and websocket watchdogs",()=>{
 assert.match(js,/const tokenTimer=setTimeout\(\(\)=>controller\.abort\(\),26000\)/);
 assert.match(js,/connectTimer=setTimeout\(\(\)=>/);
 assert.match(js,/if\(connectTimer\)\{clearTimeout\(connectTimer\);connectTimer=null;\}/);
 assert.match(js,/if\(typeof Blob!=="undefined"&&raw instanceof Blob\)/);
});
test("Unsupported Live token response presents actionable status rather than a full-screen overlay",async()=>{
 process.env.GEMINI_API_KEY="fake-permanent-api-key-test";
 const old=global.fetch;
 try{
  global.fetch=async()=>({ok:false,status:400,json:async()=>({error:{message:"not supported for this project",status:"INVALID_ARGUMENT"}})});
  const res=await handler(event("voice-failure-"+Date.now()));
  assert.equal(res.statusCode,502);
  const body=JSON.parse(res.body);
  assert.equal(body.reason,"TOKEN_HTTP_400");
  assert.match(body.error,/tetapan token|menolak|Google/i);
  assert.match(js,/showNotice\(message\)/);
  assert.doesNotMatch(js,/panel\.hidden=false/);
 }finally{global.fetch=old;delete process.env.GEMINI_API_KEY;}
});
test("Siapa Aku is the only welcome starter and workspace nav is hidden",()=>{
 const match=[...html.matchAll(/<button class="starter"[^>]*>([^<]+)<\/button>/g)];
 assert.equal(match.length,1);
 assert.equal(match[0][1],"Siapa Aku");
 const suite=fs.readFileSync("bilik-antara-suite.js","utf8");
 assert.doesNotMatch(suite,/\["workspace","Ruang kerja"\]/);
});
test("Voice errors distinguish Google token rejection from permission and WebSocket failures",()=>{
 assert.match(js,/TOKEN_UNAVAILABLE/);
 assert.match(js,/HTTP "\+res\.status/);
 assert.match(js,/code===1008|\[1008,4001,4401,4429\]/);
 assert.match(js,/ws\.onclose=event=>/);
 assert.match(js,/Number\(event\.code\)\|\|1006/);
 assert.match(js,/visibilityTimer=setTimeout/);
 assert.match(js,/8000/);
});
test("Rejected Google token attempts are not counted as completed Live sessions",async()=>{
 process.env.GEMINI_API_KEY="fake-key-for-test";
 const old=global.fetch;
 const label="voice-rejections-then-success";
 try{
  global.fetch=async()=>({ok:false,status:403,json:async()=>({error:{message:"permission denied",status:"PERMISSION_DENIED"}})});
  for(let i=0;i<4;i++)assert.equal((await handler(event(label))).statusCode,502);
  global.fetch=async()=>({ok:true,status:200,json:async()=>({name:"auth_tokens/approved-for-test"})});
  for(let i=0;i<5;i++)assert.equal((await handler(event(label))).statusCode,200);
  assert.equal((await handler(event(label))).statusCode,429);
 }finally{global.fetch=old;delete process.env.GEMINI_API_KEY;}
});
test("Fallback voice only records after an explicit user click and uses the original server-side key",()=>{
 assert.match(html,/id="voiceFallback"[^>]*hidden/);
 assert.match(html,/id="voiceFallbackStart"/);
 assert.match(html,/id="voiceFallbackStop"/);
  assert.ok(html.indexOf('id="voiceFallbackStart"')<html.indexOf('id="sendBtn"'));
  assert.ok(html.indexOf('id="voiceFallbackStop"')<html.indexOf('id="sendBtn"'));
  assert.match(html,/id="voiceMinimize"/);
  assert.match(html,/id="voiceFallbackMinimize"/);
  assert.match(fallback,/voiceFallbackRetry/);
  assert.match(fallback,/voiceFallback:true/);
  assert.match(js,/minimizeButton\.addEventListener/);

 assert.match(html,/bilik-antara-voice-fallback\.js\?v=3/);
 assert.match(js,/ba:voice-live-failed/);
 assert.match(fallback,/addEventListener\("ba:voice-live-failed"/);
 assert.match(fallback,/start\.addEventListener\("click",async/);
 assert.match(fallback,/stop\.addEventListener\("click"/);
 assert.match(fallback,/getUserMedia/);
 assert.match(fallback,/new window\.MediaRecorder/);
 assert.match(fallback,/\.netlify\/functions\/bilik-antara/);
 assert.match(fallback,/audio\/webm/);
 assert.match(fallback,/2400000/);
 assert.match(fallback,/20000/);
 assert.match(fallback,/timer=setTimeout\(\(\)=>finish\(false\),20000\)/);
 assert.match(css,/\.voice-panel\.is-minimized/);
 assert.match(css,/\.composer-voice/);
 assert.match(css,/\.voice-fallback\.is-collapsed/);
 assert.doesNotMatch(fallback,/GEMINI_API_KEY|localStorage|indexedDB/);
});
test("Voice token request runs in parallel with microphone initialization",()=>{
 const token=js.indexOf('const tokenPromise=fetch(ENDPOINT');
 const mic=js.indexOf('const stream=await navigator.mediaDevices.getUserMedia');
 assert.ok(token>=0&&mic>=0&&token<mic,"start token while requesting microphone");
 assert.match(js,/tokenPromise\.catch\(\(\)=>\{\}\)/);
});
test("Voice resumption reuses microphone and keeps Google handle in memory only",async()=>{
 const items=new Map(),events=new Map();
 const item=id=>{
  if(items.has(id))return items.get(id);
  const handlers={},attrs={};
  const x={hidden:false,disabled:false,style:{setProperty(){}},classList:{add(){},remove(){},toggle(){return true}},textContent:"",children:[],value:"",scrollHeight:0,
   addEventListener:(n,fn)=>handlers[n]=fn,listener:n=>handlers[n],
   setAttribute:(n,v)=>attrs[n]=v,getAttribute:n=>attrs[n],
   replaceChildren(){this.children=[];},appendChild(v){this.children.push(v);},disconnect(){}};
  items.set(id,x);return x;
 };
 const doc={getElementById:item,createElement:t=>item(t+"-"+items.size),addEventListener(){},hidden:false};
 const track={enabled:true,stop(){this.stopped=true}};
 const stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
 class Audio{constructor(){this.audioWorklet={addModule:async()=>{}};this.destination={};this.currentTime=0;}
  resume(){return Promise.resolve()}close(){return Promise.resolve()}
  createMediaStreamSource(){return{connect(){},disconnect(){}}}
  createGain(){return{gain:{value:1},connect(){},disconnect(){}}}
 }
 class Worklet{constructor(){this.port={onmessage:null}}connect(){}disconnect(){}}
 class Socket{
  static instances=[];static OPEN=1;
  constructor(url){this.url=url;this.readyState=1;this.sent=[];Socket.instances.push(this);Promise.resolve().then(()=>this.onopen?.());}
  send(payload){this.sent.push(JSON.parse(payload));}
  close(){this.readyState=3;}
 }
 let called=0;
 const page={
  isSecureContext:true,AudioContext:Audio,AudioWorkletNode:Worklet,WebSocket:Socket,
  addEventListener:(n,fn)=>events.set(n,[...(events.get(n)||[]),fn]),
  removeEventListener:(n,fn)=>events.set(n,(events.get(n)||[]).filter(f=>f!==fn)),
  dispatchEvent:e=>(events.get(e.type)||[]).forEach(fn=>fn(e))
 };
 const nav={mediaDevices:{getUserMedia:async()=>stream}};
 let id=0;
 const fakeSet=()=>++id,fakeClear=()=>{};
 const FakeEvent=class{constructor(type){this.type=type}};
 const issue=async()=>({ok:true,status:200,json:async()=>({token:"auth_tokens/test-"+(++called),model:"gemini-3.8-live",durationSeconds:600})});
 new Function("document","window","navigator","WebSocket","AudioWorkletNode","setTimeout","clearTimeout","fetch","Event","AbortController","btoa","atob",js)(
  doc,page,nav,Socket,Worklet,fakeSet,fakeClear,issue,FakeEvent,
  class{constructor(){this.signal={aborted:false}}abort(){this.signal.aborted=true}},()=>"",()=>""
 );
 await item("voiceLive").listener("click")();
 for(let n=0;n<4;n++)await Promise.resolve();
 const first=Socket.instances[0];
 assert.ok(first?.sent[0]?.setup);
 assert.deepEqual(first.sent[0].setup.sessionResumption,{});
 await first.onmessage({data:JSON.stringify({setupComplete:{}})});
 await first.onmessage({data:JSON.stringify({sessionResumptionUpdate:{resumable:true,newHandle:"HANDLE_ONLY_IN_MEMORY"}})});
 await first.onmessage({data:JSON.stringify({goAway:{timeLeft:"15s"}})});
 for(let n=0;n<24;n++)await Promise.resolve();
 const second=Socket.instances[1];
 assert.ok(second?.sent[0]?.setup);
 assert.equal(second.sent[0].setup.sessionResumption.handle,"HANDLE_ONLY_IN_MEMORY");
 assert.equal(called,2);
 assert.equal(track.stopped,undefined,"no new microphone permission when connection renews");
 await item("voiceStop").listener("click")();
 assert.equal(track.stopped,true,"stopping voice releases microphone");
 assert.equal((events.get("ba:voice-renew")||[]).length,0);
});
test("Session creation has backend rate limiting",async()=>{
 process.env.GEMINI_API_KEY="fake-permanent-api-key-test";
 const old=global.fetch;
 try{
  global.fetch=async()=>({ok:true,status:200,json:async()=>({name:"auth_tokens/unit-test-token"})});
  for(let i=0;i<5;i++)assert.equal((await handler(event("voice-test-limiter"))).statusCode,200);
  assert.equal((await handler(event("voice-test-limiter"))).statusCode,429);
 }finally{global.fetch=old;delete process.env.GEMINI_API_KEY;}
});
