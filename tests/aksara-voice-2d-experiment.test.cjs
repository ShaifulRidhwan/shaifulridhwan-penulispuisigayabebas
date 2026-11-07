"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
test("2D avatar script parses and only attaches to the explicit gate",()=>{
 const source=read("bilik-antara-avatar-2d.js");
 assert.doesNotThrow(()=>new Function(source));
 assert.match(source,/params\.get\("voice-avatar"\)!=="2d"/);
 assert.match(source,/window\.AksaraVoiceAudio\?\.analyser/);
 assert.match(source,/ba:voice-avatar-text/);
 assert.match(source,/prefers-reduced-motion/);
 assert.match(source,/visibilitychange/);
 assert.doesNotMatch(source,/getUserMedia|WebSocket|live-token|brunette\.glb|import\("three"/);
});
test("2D artwork provides independent face, eyes, brows, mouth and hair layers",()=>{
 const svg=read("bilik-antara-avatar-2d.svg");
 assert.match(svg,/<svg\b[^>]+viewBox="0 0 500 620"/);
 for(const id of ["a2d-head","a2d-front-hair","a2d-back-hair","a2d-eye-left","a2d-eye-right","a2d-brow-left","a2d-brow-right","a2d-mouth","a2d-smile"])assert.ok(svg.includes('id="'+id+'"'),id);
 assert.doesNotMatch(svg,/<script|<foreignObject|<image\b|https?:\/\//i);
});
test("2D styles are scoped and don't change the baseline voice UI",()=>{
 const css=read("bilik-antara-avatar-2d.css");
 assert.match(css,/#voiceAvatarStage\.avatar-2d-active/);
 assert.match(css,/\.voice-x-avatar-fallback/);
 assert.match(css,/prefers-reduced-motion/);
});
test("2D option skips the 3D loader, while baseline URL still uses it",()=>{
 const html=read("bilik-antara.html");
 const ui=read("bilik-antara-voice-experiment-v3.js");
 assert.match(html,/anime2D\?"\.\/bilik-antara-avatar-2d\.js\?v=1":"\.\/bilik-antara-avatar\.js\?v=15"/);
 assert.match(html,/anime2D\)\{[\s\S]*bilik-antara-avatar-2d\.css\?v=1/);
 assert.match(ui,/if\(!anime2D\)stage\.append\(fallback\)/);
 assert.match(ui,/import\(anime2D\?"\.\/bilik-antara-avatar-2d\.js\?v=1":"\.\/bilik-antara-avatar\.js\?v=15"\)/);
 assert.match(ui,/previewStatus="Pratonton reka bentuk sahaja/);
});
test("current Gemini Live transport remains outside 2D files",()=>{
 const voice=read("bilik-antara-voice.js");
 assert.match(voice,/bilik-antara-live-token/);
 assert.match(voice,/window\.AksaraVoiceAudio=\{analyser,context:playContext\}/);
 assert.match(voice,/window\.dispatchEvent\(new CustomEvent\("ba:voice-avatar-text"/);
});