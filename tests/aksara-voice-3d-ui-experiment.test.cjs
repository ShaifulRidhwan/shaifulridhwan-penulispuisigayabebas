"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");

test("experiment requires explicit voice-ui=3d opt-in",()=>{
 const html=read("bilik-antara.html");
 assert.match(html,/get\("voice-ui"\)!=="3d"\)return/);
 assert.match(html,/DOMContentLoaded/);
 assert.match(html,/bilik-antara-voice-experiment-v3\.js/);
 assert.match(html,/bilik-antara-voice-experiment-v3\.css/);
 assert.doesNotMatch(html,/<link[^>]+href="bilik-antara-voice-experiment-v3\.css/);
});

test("experiment only rearranges original voice DOM elements",()=>{
 const script=read("bilik-antara-voice-experiment-v3.js");
 const html=read("bilik-antara.html");
 for(const id of ["voicePanel","voiceAvatarStage","voiceMuteMic","voiceMuteSpeaker","voiceVolume","voiceStop","voicePhaseLabel","voiceStatus","voiceDialectSelect"]){
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 for(const id of ["voicePanel","voiceAvatarStage","voiceMuteSpeaker","voiceStop","voiceStyleTrigger","voiceModeBadge"]){
   assert.ok(script.includes('"'+id+'"'),id+" is reused");
 }
 assert.match(script,/footerEnd\.addEventListener\("click",\(\)=>stop\.click\(\)\)/);
 assert.doesNotMatch(script,/new WebSocket|new AudioContext|\.getUserMedia\(|fetch\(|localStorage\.setItem|sessionStorage\.setItem/);
});

test("3D avatar and original voice engine remain in place",()=>{
 const html=read("bilik-antara.html");
 const avatar=read("bilik-antara-avatar.js");
 const voice=read("bilik-antara-voice.js");
 assert.match(html,/import\("\.\/bilik-antara-avatar\.js\?v=14"\)/);
 assert.match(avatar,/brunette\.glb/);
 assert.match(avatar,/voiceAvatarStage/);
 assert.match(voice,/const LIVE_LOCKED_VOICE="Aoede"/);
 assert.match(voice,/let voiceVolume=0\.5/);
 assert.match(voice,/window\.BilikAntaraVoiceDiagnostics/);
});

test("responsive design, screen-reader labels and reduced-motion are preserved",()=>{
 const css=read("bilik-antara-voice-experiment-v3.css");
 const script=read("bilik-antara-voice-experiment-v3.js");
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/height:100dvh!important/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.voice-avatar-stage/);
 assert.match(script,/setAttribute\("aria-label","Kawalan sesi suara"\)/);
 assert.match(script,/const connected=Boolean\(d\?\.connected\)/);
 assert.match(script,/panel\.dataset\.voicePhase/);
});
test("voice UI uses Bilik Antara gold-blue glass and no emoji pseudo-icons",()=>{
 const css=read("bilik-antara-voice-experiment-v3.css");
 const js=read("bilik-antara-voice-experiment-v3.js");
 assert.match(css,/#e1b86d/);
 assert.match(css,/#voiceMuteMic::before/);
 assert.match(css,/#voiceMuteSpeaker::before/);
 assert.match(css,/mask-image:url\(/);
 assert.doesNotMatch(css,/[🎙♫☎]/u);
 assert.doesNotMatch(js,/Wajah 3D asal/);
 assert.match(css,/#voiceObserveV2\{display:none!important\}/);
});

test("v3.2 inherits the actual Bilik Antara glass and font tokens",()=>{
 const css=read("bilik-antara-voice-experiment-v3.css");
 const base=read("bilik-antara.css");
 assert.match(base,/--gold:#e1b86d/);
 assert.match(css,/--voice-gold:var\(--gold/);
 assert.match(css,/--voice-ink:var\(--ink/);
 assert.match(css,/--voice-glass:linear-gradient\(150deg,rgba\(23,31,45/);
 assert.match(css,/"DM Sans"/);
 assert.match(css,/"Space Grotesk"/);
 assert.match(css,/\.voice-live-label::before\{\s*content:none!important/);
 assert.match(css,/backdrop-filter:blur\(18px\)/);
});
test("same-size vector controls and stable mic / hangup / speaker order",()=>{
 const script=read("bilik-antara-voice-experiment-v3.js");
 const css=read("bilik-antara-voice-experiment-v3.css");
 assert.match(script,/if\(mic\)controls\.append\(mic\);[\s\S]*controls\.append\(footerEnd\);[\s\S]*if\(speaker\)controls\.append\(speaker\);/);
 assert.match(css,/grid-template-columns:repeat\(3,60px\)/);
 assert.match(css,/place-items:center!important/);
 assert.match(css,/\.voice-x-end::before/);
 assert.match(css,/#voiceMuteMic::before/);
 assert.match(css,/#voiceMuteSpeaker::before/);
 assert.match(css,/stroke-width%3D/);
 assert.doesNotMatch(css,/[🎙♫☎]/u);
});
test("existing avatar is never replaced; fallback disappears once WebGL is ready",()=>{
 const script=read("bilik-antara-voice-experiment-v3.js");
 const css=read("bilik-antara-voice-experiment-v3.css");
 assert.match(script,/bilik-antara-chat-portrait\.png\?v=1/);
 assert.match(script,/stage\.append\(fallback\)/);
 assert.match(css,/\.voice-avatar-stage\.avatar-ready \.voice-x-avatar-fallback/);
 assert.match(css,/opacity:0;visibility:hidden/);
 assert.doesNotMatch(script,/import\("three"/);
});
test("the in-call diagnostic panel does not occupy the interface",()=>{
 const js=read("bilik-antara-voice-experiment-v3.js");
 const css=read("bilik-antara-voice-experiment-v3.css");
 assert.match(js,/diagnostics\.hidden=true/);
 assert.match(css,/#voiceObserveV2\{display:none!important\}/);
 assert.match(js,/BilikAntaraVoiceDiagnostics\?\.snapshot/);
});

test("v4 brand header is native Aksara and never retains old identity pill",()=>{
 const js=read("bilik-antara-voice-experiment-v3.js");
 const css=read("bilik-antara-voice-experiment-v3.css");
 assert.match(js,/voice-v4-brand/);
 assert.match(js,/voice-v4-brand-mark/);
 assert.match(js,/AKSARA/);
 assert.match(js,/VOICE CHAT/);
 assert.match(css,/\.voice-v4-original-identity\{display:none!important\}/);
 assert.match(css,/\.voice-v4-wordmark strong/);
 assert.match(css,/\.voice-v4-wordmark small/);
});
test("v4 mobile scene is immersive and settings share one soft glass rhythm",()=>{
 const css=read("bilik-antara-voice-experiment-v3.css");
 assert.match(css,/AKSARA VOICE V4/);
 assert.match(css,/--voice-v4-fg:var\(--ink/);
 assert.match(css,/--voice-v4-warm:var\(--gold/);
 assert.match(css,/--voice-v4-glass:linear-gradient/);
 assert.match(css,/\.voice-v4-hero::before/);
 assert.match(css,/\.voice-v4-hero::after/);
 assert.match(css,/\.voice-x-avatar-fallback/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/#voicePanel\.voice-ui-experiment-v3\[hidden\]\{display:none!important\}/);
 assert.match(css,/grid-template-columns:repeat\(3,56px\)/);
});
test("v4 retains original endpoints and audio handlers, with no new network calls",()=>{
 const js=read("bilik-antara-voice-experiment-v3.js");
 const voice=read("bilik-antara-voice.js");
 const html=read("bilik-antara.html");
 assert.match(js,/footerEnd\.addEventListener\("click",\(\)=>stop\.click\(\)\)/);
 assert.match(js,/if\(mic\)controls\.append\(mic\)/);
 assert.match(js,/if\(speaker\)controls\.append\(speaker\)/);
 assert.match(js,/const diagnostics=panel\.querySelector\("#voiceObserveV2"\)/);
 assert.match(js,/panel\.dataset\.voiceV4Connected/);
 assert.doesNotMatch(js,/getUserMedia|new WebSocket|new AudioContext|\.netlify\/functions|fetch\(/);
 assert.match(voice,/const LIVE_LOCKED_VOICE="Aoede"/);
 assert.match(html,/bilik-antara-voice-experiment-v3\.css\?v=6/);
 assert.match(html,/bilik-antara-voice-experiment-v3\.js\?v=5/);
});

test("UI preview click is connected to the real Voice Chat entry without a Live token",()=>{
 const s=read("bilik-antara-voice-experiment-v3.js");
 assert.match(s,/const liveButton=document\.getElementById\("voiceLive"\)/);
 assert.match(s,/liveButton\.addEventListener\("click",openPreview,\{capture:true\}\)/);
 assert.match(s,/event\.stopImmediatePropagation\(\)/);
 assert.match(s,/panel\.hidden=false/);
 assert.match(s,/liveText\.textContent="PRATONTON UI"/);
 assert.match(s,/previewStatus="Pratonton reka bentuk sahaja/);
 assert.match(s,/stop\.addEventListener\("click"/);
 assert.match(s,/panel\.hidden=true/);
 assert.match(s,/voice-live"\)!=="1"/);
});