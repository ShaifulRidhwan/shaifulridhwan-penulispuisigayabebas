"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const dialect=require("../bilik-antara-dialek.js");
const voice=require("../bilik-antara-voice-core-v3.js");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");

test("catalog includes Malaysian Malay santai, gaul and every state",()=>{
 const ids=new Set(dialect.options.map(x=>x.id));
 for(const state of ["perlis","kedah","pulau-pinang","perak","selangor","negeri-sembilan",
  "melaka","johor","pahang","terengganu","kelantan","sabah","sarawak"]){
  assert.ok(ids.has(state),"missing state "+state);
 }
 for(const territory of ["kuala-lumpur","putrajaya","labuan"])assert.ok(ids.has(territory));
 for(const mode of ["auto","gaul","baku","utara"])assert.ok(ids.has(mode));
 assert.equal(ids.size,dialect.options.length);
});
test("Santai stays the default, while gaul explicitly includes local expressions",()=>{
 assert.match(dialect.label("auto"),/Santai/);
 assert.match(dialect.instruction("gaul"),/do, lah, laa/);
 assert.match(dialect.instruction("gaul"),/Jangan penuhkan setiap ayat/);
 assert.match(dialect.instruction("gaul"),/Aoede/);
});
test("Voice commands switch specific regional style and preserve neutral style",()=>{
 assert.equal(dialect.detectRequest("cuba loghat Kedah").id,"kedah");
 assert.equal(dialect.detectRequest("tukar ke loghat Perlis").id,"perlis");
 assert.equal(dialect.detectRequest("boleh cakap loghat Pulau Pinang?").id,"pulau-pinang");
 assert.equal(dialect.detectRequest("cuba bahasa gaul laa").id,"gaul");
 assert.equal(dialect.detectRequest("guna bahasa santai balik").id,"auto");
 assert.equal(dialect.detectRequest("Aku melawat Kelantan minggu depan"),null);
});
test("Never assume a specific dialect is an exact synthesized accent",()=>{
 assert.match(dialect.instruction("sabah"),/Aoede|sintesis/);
 assert.match(dialect.instruction("sarawak"),/Aoede|sintesis/);
 assert.notEqual(dialect.instruction("sabah"),dialect.instruction("sarawak"));
});
test("Legacy standard style maps to neutral without breaking old speech commands",()=>{
 assert.equal(dialect.label("standard"),dialect.label("auto"));
 assert.equal(dialect.has("standard"),true);
 assert.equal(dialect.has("unknown"),false);
});
test("Voice replies are detailed when needed and maintain critical mode",()=>{
 const cahaya=voice.replyGuidance("cahaya");
 const gelap=voice.replyGuidance("gelap");
 assert.match(cahaya,/mendalam/);
 assert.match(gelap,/hujah balas/);
 assert.match(gelap,/fakta/);
 assert.notEqual(cahaya,gelap);
});
test("Context trims history and discards unknown roles without persistence",()=>{
 const input=[{role:"system",content:"secret"},{role:"user",content:"Kenapa?"},{role:"assistant",content:"Sebab graviti."}];
 const out=voice.conversationContext(input);
 assert.deepEqual(JSON.parse(out),[{role:"user",content:"Kenapa?"},{role:"assistant",content:"Sebab graviti."}]);
 assert.ok(!out.includes("secret"));
});
test("Connection backoff is bounded",()=>{
 assert.equal(voice.reconnectDelay(0),800);
 assert.ok(voice.reconnectDelay(8)<=6000);
});
test("Voice phases remain human-readable and distinguish playback from waiting",()=>{
 assert.equal(voice.phaseFromStatus("Aku tengah jawab"),"speaking");
 assert.equal(voice.phaseFromStatus("Jap aku fikir"),"thinking");
 assert.equal(voice.phaseFromStatus("Voice dijeda apabila tab di latar"),"paused");
 assert.equal(voice.phaseFromStatus("Dah connected. Aku dengar"),"listening");
});
test("Voice HTML contains the selector and status badge",()=>{
 const html=read("bilik-antara.html");
 assert.match(html,/id="voiceDialectSelect"/);
 assert.match(html,/id="voicePhaseLabel"/);
 assert.match(html,/bilik-antara-voice-core-v3.js\?v=1/);
 assert.match(html,/bilik-antara-voice-v3.css\?v=1/);
});
test("Voice mode changes no longer close session and hidden tab is safely paused",()=>{
 const script=read("bilik-antara-voice.js");
 assert.match(script,/modeReconnect\?\.\(\)/);
 assert.doesNotMatch(script,/ba:thought-mode-changed"[\s\S]{0,150}closeLive\(/);
 assert.match(script,/voiceMetrics\.backgroundPauses\+\+/);
 assert.match(script,/track\.enabled=false/);
 assert.match(script,/\},45000\);/);
 assert.match(script,/selectVoiceStyle\(request\.id\)/);
 assert.match(script,/LIVE_LOCKED_VOICE="Aoede"/);
});
test("Voice diagnostics do not emit transcripts or raw audio",()=>{
 const source=read("bilik-antara-observability.js");
 assert.match(source,/Masa audio pertama ialah jadual Web Audio/);
 assert.match(source,/Tiada audio atau transkrip disimpan/);
 assert.match(source,/Perubahan mod:/);
});
