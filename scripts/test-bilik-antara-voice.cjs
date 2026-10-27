"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {handler}=require("../netlify/functions/bilik-antara-live-token");

const html=fs.readFileSync("bilik-antara.html","utf8");
const css=fs.readFileSync("bilik-antara.css","utf8");
const js=fs.readFileSync("bilik-antara-voice.js","utf8");
const pcm=fs.readFileSync("bilik-antara-pcm-worklet.js","utf8");
const netlify=fs.readFileSync("netlify.toml","utf8");
const backend=fs.readFileSync("netlify/functions/bilik-antara.js","utf8");
const origin="https://shaifulridhwan-penulispuisigayabebas.netlify.app";
function event(ip,host=origin){
 return {httpMethod:"POST",headers:{origin:host,"x-nf-client-connection-ip":ip},body:"{}"};
}

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
 assert.match(html,/bilik-antara-voice\.js\?v=7/);
 assert.match(html,/bilik-antara\.css\?v=5/);
 assert.match(html,/id="composer"/);
 assert.match(html,/aria-live="polite"/);
 assert.match(html,/audio dihantar terus/i);
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
 assert.match(html,/>🎙 Cakap<\/button>/);
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
 assert.match(js,/setTimeout\(\(\)=>\{sayStatus\("Had sesi 10 minit dicapai\./);
 assert.match(js,/visibilitychange/);
 assert.match(js,/mediaStream\.getTracks\(\)\.forEach\(t=>t\.stop\(\)\)/);
 assert.match(pcm,/registerProcessor\("antara-pcm"/);
 assert.match(js,/AudioWorkletNode/);
});
test("First-person AI persona uses aku not saya in both regular and live models",()=>{
 assert.match(js,/WAJIB gunakan kata ganti diri pertama AKU, bukan SAYA/);
 assert.match(backend,/WAJIB bercakap dengan kata ganti diri AKU, bukan SAYA/);
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

test("Google rejection never downgrades a model-restricted Live token",async()=>{
 process.env.GEMINI_API_KEY="fake-permanent-api-key-test";
 const old=global.fetch;
 const sent=[];
 try{
  global.fetch=async(url,opts)=>{
   sent.push(JSON.parse(opts.body));
   return {ok:false,status:400,json:async()=>({error:{message:"invalid liveConnectConstraints",status:"INVALID_ARGUMENT"}})};
  };
  const res=await handler(event("voice-constrained-"+Date.now()));
  assert.equal(res.statusCode,502);
  assert.equal(JSON.parse(res.body).reason,"TOKEN_HTTP_400");
  assert.equal(sent.length,2,"Only the two allowlisted free-tier Live models are tried after 400.");
  assert.equal(sent[0].liveConnectConstraints.model,"models/gemini-3.8-live");
  assert.equal(sent[1].liveConnectConstraints.model,"models/gemini-3.1-flash-live-preview");
  assert.equal(sent[0].uses,1);
 }finally{global.fetch=old;delete process.env.GEMINI_API_KEY;}
});
test("Voice connection has explicit token and websocket watchdogs",()=>{
 assert.match(js,/const tokenTimer=setTimeout\(\(\)=>controller\.abort\(\),16000\)/);
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
 assert.match(js,/WS 1008/);
 assert.match(js,/WS 1006/);
 assert.match(js,/WS 1011/);
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
test("Session creation has backend rate limiting",async()=>{
 process.env.GEMINI_API_KEY="fake-permanent-api-key-test";
 const old=global.fetch;
 try{
  global.fetch=async()=>({ok:true,status:200,json:async()=>({name:"auth_tokens/unit-test-token"})});
  for(let i=0;i<5;i++)assert.equal((await handler(event("voice-test-limiter"))).statusCode,200);
  assert.equal((await handler(event("voice-test-limiter"))).statusCode,429);
 }finally{global.fetch=old;delete process.env.GEMINI_API_KEY;}
});
