"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
test("2D cinematic avatar script parses, is opt-in and reuses the output analyser",()=>{
 const source=read("bilik-antara-avatar-2d.js");
 assert.doesNotThrow(()=>new Function(source));
 assert.match(source,/params\.get\("voice-avatar"\)!=="2d"/);
 assert.match(source,/window\.AksaraVoiceAudio\?\.analyser/);
 assert.match(source,/ba:voice-avatar-text/);
 assert.match(source,/prefers-reduced-motion/);
 assert.match(source,/visibilitychange/);
 assert.match(source,/requestAnimationFrame/);
 assert.match(source,/getContext\("2d"/);
 assert.match(source,/bilik-antara-avatar-2d-art\.webp\?v=2/);
 assert.doesNotMatch(source,/getUserMedia|WebSocket|live-token|brunette\.glb|import\("three"/);
});
test("cinematic artwork is an optimized self-hosted WebP",()=>{
 const art=fs.readFileSync(path.join(root,"bilik-antara-avatar-2d-art.webp"));
 assert.equal(art.toString("ascii",0,4),"RIFF");
 assert.equal(art.toString("ascii",8,12),"WEBP");
 assert.ok(art.length>10000,"Missing image bytes");
 assert.ok(art.length<150000,"Artwork too heavy for mobile");
});
test("2D visual stage is scoped and never hides core controls",()=>{
 const css=read("bilik-antara-avatar-2d.css");
 assert.match(css,/#voiceAvatarStage\.avatar-2d-active/);
 assert.match(css,/\.aksara-anime-canvas/);
 assert.match(css,/\.voice-x-avatar-fallback/);
 assert.match(css,/prefers-reduced-motion/);
 assert.doesNotMatch(css,/voiceMuteMic|voiceMuteSpeaker|voiceVolume/);
});
test("anime module selector leaves original 3D renderer intact without the gate",()=>{
 const html=read("bilik-antara.html"),ui=read("bilik-antara-voice-experiment-v3.js");
 assert.match(html,/anime2D\?"\.\/bilik-antara-avatar-2d\.js\?v=2":"\.\/bilik-antara-avatar\.js\?v=15"/);
 assert.match(html,/if\(anime2D\|\|genuineLive2D\)\{/);
 assert.match(html,/bilik-antara-avatar-2d\.css\?v=2/);
 assert.match(ui,/if\(!anime2D&&!genuineLive2D\)stage\.append\(fallback\)/);
 assert.match(ui,/import\(anime2D\?"\.\/bilik-antara-avatar-2d\.js\?v=2":"\.\/bilik-antara-avatar\.js\?v=15"\)/);
 assert.match(ui,/previewStatus="Pratonton reka bentuk sahaja/);
});
test("Gemini Live transport still supplies original speech output and transcript events",()=>{
 const voice=read("bilik-antara-voice.js");
 assert.match(voice,/bilik-antara-live-token/);
 assert.match(voice,/window\.AksaraVoiceAudio=\{analyser,context:playContext\}/);
 assert.match(voice,/window\.dispatchEvent\(new CustomEvent\("ba:voice-avatar-text"/);
});