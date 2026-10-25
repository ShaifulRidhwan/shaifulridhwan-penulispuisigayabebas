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
 for(const id of ["voiceDictate","voiceLive","voiceAutoplay","voicePanel","voiceStop",
  "voiceMuteMic","voiceMuteSpeaker","voiceTranscript","voiceStatus","voiceWave"]){
   assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(html,/id="voicePanel" hidden/);
 assert.match(html,/bilik-antara-voice\.js\?v=1/);
 assert.match(html,/bilik-antara\.css\?v=2/);
 assert.match(html,/id="composer"/);
 assert.match(html,/aria-live="polite"/);
 assert.match(html,/audio dihantar terus/i);
 assert.match(css,/\.voice-panel\[hidden\]\{display:none!important\}/);
 assert.match(css,/\.voice-wave/);
});
test("Live streaming uses ephemeral token with PCM input/output and transcription",()=>{
 assert.match(js,/bilik-antara-live-token/);
 assert.match(js,/BidiGenerateContentConstrained\?access_token=/);
 assert.match(js,/inputAudioTranscription:\{\}/);
 assert.match(js,/outputAudioTranscription:\{\}/);
 assert.match(js,/voiceName:"Aoede"/);
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
test("Session creation has backend rate limiting",async()=>{
 process.env.GEMINI_API_KEY="fake-permanent-api-key-test";
 const old=global.fetch;
 try{
  global.fetch=async()=>({ok:true,status:200,json:async()=>({name:"auth_tokens/unit-test-token"})});
  for(let i=0;i<3;i++)assert.equal((await handler(event("voice-test-limiter"))).statusCode,200);
  assert.equal((await handler(event("voice-test-limiter"))).statusCode,429);
 }finally{global.fetch=old;delete process.env.GEMINI_API_KEY;}
});
