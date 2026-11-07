"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const accessories=require("../bilik-antara-live2d-accessories-v05.js");

test("Quality Mode is always 60 FPS without battery fallback",()=>{
 const js=read("bilik-antara-live2d-v03.js");
 assert.doesNotThrow(()=>new Function(js));
 assert.match(js,/const fpsLimit=60;/);
 assert.match(js,/const quality="quality";/);
 assert.match(js,/Math\.max\(2,dpr\)/);
 assert.match(js,/Math\.max\(2\.25,dpr\)/);
 assert.match(js,/antialias:true/);
 assert.match(js,/voice-quality/);
 assert.doesNotMatch(js,/reducedQuality|weakDevice|saveData|quality="battery"|quality="reduced"|maxFPS=30/);
 assert.match(js,/performanceNotice/);
 assert.match(js,/motion\.step/);
 assert.match(js,/AksaraLive2DAccessoriesV05/);
});

test("Visual art separation source is crisp high resolution with independent features",()=>{
 const script=read("scripts/build-aksara-live2d-quality-v05.py");
 assert.match(script,/W,H=1086,1448/);
 assert.match(script,/cv2\.inpaint/);
 assert.match(script,/eyelid-l|upper eyelid-l/);
 assert.match(script,/mouth inside/);
 assert.match(script,/upper lip/);
 assert.match(script,/lower lip/);
 assert.match(script,/back hair right/);
 assert.match(script,/headwear sun/);
 assert.match(script,/headwear moon/);
 assert.match(script,/accessories\.json/);
 assert.doesNotMatch(script,/GaussianBlur\(22\)|GaussianBlur\(8\)/);
});

test("Auxiliary ornament spring is bounded, and only hides native part when safe",()=>{
 assert.equal(typeof accessories.create,"function");
 assert.equal(typeof accessories.integrate,"function");
 assert.equal(accessories.partExists({}, "PartHeadAccessories"),false);
 assert.equal(accessories.partExists({
  setPartOpacityById(){},parts:{ids:["PartHeadAccessories"]}
 },"PartHeadAccessories"),true);
 assert.equal(accessories.partExists({
  setPartOpacityById(){},parts:{ids:["PartOther"]}
 },"PartHeadAccessories"),false);
 const body={x:0,vel:0};
 for(let t=0;t<10000;t+=16)accessories.integrate(body,.020,.016,1.8);
 assert.ok(Number.isFinite(body.x) && Math.abs(body.x-.020)<.01);
 assert.ok(Math.abs(body.vel)<.8);
 const src=read("bilik-antara-live2d-accessories-v05.js");
 assert.match(src,/if\(!partExists\(core,originalPart\)\)/);
 assert.match(src,/setPartOpacityById\(originalPart,0\)/);
 assert.match(src,/setPartOpacityById\(originalPart,1\)/);
 assert.doesNotMatch(src,/getUserMedia|new WebSocket|live-token/);
});

test("High fidelity rig rebuild uses 4096 atlas and isolated read-only auto rigger",()=>{
 const workflow=read(".github/workflows/aksara-live2d-rig-draft.yml");
 assert.match(workflow,/--atlas 4096/);
 assert.match(workflow,/build-aksara-live2d-quality-v05\.py/);
 assert.match(workflow,/repository: tsunehimatoi\/psd2live/);
 assert.match(workflow,/auto-rig-probe:[\s\S]*permissions:\s*\n\s*contents: read/);
 assert.match(workflow,/publish-experiment:[\s\S]*contents: write/);
 assert.match(workflow,/experiment\/aksara-voice-anime-2d-v1/);
 assert.doesNotMatch(workflow,/git push origin main/);
});

test("Quality only URL bypasses live microphone and preserves existing control script",()=>{
 const html=read("bilik-antara.html"),preview=read("bilik-antara-voice-experiment-v3.js");
 assert.match(html,/genuineLive2D=avatarMode==="live2d"/);
 assert.match(preview,/voice-preview/);
 const voice=read("bilik-antara-voice.js");
 assert.match(voice,/window\.AksaraVoiceAudio=\{analyser,context:playContext\}/);
 assert.match(voice,/ba:voice-avatar-text/);
});

test("v0.5 rig never reintroduces an opaque frozen original portrait beneath animated layers",()=>{
 const builder=read("scripts/build-aksara-live2d-quality-v05.py");
 assert.match(builder,/back hair root/);
 assert.match(builder,/opaque_full_portrait_layer":False/);
 assert.match(builder,/transparent_background":True/);
 assert.match(builder,/cv2\.inpaint\(coarse/);
 assert.doesNotMatch(builder,/\("background",\s*backdrop\.convert\("RGBA"\)\)/);
 assert.doesNotMatch(builder,/\("background",\s*original\)/);
});
