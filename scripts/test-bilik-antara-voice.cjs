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
const brainJs=fs.readFileSync("bilik-antara-brain.js","utf8");
const identityJs=fs.readFileSync("bilik-antara-identity.js","utf8");
const identityModule={exports:{}};
new Function("module",identityJs)(identityModule);
const creatorIdentity=identityModule.exports;
const brainModule={exports:{}};
new Function("module",brainJs)(brainModule);
const sharedBrain=brainModule.exports;
const intelligence=fs.readFileSync("netlify/functions/antara-intelligence.js","utf8");
const netlify=fs.readFileSync("netlify.toml","utf8");
const backend=fs.readFileSync("netlify/functions/bilik-antara.js","utf8");
const origin="https://shaifulridhwan-penulispuisigayabebas.netlify.app";
function event(ip,host=origin){
 return {httpMethod:"POST",headers:{origin:host,"x-nf-client-connection-ip":ip},body:"{}"};
}

test("Legacy recorded-audio UI stays unmounted and never embeds permanent keys",()=>{
 assert.doesNotMatch(html,/<script[^>]+src="bilik-antara-voice-fallback/);
 assert.doesNotMatch(html,/id="voiceFallback"/);
 assert.match(voiceFallback,/getUserMedia/);
 assert.match(voiceFallback,/MediaRecorder/);
 assert.doesNotMatch(voiceFallback,/GEMINI_API_KEY|localStorage\.setItem|sessionStorage\.setItem/);
});
test("Regional voice selector is removed, leaving only colloquial Malaysian Malay",()=>{
 assert.doesNotMatch(html,/id="voiceDialect"|voice-dialect-bar|bilik-antara-voice-locale/);
 assert.doesNotMatch(css,/\.voice-dialect-bar/);
 assert.doesNotMatch(js,/dialectChoice|dialectSelect|voiceLocale|voiceDialect/);
 assert.doesNotMatch(fallback,/voiceLocale|voiceDialect|selectedVoiceStyle/);
  assert.match(html,/>Jom Voice Chat<\/button>/);
  assert.match(js,/liveButton\.textContent=liveActive\?"Sedang berbual":"Jom Voice Chat"/);
  assert.match(css,/\.conversation-head #voiceLive::before/);
 assert.match(css,/@keyframes aksaraVoiceWave/);
 assert.match(css,/\.conversation \.conversation-head\{display:flex/);
});
test("Short Malay words trigger a natural answer, not five requests to repeat",()=>{
 assert.match(js,/START_SENSITIVITY_LOW/);
 assert.match(js,/prefixPaddingMs:160/);
 assert.match(js,/silenceDurationMs:1000/);
 assert.match(js,/START_OF_ACTIVITY_INTERRUPTS/);
 assert.match(js,/Perkataan pendek seperti 'lapar'/);
 assert.match(js,/PERKATAAN PENDEK SAH/);
 assert.match(js,/c\.interimInputTranscription\?\.text/);
 assert.match(js,/appendTranscript\("user"/);
 assert.match(js,/removeItem\("bilik-antara:voice-dialect:v1"\)/);
 assert.match(sharedBrain.VOICE_GUIDANCE,/lapar/);
 assert.match(sharedBrain.VOICE_GUIDANCE,/Jangan meminta ulang/);
 assert.match(fallback,/Perkataan pendek seperti lapar/);
 assert.match(js,/Bahasa Melayu Malaysia santai/);
});
test("Long generated speech is buffered and does not cut off after three seconds",()=>{
 assert.match(js,/function drainAudioQueue\(\)/);
 assert.match(js,/pendingAudio\.push\(\{data,rate,bytes\}\)/);
 assert.match(js,/MAX_SCHEDULE_AHEAD=5/);
 assert.match(js,/node\.onended=\(\)=>/);
 assert.match(js,/if\(playbackBusy\(\)\)sayStatus/);
 assert.match(js,/modelTurnFinished=true/);
 assert.match(js,/MAX_PENDING_AUDIO_BYTES=12\*1024\*1024/);
 assert.doesNotMatch(js,/nextAudioTime-now>3\.5\)return/);
});
test("A 12.5-second generated reply plays every chunk in order without truncation",()=>{
 const start=js.indexOf("function playbackBusy(){");
 const end=js.indexOf("function onServerMessage(payload){",start);
 assert.ok(start>=0&&end>start);
 const source=js.slice(start,end);
 const scheduled=[],context={
  currentTime:0,destination:{},
  createBufferSource(){
   return {connect(){},disconnect(){},onended:null,start(when){this.when=when;scheduled.push(this)}};
  }
 };
 const simulate=new Function("context",[
  "let pendingAudio=[],pendingAudioBytes=0,audioQueueGeneration=0,modelTurnFinished=false;",
  "const MAX_PENDING_AUDIO_BYTES=12*1024*1024,MAX_SCHEDULE_AHEAD=5;",
  "let playSources=new Set(),nextAudioTime=0,playContext=context,playGain=null,speakerEnabled=true,suppressPlaybackUntilUser=false;",
  "const panel={classList:{add(){},remove(){}}};let warnings=[];",
  "function decodePcm(){return {duration:.05}}",
  "function sayStatus(){} function showNotice(x){warnings.push(x)}",
  source,
  "return {queueAudio,pending:()=>pendingAudio.length,active:()=>playSources.size,warnings:()=>warnings};"
 ].join("\n"))(context);
 for(let n=0;n<250;n++)simulate.queueAudio("AAAAAA","audio/pcm;rate=24000");
 assert.ok(scheduled.length<250,"Do not schedule all generated audio ahead of playback");
 assert.ok(simulate.pending()>0,"Extra audio is buffered, never dropped");
 for(let time=1;time<=20;time++){
  context.currentTime=time;
  for(const source of [...scheduled]){
   if(!source.finished&&source.when+.05<=time){
    source.finished=true;source.onended?.();
   }
  }
 }
 assert.equal(scheduled.length,250);
 assert.equal(scheduled.filter(x=>x.finished).length,250);
 assert.equal(simulate.pending(),0);
 assert.equal(simulate.active(),0);
 assert.deepEqual(simulate.warnings(),[]);
});
test("Extended Live token denial falls back to normal Live without bypassing limits",async()=>{
 const originalModel=process.env.GEMINI_LIVE_MODEL;
 process.env.GEMINI_API_KEY="fake-key";delete process.env.GEMINI_LIVE_MODEL;
 const old=global.fetch,calls=[];
 try{
  global.fetch=async(_,opts)=>{
   const body=JSON.parse(opts.body);calls.push(body);
   if(body.liveConnectConstraints?.model==="models/gemini-3.8-live-extended-thinking")
    return {ok:false,status:404,json:async()=>({error:{status:"NOT_FOUND",message:"Model unavailable"}})};
   return {ok:true,status:200,json:async()=>({name:"auth_tokens/standard-recovery"})};
  };
  const res=await handler(event("deep-model-fallback-"+Date.now()));
  assert.equal(res.statusCode,200);
  assert.equal(JSON.parse(res.body).model,"gemini-3.8-live");
  assert.equal(calls.length,2);
  assert.equal(calls[0].liveConnectConstraints.model,"models/gemini-3.8-live-extended-thinking");
  assert.equal(calls[1].liveConnectConstraints.model,"models/gemini-3.8-live");
 }finally{global.fetch=old;delete process.env.GEMINI_API_KEY;
   if(originalModel!==undefined)process.env.GEMINI_LIVE_MODEL=originalModel;}
});
test("Unsupported Extended Thinking websocket can explicitly request standard Live",async()=>{
 const originalModel=process.env.GEMINI_LIVE_MODEL;
 process.env.GEMINI_API_KEY="fake-key";delete process.env.GEMINI_LIVE_MODEL;
 const old=global.fetch,calls=[];
 try{
  global.fetch=async(_,opts)=>{
   calls.push(JSON.parse(opts.body));
   return {ok:true,status:200,json:async()=>({name:"auth_tokens/forced-standard"})};
  };
  const req=event("standard-mode-"+Date.now());req.body=JSON.stringify({mode:"standard"});
  const res=await handler(req);
  assert.equal(res.statusCode,200);
  assert.equal(JSON.parse(res.body).model,"gemini-3.8-live");
  assert.equal(calls.length,1);
  assert.equal(calls[0].liveConnectConstraints.model,"models/gemini-3.8-live");
  const invalid=event("invalid-mode-"+Date.now());invalid.body='{"mode":"unrestricted"}';
  assert.equal((await handler(invalid)).statusCode,400);
 }finally{global.fetch=old;delete process.env.GEMINI_API_KEY;
   if(originalModel!==undefined)process.env.GEMINI_LIVE_MODEL=originalModel;}
});
test("Shaiful creator history, deeper reasoning and empathic voice share grounded rules",()=>{
 assert.match(creatorIdentity.VOICE_CREATOR_PROMPT,/penulis puisi gaya bebas/);
 assert.match(creatorIdentity.VOICE_CREATOR_PROMPT,/Antara Cahaya dan Gelap/);
 assert.match(creatorIdentity.VOICE_CREATOR_PROMPT,/JANGAN sekali-kali.*melatih/i);
 assert.match(sharedBrain.CORE,/PEMIKIRAN MENDALAM SECARA ADAPTIF/);
 assert.match(sharedBrain.CORE,/EMOSI DALAM KOMUNIKASI/);
 assert.match(sharedBrain.VOICE_GUIDANCE,/DEEP THINKING/);
 assert.match(sharedBrain.VOICE_GUIDANCE,/EMOSI DAN NADANYA/);
 assert.match(js,/sharedIdentity\?\.VOICE_CREATOR_PROMPT\|\|""/);
 assert.match(js,/thinkingConfig:\{thinkingLevel:data\.model==="gemini-3\.8-live-extended-thinking"\?"MEDIUM":"LOW"\}/);
 assert.match(js,/interactionStatus/);
 assert.match(js,/modelTurnFinished=true/);
 assert.match(js,/reasoningActive=false/);
 assert.match(fallback,/projectIdentity\?\.VOICE_CREATOR_PROMPT\|\|""/);
 assert.match(html,/bilik-antara-brain\.js\?v=\d+/);
 assert.match(html,/bilik-antara-identity\.js\?v=\d+/);
 assert.match(html,/bilik-antara-voice\.js\?v=\d+/);
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
 assert.match(html,/bilik-antara-voice\.js\?v=\d+/);
 assert.match(html,/bilik-antara\.css\?v=\d+/);
 assert.match(html,/id="composer"/);
 assert.match(html,/aria-live="polite"/);
 assert.doesNotMatch(html,/class="voice-privacy"|Mikrofon aktif hanya selepas/);
 assert.doesNotMatch(html,/id="voiceAutoplay"|Baca jawapan/);
 assert.doesNotMatch(js,/voice-read|readUtterance|speechSynthesis|equipRead/);
 assert.doesNotMatch(css,/\.voice-read\b|\.voice-autoread\b/);
 assert.match(html,/<header class="conversation-head">\s*<div class="voice-toolbar"/);
 assert.match(html,/Aksara A\.I/);
 assert.match(js,/showNotice\(message\)/);
 assert.doesNotMatch(js,/panel\.hidden=false/);
 assert.match(css,/\.voice-panel\[hidden\]\{display:none!important\}/);
 assert.match(css,/\.voice-wave/);
});
test("Casual Malay UI uses Cakap instead of technical Dikte",()=>{
 assert.match(html,/id="voiceDictate"[^>]*>Cakap jadi teks<\/button>/);
 assert.match(html,/status\("ready","Multi A.I Connected"/);
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
   assert.equal(data.liveConnectConstraints.model,"models/gemini-3.8-live-extended-thinking");
   return {ok:true,status:200,json:async()=>({name:"auth_tokens/model-validated"})};
  };
  const response=await handler(event("voice-old-model"));
  assert.equal(response.statusCode,200);
  assert.equal(JSON.parse(response.body).model,"gemini-3.8-live-extended-thinking");
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
 assert.match(js,/inputAudioTranscription:advancedVoiceConfig\?\{languageCodes:\["ms-MY"\]/);
 assert.match(js,/outputAudioTranscription:\{\}/);
 assert.match(js,/voiceName:"Aoede"/);
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
 assert.match(js,/pcm-worklet\.js\?v=\d+/);
 assert.doesNotMatch(pcm,/this\.phase\+=ratio/);
});
test("Long-running Voice is opted in and reconnects in foreground without storing resume handles",()=>{
 assert.match(js,/MAX_DAY=24\*60\*60\*1000/);
 assert.match(js,/sessionResumptionUpdate/);
 assert.match(js,/sessionResumption:handle\?\{handle\}:\{\}/);
 assert.match(js,/contextWindowCompression:\{slidingWindow:\{\}\}/);
 assert.match(js,/window\.removeEventListener\("ba:voice-renew",renewListener\)/);
 assert.match(js,/document\.hidden/);
 assert.match(js,/connectionAttempts>=MAX_RECONNECT_ATTEMPTS/);
 assert.match(js,/connectedAt<9\*60\*1000/);
 assert.doesNotMatch(js,/localStorage\.setItem\([^;]*resumeHandle/);
 assert.match(js,/MAX_DAY=24\*60\*60\*1000/);
 assert.match(js,/BilikAntaraBridge\?\.addVoice/);
});
test("Live speech detection tolerates Malay pauses and refuses to guess unclear speech",()=>{
 assert.match(js,/silenceDurationMs:1000/);
 assert.match(js,/prefixPaddingMs:160/);
 assert.match(js,/START_SENSITIVITY_LOW/);
 assert.match(js,/TURN_INCLUDES_ONLY_ACTIVITY/);
 assert.match(js,/DENGAR BETUL-BETUL/);
 assert.match(js,/appendTranscript\("user"/);
});
test("First-person AI persona uses aku not saya in both regular and live models",()=>{
 assert.match(js,/WAJIB gunakan kata ganti diri pertama AKU, bukan SAYA/);
 assert.match(sharedBrain.CORE,/WAJIB kata ganti diri AKU, bukan SAYA/);
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
  assert.equal(data.model,"gemini-3.8-live-extended-thinking");
  assert.equal(data.token,"auth_tokens/unit-test-voice-token");
  assert.equal(data.durationSeconds,600);
  assert.ok(!res.body.includes("fake-permanent-api-key-test"));
  assert.equal(request.body.uses,1);
  assert.equal(request.body.liveConnectConstraints.model,"models/gemini-3.8-live-extended-thinking");
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
  assert.equal(requests[0].body.liveConnectConstraints.model,"models/gemini-3.8-live-extended-thinking");
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
  assert.equal(sent[1].liveConnectConstraints.model,"models/gemini-3.8-live-extended-thinking");
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
test("Identity and poetry starters remain available and workspace nav is hidden",()=>{
 const match=[...html.matchAll(/<button class="starter"[^>]*>([^<]+)<\/button>/g)];
 assert.equal(match.length,3);
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
test("Live voice is opt-in and legacy recording never starts from the active page",()=>{
 assert.match(html,/id="voiceLive"/);assert.match(html,/id="voiceMinimize"/);
 assert.doesNotMatch(html,/<script[^>]+src="bilik-antara-voice-fallback/);
 assert.match(js,/getUserMedia/);assert.match(js,/liveButton\.addEventListener/);
 assert.doesNotMatch(js,/GEMINI_API_KEY|localStorage\.setItem\([^;]*resumeHandle/);
});
test("Voice token request runs in parallel with microphone initialization",()=>{
 const token=js.indexOf('const tokenPromise=fetch(ENDPOINT');
 const mic=js.indexOf('const stream=await navigator.mediaDevices.getUserMedia');
 assert.ok(token>=0&&mic>=0&&token<mic,"start token while requesting microphone");
 assert.match(js,/tokenPromise\.catch\(\(\)=>\{\}\)/);
});
function voiceHarness(options={}){
 const items=new Map(),events=new Map(),docEvents=new Map();
 const item=id=>{
  if(items.has(id))return items.get(id);
  const handlers={},attrs={};
  const x={hidden:false,disabled:false,style:{setProperty(){}},classList:{add(){},remove(){},toggle(){return true}},textContent:"",children:[],value:"",scrollHeight:0,
   addEventListener:(n,fn)=>handlers[n]=fn,listener:n=>handlers[n],
   setAttribute:(n,v)=>attrs[n]=v,getAttribute:n=>attrs[n],
   querySelectorAll(){return [];},replaceChildren(){this.children=[];},appendChild(v){this.children.push(v);},disconnect(){}};
  items.set(id,x);return x;
 };
 const doc={getElementById:item,createElement:t=>item(t+"-"+items.size),addEventListener:(n,fn)=>docEvents.set(n,fn),hidden:false};
 const track={enabled:true,addEventListener(){},getSettings(){return {}},stop(){this.stopped=true}};
 const stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
 const audioSources=[];
 class Audio{static instances=[];constructor(){Audio.instances.push(this);this.state="running";this.resumeCount=0;this.audioWorklet={addModule:async()=>{}};this.destination={};this.currentTime=0;}
  resume(){this.state="running";this.resumeCount++;return Promise.resolve()}close(){return Promise.resolve()}
  createBuffer(_channels,frames,rate){return{duration:frames/rate,getChannelData:()=>new Float32Array(frames)}}
  createBufferSource(){const source={connect(){},disconnect(){},start(){},stop(){this.stopped=true}};audioSources.push(source);return source;}
  createMediaStreamSource(){return{connect(){},disconnect(){}}}
  createAnalyser(){return{fftSize:512,connect(){},disconnect(){},getFloatTimeDomainData(data){data.fill(0)}}}
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
  BilikAntaraBrain:sharedBrain,
  BilikAntaraIdentity:creatorIdentity,
  addEventListener:(n,fn)=>events.set(n,[...(events.get(n)||[]),fn]),
  removeEventListener:(n,fn)=>events.set(n,(events.get(n)||[]).filter(f=>f!==fn)),
  dispatchEvent:e=>(events.get(e.type)||[]).forEach(fn=>fn(e))
 };
 const nav={onLine:true,mediaDevices:{getUserMedia:async()=>stream}};
 let id=0,now=100000;
 const timers=new Map();
 const fakeSet=(fn,delay)=>{const idValue=++id;timers.set(idValue,{fn,at:now+delay});return idValue;};
 const fakeClear=idValue=>timers.delete(idValue);
 class Clock extends Date{static now(){return now;}}
 const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
 const advance=async(ms)=>{
  const target=now+ms;
  for(let count=0;count<100;count++){
   const next=[...timers].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];
   if(!next)break;
   now=next[1].at;timers.delete(next[0]);next[1].fn();await flush();
   if(count===99)throw Error("timer loop");
  }
  now=target;await flush();
 };
 const FakeEvent=class{constructor(type){this.type=type}};
 const modeRequests=[];
 const issue=async(_url,opts)=>{
  const body=JSON.parse(opts.body);modeRequests.push(body.mode||"auto");
  if(options.tokenFailure&&called>0)return options.tokenFailure;
  return {ok:true,status:200,json:async()=>({
   token:"auth_tokens/test-"+(++called),
   model:body.mode==="standard"?"gemini-3.8-live":"gemini-3.8-live-extended-thinking",
   durationSeconds:600
  })};
 };
 new Function("document","window","navigator","WebSocket","AudioWorkletNode","setTimeout","clearTimeout","fetch","Event","AbortController","btoa","atob","Date",js)(
  doc,page,nav,Socket,Worklet,fakeSet,fakeClear,issue,FakeEvent,
  class{constructor(){this.signal={aborted:false}}abort(){this.signal.aborted=true}},x=>Buffer.from(x,"binary").toString("base64"),x=>Buffer.from(x,"base64").toString("binary"),Clock
 );
 return {item,page,doc,nav,track,Socket,Audio,audioSources,events,modeRequests,advance,flush,
  called:()=>called,
  start:async()=>{await item("voiceLive").listener("click")();await flush();const ws=Socket.instances[0];await ws.onmessage({data:JSON.stringify({setupComplete:{}})});return ws;},
  message:(ws,payload)=>ws.onmessage({data:JSON.stringify(payload)}),
  disconnect:async(ws,code=1006)=>{ws.readyState=3;ws.onclose?.({code});await flush();},
  visibility:async(hidden)=>{doc.hidden=hidden;docEvents.get("visibilitychange")?.();await flush();}
 };
}
test("Voice resumption reuses microphone and keeps Google handle in memory only",async()=>{
 const h=voiceHarness();
 const {item,Socket,track,events,modeRequests}=h;
 await item("voiceLive").listener("click")();
 for(let n=0;n<4;n++)await Promise.resolve();
 const first=Socket.instances[0];
 assert.ok(first?.sent[0]?.setup);
 assert.deepEqual(first.sent[0].setup.sessionResumption,{});
 const spoken=first.sent[0].setup.systemInstruction.parts[0].text;
 assert.match(spoken,/Bahasa asas ialah Bahasa Melayu Malaysia santai/);
 assert.match(spoken,/Jangan tiba-tiba tukar bahasa asing/);
 assert.ok(spoken.includes(sharedBrain.CORE),"Voice prompt shares common persona");
 assert.ok(spoken.includes(sharedBrain.VOICE_GUIDANCE),"Voice prompt adds voice-specific intelligence guidance");
 assert.ok(spoken.includes(creatorIdentity.VOICE_CREATOR_PROMPT),"Creator profile is available to Voice");
 assert.equal(first.sent[0].setup.generationConfig.thinkingConfig.thinkingLevel,"MEDIUM");
 await first.onmessage({data:JSON.stringify({setupComplete:{}})});
 await first.onmessage({data:JSON.stringify({serverContent:{interactionStatus:"IN_PROGRESS",turnComplete:true}})});
 assert.match(item("voiceStatus").textContent,/fikir/);
 await first.onmessage({data:JSON.stringify({serverContent:{interactionStatus:"IDLE",turnComplete:true}})});
 assert.match(item("voiceStatus").textContent,/Aku dengar/);
 await first.onmessage({data:JSON.stringify({sessionResumptionUpdate:{resumable:true,newHandle:"HANDLE_ONLY_IN_MEMORY"}})});
 await first.onmessage({data:JSON.stringify({goAway:{timeLeft:"15s"}})});
 for(let n=0;n<24;n++)await Promise.resolve();
 const second=Socket.instances[1];
 assert.ok(second?.sent[0]?.setup);
 assert.equal(second.sent[0].setup.sessionResumption.handle,"HANDLE_ONLY_IN_MEMORY");
 assert.match(second.sent[0].setup.systemInstruction.parts[0].text,/Bahasa Melayu Malaysia/);
 assert.equal(h.called(),2);
 assert.equal(second.sent[0].setup.generationConfig.thinkingConfig.thinkingLevel,"MEDIUM");
 await second.onclose({code:1008,reason:"unsupported extended setup"});
 for(let i=0;i<24;i++)await Promise.resolve();
 const third=Socket.instances[2];
 assert.ok(third?.sent[0]?.setup,"Failed extended setup should use standard Live");
 assert.equal(third.sent[0].setup.model,"models/gemini-3.8-live");
 assert.equal(third.sent[0].setup.generationConfig.thinkingConfig,undefined);
 assert.equal(modeRequests[2],"standard");
 assert.equal(h.called(),3);
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

test("voice status stays conversational while keeping listening and mic controls functional",async()=>{
 const h=voiceHarness(),ws=await h.start();
 await h.message(ws,{serverContent:{interactionStatus:"IN_PROGRESS"}});
 assert.equal(h.item("voiceStatus").textContent,"Hmm, jap aku fikir…");
 await h.message(ws,{serverContent:{waitingForInput:true}});
 assert.equal(h.item("voiceStatus").textContent,"Haa, sambung je. Aku dengar.");
 h.item("voiceMuteMic").listener("click")();
 assert.equal(h.item("voiceStatus").textContent,"Mic dah tutup.");assert.equal(h.track.enabled,false);
 h.item("voiceMuteMic").listener("click")();
 assert.equal(h.item("voiceStatus").textContent,"Mic dah buka. Aku dengar.");assert.equal(h.track.enabled,true);
 await h.item("voiceStop").listener("click")();assert.equal(h.track.stopped,true);
});

 test("Voice setup timeout downgrades optional configuration without an undefined close code",()=>{
 const start=js.indexOf("connectTimer=setTimeout(()=>{",js.indexOf("const ws=new WebSocket"));
 const end=js.indexOf("},20000)",start);
 assert.ok(start>=0&&end>start);
 const callback=js.slice(start+"connectTimer=setTimeout(()=>{".length,end);
 const run=new Function("renewConnection",`let generation=1,liveGeneration=1,ws={},socket=ws,liveReady=false,established=false,advancedVoiceConfig=true,resumeHandle="old",reconnecting=true;function sayStatus(){};${callback};return {advancedVoiceConfig,resumeHandle,reconnecting};`);
 const calls=[];run(x=>calls.push(x));
 assert.equal(calls.length,1); // callback returns immediately after retry
 });

test("GoAway finishes buffered speech before renewal and keeps received audio at the deadline",async()=>{
 const h=voiceHarness(),ws=await h.start();
 const audio=Buffer.alloc(48000).toString("base64");
 await h.message(ws,{serverContent:{modelTurn:{parts:[{inlineData:{data:audio,mimeType:"audio/pcm;rate=24000"}}]}}});
 const source=h.audioSources[0];assert.ok(source);
 await h.message(ws,{goAway:{timeLeft:"5s"}});
 await h.flush();
 assert.equal(h.called(),1,"Do not sever active speech when advance warning arrives");
 await h.advance(3600);
 assert.equal(h.called(),2,"Honor Google's deadline even if playback is still active");
 assert.equal(source.stopped,undefined,"Transport renewal never discards already received speech");
 await h.item("voiceStop").listener("click")();
 assert.equal(source.stopped,true,"Explicit stop still discards speech immediately");
});
test("Repeated short-lived sockets back off and stop after three recoveries",async()=>{
 const h=voiceHarness();let ws=await h.start();
 for(let i=0;i<3;i++){
  await h.disconnect(ws);
  const count=h.called();await h.advance(799);
  assert.equal(h.called(),count,"Do not spin immediately on a dropped socket");
  await h.advance(6500);
  ws=h.Socket.instances.at(-1);
  await h.message(ws,{setupComplete:{}});
 }
 assert.equal(h.called(),4);
 await h.disconnect(ws);await h.advance(6500);
 assert.equal(h.called(),4,"A brief setup acknowledgment must not reset recovery budget");
 assert.equal(h.track.stopped,true);
});
test("Offline waits without new credentials, online recovers, and stop cancels pending recovery",async()=>{
 const h=voiceHarness(),ws=await h.start();
 h.nav.onLine=false;h.page.dispatchEvent({type:"offline"});
 await h.disconnect(ws);await h.advance(10000);
 assert.equal(h.called(),1);
 assert.equal(h.track.stopped,undefined);
 h.nav.onLine=true;h.page.dispatchEvent({type:"online"});await h.flush();
 assert.equal(h.called(),2);
 const next=h.Socket.instances.at(-1);await h.message(next,{setupComplete:{}});
 await h.disconnect(next);
 await h.item("voiceStop").listener("click")();await h.advance(10000);
 h.page.dispatchEvent({type:"online"});await h.flush();
 assert.equal(h.called(),2,"Stop cannot be undone by a delayed timer or online event");
});
test("Returning to foreground resumes suspended audio without replacing a healthy socket",async()=>{
 const h=voiceHarness();await h.start();
 await h.visibility(true);
 for(const context of h.Audio.instances)context.state="suspended";
 await h.visibility(false);
 assert.ok(h.Audio.instances.every(context=>context.state==="running"&&context.resumeCount>=2));
 assert.equal(h.called(),1);
 assert.equal(h.track.stopped,undefined);
});
test("Explicitly invalidated resumption handle is never reused",async()=>{
 const h=voiceHarness(),ws=await h.start();
 await h.message(ws,{sessionResumptionUpdate:{resumable:true,newHandle:"stale"}});
 await h.message(ws,{sessionResumptionUpdate:{resumable:false}});
 await h.disconnect(ws);await h.advance(800);
 assert.deepEqual(h.Socket.instances.at(-1).sent[0].setup.sessionResumption,{});
});
test("Broker quota denial wrapped in 502 is definitive and never triggers token retry",async()=>{
 const h=voiceHarness({tokenFailure:{ok:false,status:502,json:async()=>({reason:"TOKEN_HTTP_429",error:"Kuota penuh"})}});
 const ws=await h.start();await h.disconnect(ws);await h.advance(10000);
 assert.equal(h.modeRequests.length,2);
 assert.equal(h.track.stopped,true);
});

test("The true 3D voice avatar only skips invisible frame drawing while the voice session continues",()=>{
 const avatar=fs.readFileSync("bilik-antara-avatar.js","utf8");
 const html=fs.readFileSync("bilik-antara.html","utf8");
 const css=fs.readFileSync("bilik-antara.css","utf8");
 assert.match(html,/import\("\.\/bilik-antara-avatar\.js\?v=14"\)/);
 assert.match(avatar,/panel\.classList\.contains\("is-minimized"\)\|\|document\.hidden/);
 assert.match(avatar,/renderer\.render\(scene,camera\)/);
 assert.match(avatar,/weights\(\["jawOpen"\],jawMotion\)/);
 assert.match(css,/\.voice-panel\.is-minimized \.voice-avatar-stage\{display:none!important\}/);
});

test("Avatar synchronizes facial meshes, responds to audio and uses conservative transcript cues",()=>{
 const avatar=fs.readFileSync("bilik-antara-avatar.js","utf8");
 const start=avatar.indexOf("function indexMorphTargets(){"),end=avatar.indexOf("function stop(){",start);
 assert.ok(start>=0&&end>start);
 const make=new Function(`
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  let morphIndex=null,audioArray=null,audioSpectrum=null,audioAnalyser=null,mouthRound=0,emotion="neutral",emotionUntil=0;
  const meshes=[0,1,2].map(()=>({morphTargetDictionary:{jawOpen:0},morphTargetInfluences:[0]}));
  const root={traverse(fn){meshes.forEach(fn)}};
  const analyser={fftSize:4,getFloatTimeDomainData(a){a.fill(.04)}};
  const window={AksaraVoiceAudio:{analyser},addEventListener(){}};
  ${avatar.slice(start,end)}
  indexMorphTargets();weights(["jawOpen"],.2);
  return {meshes,level:audioLevel(),emotionFor};
 `);
 const {meshes,level,emotionFor}=make();
 assert.deepEqual(meshes.map(x=>x.morphTargetInfluences[0]),[.2,.2,.2]);
 assert.ok(level>.3&&level<.33);
 assert.equal(emotionFor("mwehehe"),"laugh");
 assert.equal(emotionFor("air mata"),"cry");
 assert.equal(emotionFor("aku takziah"),"sad");
 assert.equal(emotionFor("cerita tentang teknologi"),"neutral");
});


test("The original brunette hair remains unmodified and is pinned to a fixed GLB revision",()=>{
 const avatar=fs.readFileSync("bilik-antara-avatar.js","utf8");
 const html=fs.readFileSync("bilik-antara.html","utf8");
 assert.match(avatar,/TalkingHead@166b443a445eeb63a4ea02270aa9e7d6ba8b4d88\/avatars\/brunette\.glb/);
 assert.doesNotMatch(avatar,/MessyBun|messybun|installMessyBun|mergeGeometries/);
 assert.doesNotMatch(html,/messybun/i);
 assert.match(html,/TalkingHead<\/a> \(lesen CC BY-NC 4\.0/);
});

test("3D renderer stops scheduling frames when minimized or in a hidden tab",()=>{
 const avatar=fs.readFileSync("bilik-antara-avatar.js","utf8");
 assert.match(avatar,/const frame=\(t\)=>\{raf=0;if\(!active\|\|!renderer\)return/);
 assert.match(avatar,/if\(panel\.classList\.contains\("is-minimized"\)\|\|document\.hidden\)return;/);
 assert.match(avatar,/resumeDraw=\(\)=>\{/);
 assert.match(avatar,/!raf&&!document\.hidden&&!panel\.classList\.contains\("is-minimized"\)/);
 assert.match(avatar,/attributeFilter:\["hidden","class"\]/);
 assert.match(avatar,/document\.addEventListener\("visibilitychange",\(\)=>resumeDraw\?\.\(\)\)/);
 assert.match(avatar,/resumeDraw=null;active=false;/);
});
