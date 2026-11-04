"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const dialect=require("../bilik-antara-dialek.js");
const voice=require("../bilik-antara-voice-core-v3.js");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");

test("eight exact speech styles and Gaul first, with Kedah and Penang grouped",()=>{
 const ids=dialect.options.map(x=>x.id);
 assert.deepEqual(ids,["gaul","perak","kedah-penang","kelantan","terengganu","negeri-sembilan","sabah","sarawak"]);
 assert.equal(dialect.options[0].label,"Bahasa Gaul");
 assert.equal(dialect.label("kedah-penang"),"Kedah & Penang");
});
test("Bahasa Gaul is the default without aggressive imitation",()=>{
 assert.equal(dialect.label("auto"),"Bahasa Gaul");
 assert.match(dialect.instruction("gaul"),/do, lah, laa/);
 assert.match(dialect.instruction("gaul"),/Jangan sumbat setiap ayat/);
 assert.match(dialect.instruction("gaul"),/Aoede/);
});
test("Spoken dialect switches resolve specific styles without triggering on travel facts",()=>{
 for(const phrase of ["cuba loghat Kedah","cuba loghat Penang","boleh cakap loghat Pulau Pinang?"]){
  assert.equal(dialect.detectRequest(phrase)?.id,"kedah-penang");
 }
 assert.equal(dialect.detectRequest("tukar ke loghat Perak")?.id,"perak");
 assert.equal(dialect.detectRequest("cuba bahasa gaul laa")?.id,"gaul");
 assert.equal(dialect.detectRequest("guna bahasa santai balik")?.id,"gaul");
 assert.equal(dialect.detectRequest("Aku melawat Kelantan minggu depan"),null);
});
test("Old style ids migrate to permitted styles",()=>{
 assert.equal(dialect.label("standard"),"Bahasa Gaul");
 assert.equal(dialect.has("auto"),true);
 assert.equal(dialect.has("pulau-pinang"),true);
 assert.equal(dialect.has("unknown"),false);
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
 assert.match(html,/<option value="gaul">Bahasa Gaul<\/option>/);
 assert.match(html,/bilik-antara-dialek\.js\?v=4/);
 assert.match(html,/bilik-antara-voice-core-v3.js\?v=1/);
 assert.match(html,/bilik-antara-voice-v3.css\?v=3/);
});
test("Voice UI enhances native picker with accessible dialog, mode chip and control icons",()=>{
 const script=read("bilik-antara-voice.js");
 const css=read("bilik-antara-voice-v3.css");
 assert.match(script,/function mountEnhancedVoiceUI\(\)/);
 assert.match(script,/dialog\.showModal\(\)/);
 assert.match(script,/styleSelect\.dispatchEvent\(new Event\("change"/);
 assert.match(script,/voiceModeBadge/);
 assert.match(script,/row\.insertBefore\(modeChip,styleHint\)/);
 assert.doesNotMatch(script,/head\.insertBefore\(modeChip/);
 assert.match(script,/voice-ui-toggle/);
 assert.match(script,/confirmedStyleId=activeDialect/);
 assert.match(css,/\.aksara-voice-style-dialog/);
 assert.match(css,/min-height:44px/);
 assert.match(css,/voice-status\[data-compact="true"\]/);
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
