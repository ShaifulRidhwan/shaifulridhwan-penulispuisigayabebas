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
