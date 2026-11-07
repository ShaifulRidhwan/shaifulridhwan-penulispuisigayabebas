"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

test("v0.6 is a separate optional REAL Cubism model, never a static avatar",()=>{
 const code=read("bilik-antara-live2d-v03.js");
 assert.doesNotThrow(()=>new Function(code));
 assert.match(code,/query\.get\("voice-rig"\)==="cohesive"/);
 assert.match(code,/assets\/live2d\/aksara-v06\/aksara\.model3\.json/);
 assert.match(code,/assets\/live2d\/aksara\/aksara\.model3\.json/);
 assert.match(code,/Live2DModel\.from\(modelUrl\)/);
 assert.match(code,/setParameterValueById/);
 assert.match(code,/if\(!cohesive&&query\.get\("voice-accessories"\)!=="off"\)/);
 assert.doesNotMatch(code,/drawImage|svg\.innerHTML|canvas\.getContext\("2d"\)/);
});

test("v0.6 keeps artist-detail photo textures without duplicated feature sprites",()=>{
 const builder=read("scripts/build-aksara-live2d-v06-cohesive.py");
 assert.match(builder,/source.*bilik-antara-avatar-2d-art\.webp/);
 assert.match(builder,/neutral_face=repair_underlay/);
 assert.match(builder,/\("face",masked\(neutral_face,head\)\)/);
 assert.match(builder,/\("eyewhite-l",masked\(src,eye_l\)\)/);
 assert.match(builder,/\("eyewhite-r",masked\(src,eye_r\)\)/);
 assert.match(builder,/\("mouth close",masked\(src,mouth\)\)/);
 assert.match(builder,/static_full_portrait_drawable":False/);
 assert.match(builder,/neutral_face_mae/);
 assert.doesNotMatch(builder,/\("background",(?:src|original|backdrop)/);
 assert.doesNotMatch(builder,/upper eyelid-l|upper eyelid-r|upper lip|lower lip|mouth inside/);
});

test("v0.6 doesn't touch established voice transport or user controls",()=>{
 const voice=read("bilik-antara-voice.js"),html=read("bilik-antara.html");
 assert.match(voice,/window\.AksaraVoiceAudio=\{analyser,context:playContext\}/);
 assert.match(voice,/ba:voice-avatar-text/);
 assert.match(voice,/bilik-antara-live-token/);
 assert.match(html,/voiceMute|voiceEnd|voiceSpeaker/i);
 const renderer=read("bilik-antara-live2d-v03.js");
 assert.doesNotMatch(renderer,/getUserMedia|new WebSocket|bilik-antara-live-token/);
});

test("Cloudflare deploy may copy optional v0.6 without overwriting v0.5",()=>{
 const builder=read("cloudflare/build.mjs");
 assert.match(builder,/assets","live2d","aksara-v06"/);
 assert.match(builder,/cp\(live2dModel,path\.join\(out,"assets","live2d","aksara"\)/);
 assert.match(builder,/cp\(cohesiveModel,path\.join\(out,"assets","live2d","aksara-v06"\)/);
});
