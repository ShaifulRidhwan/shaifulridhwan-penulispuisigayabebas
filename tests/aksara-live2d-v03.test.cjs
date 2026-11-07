"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const bridge=require("../bilik-antara-live2d-bridge-v03.js");
test("Cubism bridge is pure, and parameters are continuous and bounded",()=>{
 const idle=bridge.state({phase:"idle",time:450});
 const talking=bridge.state({phase:"speaking",time:450,audio:.67});
 const silence=bridge.state({phase:"listening",time:450,audio:.67});
 assert.equal(idle.ParamMouthOpenY,0);
 assert.equal(talking.ParamMouthOpenY,.67);
 assert.equal(silence.ParamMouthOpenY,0);
 assert.ok(Object.keys(talking).every(id=>bridge.ids.includes(id)));
 assert.equal(bridge.state({phase:"speaking",audio:99}).ParamMouthOpenY,1);
 assert.equal(bridge.state({phase:"speaking",audio:-3}).ParamMouthOpenY,0);
});
test("Conservative expression routing leaves uncertain transcript neutral",()=>{
 assert.equal(bridge.inferExpression("Tahniah!"),"smile");
 assert.equal(bridge.inferExpression("Aku fikir itu tak tepat"),"thinking");
 assert.equal(bridge.inferExpression("Saya sedih"),"neutral","Do not attribute emotions from user words");
 assert.equal(bridge.inferExpression("Hahaha"),"laugh");
});
test("Reduced motion truly disables head sway and breathing animation",()=>{
 const a=bridge.state({phase:"idle",time:1050,reducedMotion:true});
 const b=bridge.state({phase:"idle",time:4000,reducedMotion:true});
 assert.equal(a.ParamAngleX,b.ParamAngleX);
 assert.equal(a.ParamBreath,b.ParamBreath);
});
test("Mic-free audio sampler handles empty and RMS input",()=>{
 assert.deepEqual(bridge.sampleAudio(null),{rms:0,cache:null});
 const result=bridge.sampleAudio({fftSize:64,getFloatTimeDomainData(buffer){buffer.fill(.05);}});
 assert.ok(result.rms>.35&&result.rms<.5);
 assert.equal(result.cache.length,64);
});
test("Model manifest rejects a JPEG/WebP and accepts a real Cubism export structure",()=>{
 assert.equal(bridge.validateManifest({}),false);
 assert.equal(bridge.validateManifest({FileReferences:{Moc:"flat.webp",Textures:["x.webp"]}}),false);
 assert.equal(bridge.validateManifest({FileReferences:{Moc:"aksara.moc3",Textures:["textures/0.png"]}}),true);
});
test("Live2D new mode is genuinely opt-in and never draws false face lines",()=>{
 const code=read("bilik-antara-live2d-v03.js");
 const html=read("bilik-antara.html");
 const ui=read("bilik-antara-voice-experiment-v3.js");
 const css=read("bilik-antara-live2d-v03.css");
 assert.doesNotThrow(()=>new Function(code));
 assert.match(code,/query\.get\("voice-avatar"\)!=="live2d"/);
 assert.match(code,/modelUrl="\.\/assets\/live2d\/aksara\/aksara\.model3\.json"/);
 assert.match(code,/\.moc3/);
 assert.match(code,/motion\.step/);
 assert.match(code,/window\.AksaraVoiceAudio\?\.analyser/);
 assert.match(code,/ParamMouthOpenY|setParameterValueById/);
 assert.match(code,/model-missing/);
 assert.doesNotMatch(code,/drawImage|ellipse\(|bezierCurve|\.webp|new WebSocket|getUserMedia|live-token/);
 assert.match(html,/genuineLive2D=avatarMode==="live2d"/);
 assert.match(html,/bilik-antara-live2d-v03\.js\?v=4/);
 assert.match(ui,/genuineLive2D=selectedAvatar==="live2d"/);
 assert.match(ui,/if\(!anime2D&&!genuineLive2D\)stage\.append\(fallback\)/);
 assert.match(css,/#voiceAvatarStage\.avatar-live2d-active/);
});
test("Cubism license and artist workflow are documented without bundling proprietary runtime",()=>{
 const guide=read("assets/live2d/README.md");
 assert.match(guide,/Photoshop|PSD/);
 assert.match(guide,/SDK Release License/);
 assert.match(guide,/Expandable Application/);
 assert.match(guide,/\.moc3/);
 assert.equal(fs.existsSync(path.join(__dirname,"../assets/live2d/vendor/live2dcubismcore.min.js")),false);
});