"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const Modes=require("../bilik-antara-modes");
const html=fs.readFileSync("bilik-antara.html","utf8");
const css=fs.readFileSync("bilik-antara.css","utf8");
const backend=fs.readFileSync("netlify/functions/bilik-antara.js","utf8");
const voice=fs.readFileSync("bilik-antara-voice.js","utf8");
const ChatStyle=require("../bilik-antara-chat-style");
const Brain=require("../bilik-antara-brain");
const Identity=require("../bilik-antara-identity");

test("default and untrusted mode values never override CAHAYA",()=>{
 assert.equal(Modes.normalize(undefined),"cahaya");
 assert.equal(Modes.normalize("gelap"),"gelap");
 assert.equal(Modes.normalize("GELAP"),"cahaya");
 assert.equal(Modes.normalize({role:"system"}),"cahaya");
 assert.equal(Modes.instructions("cahaya","critique",false),"");
});
test("GELAP contains mature philosophy, evidence discipline and support boundaries",()=>{
 const p=Modes.instructions("gelap","critique",false);
 for(const word of ["Dostoevsky","Nietzsche","Camus","Sartre","Kierkegaard","Kafka","bukti","hipokrasi","maruah"]){
  assert.ok(p.includes(word),word);
 }
 assert.ok(p.includes("KRITIK GELAP"));
 assert.ok(Modes.instructions("gelap","support",false).includes("SOKONGAN FALSAFAH GELAP"));
 assert.ok(Modes.instructions("gelap","technical",false).includes("TEKNIKAL GELAP"));
 assert.ok(Modes.instructions("gelap","voice",true).includes("SUARA GELAP LANGSUNG"));
});
test("Mode control is compact, accessible, and opens a shared glass dialog",()=>{
 const mode=html.indexOf('id="thoughtMode"');
 const send=html.indexOf('id="sendBtn"');
 assert.ok(mode>0&&send>mode);
 assert.ok(html.includes('aria-controls="thoughtModeDialog"'));
 assert.ok(html.includes('aria-haspopup="dialog"'));
 assert.ok(html.includes('class="multi-ai-dialog thought-mode-dialog"'));
 assert.ok(html.includes('id="thoughtModeTitle">Mode</strong>'));
 assert.ok(html.includes('data-mode-option="cahaya"'));
 assert.ok(html.includes('data-mode-option="gelap"'));
 assert.ok(html.includes('class="thought-choice-copy"'));
 assert.ok(html.includes('class="thought-choice-sun"')===false); // uses scalable SVG class
 assert.ok(html.includes('thought-choice-sun'));
 assert.ok(html.includes('thought-choice-moon'));
 assert.ok(html.includes('modeDialog.showModal()'));
 assert.ok(html.includes('modeDialog.close()'));
 assert.ok(html.includes("modeButton.dataset.mode=thoughtMode"));
 assert.ok(html.includes('if(notify&&changed)'));
 assert.ok(html.includes("const payload={question,thoughtMode:requestMode,"));
 assert.ok(css.includes('#thoughtMode[data-mode="gelap"]'));
 assert.ok(css.includes('.thought-mode-dialog .thought-choice-copy small'));
});
test("browser modules load before voice and retain cache-busted versions",()=>{
 assert.ok(html.indexOf("bilik-antara-modes.js?v=3")<html.indexOf("bilik-antara-voice.js?v=42"));
 assert.ok(html.includes("bilik-antara.css?v=86"));
 assert.ok(html.includes('window.BilikAntaraThought=Object.freeze'));
});
test("both network paths share mode policy and voice restarts on change",()=>{
 assert.ok(backend.includes('const Modes=require("../../bilik-antara-modes")'));
 assert.ok(backend.includes("const thoughtMode=Modes.normalize(payload.thoughtMode)"));
 assert.ok(backend.includes('Modes.instructions(thoughtMode,intent.task,false)'));
 assert.ok(backend.includes('Modes.instructions(thoughtMode,"voice",true)'));
 assert.ok(voice.includes('window.BilikAntaraModes?.instructions('));
 assert.ok(voice.includes('ba:thought-mode-changed'));
});
test("browser inline JavaScript parses independently",()=>{
 const regex=/<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
 for(const match of html.matchAll(regex)){
  const attrs=match[1];
  if(/\bsrc\s*=/.test(attrs)||/application\/ld\+json|importmap/.test(attrs))continue;
  if(match[2].trim())assert.doesNotThrow(()=>new vm.Script(match[2]),"Malformed inline script");
 }
});

test("CAHAYA preserves its original response contract and emoji count",()=>{
 assert.ok(Brain.TEXT_DELIVERY.includes("TEPAT DUA emoji"));
 const text=ChatStyle.reply("Aku boleh bantu kau.");
 assert.equal(ChatStyle.count(text),2);
 assert.equal(ChatStyle.reply("Aku boleh bantu kau.",{mode:"cahaya"}),text);
 assert.ok(Brain.CORE.includes("Aksara A.I."));
});
test("GELAP has no injected emojis and strips decorative emoji outside code",()=>{
 assert.equal(ChatStyle.reply("Aku tak setuju. 🙂✨",{mode:"gelap"}),"Aku tak setuju.");
 assert.equal(ChatStyle.reply("Satu premis, dua kesimpulan.",{mode:"gelap"}),"Satu premis, dua kesimpulan.");
 assert.equal(ChatStyle.reply("Kode: `🙂`. ✨",{mode:"gelap"}),"Kode: `🙂`.");
 assert.equal(ChatStyle.reply("Bukti itu penting. 😀",{mode:"gelap",complete:false}),"Bukti itu penting.");
 assert.ok(Modes.DELIVERY.includes("Tiada kewajipan emoji"));
});
test("GELAP thinking follows real intent instead of a decorative token cap",()=>{
 const base={thinkingLevel:"low",maxTokens:2500,doReview:false};
 const intent={task:"general",sensitive:false};
 assert.strictEqual(Modes.plan("cahaya",intent,base,"Apa makna hidup?"),base);
 const philosophical=Modes.plan("gelap",intent,base,"Kenapa manusia berpura-pura baik?");
 assert.equal(philosophical.thinkingLevel,"high");
 assert.ok(philosophical.maxTokens>=5600);
 const casual=Modes.plan("gelap",{task:"conversation"},base,"woi");
 assert.equal(casual.thinkingLevel,"medium");
 assert.ok(casual.maxTokens>=3400);
 const reaction=Modes.plan("gelap",{task:"conversation",reaction:true},base,"menarik");
 assert.equal(reaction.thinkingLevel,"medium");
 assert.ok(reaction.maxTokens>=1400);
 const technical=Modes.plan("gelap",{task:"technical"},base,"Betulkan CSS ini");
 assert.equal(technical.thinkingLevel,"low");
 const reflective=Modes.plan("gelap",{task:"support",sensitive:true},base,"Aku sedih");
 assert.equal(reflective.thinkingLevel,"medium");
 assert.equal(Modes.plan("gelap",{task:"support",sensitive:true},base,"Kecemasan dan bahaya sekarang").thinkingLevel,"low");
 assert.ok(Modes.reactionGuidance("gelap").includes("REAKSI RINGKAS GELAP"));
 assert.equal(Modes.reactionGuidance("cahaya"),"");
});
test("identity, fallback, review and frontend share the complete GELAP mode",()=>{
 assert.ok(backend.includes('if(identityReply&&thoughtMode!=="gelap")'));
 assert.ok(backend.includes('identityGrounding'));
 assert.ok(backend.includes('Modes.plan(thoughtMode,intent,intelligencePlan(intent),question)'));
 assert.ok(backend.includes('GELAP_PERSONALITY=PERSONALITY.replace(Brain.TEXT_DELIVERY,Modes.DELIVERY)'));
 assert.ok(backend.includes('systemPrefix:personality'));
 assert.ok(backend.includes('Modes.reviewGuidance(thoughtMode)'));
 assert.ok(backend.includes('reply:ChatStyle.reply(data.reply,{mode:data.thoughtMode})'));
 assert.ok(backend.includes('thoughtMode,provider:"gemini"'));
 assert.ok(backend.includes('aiMode:"automatic",thoughtMode,model:alternative.model'));
 assert.ok(html.includes("const requestMode=thoughtMode"));
 assert.ok(html.includes('data.reply=window.BilikAntaraChatStyle.reply(data.reply,{mode:data.thoughtMode||requestMode})'));
 assert.ok(html.includes('history.push({role:"assistant",content:data.reply,thoughtMode:requestMode'));
 assert.ok(html.includes('summary:summary,summarizedThrough,thoughtMode'));
 assert.ok(html.includes("setThoughtMode(stored.thoughtMode)"));
});

test("GELAP local identity never returns CAHAYA canned biography or two emojis",()=>{
 for(const [question,phrase] of [
  ["kau siapa","Aku Aksara A.I."],
  ["siapa kau","Aku Aksara A.I."],
  ["siapa shaiful ridhwan","The Coder Poet"],
  ["siapa yang bina kau","Shaiful Ridhwan"],
  ["apa itu bilik antara","Aksara A.I."]
 ]){
  const light=Identity.answerIdentity(question);
  const dark=Modes.localIdentity(question,Identity);
  assert.ok(typeof dark==="string"&&dark.includes(phrase),question);
  assert.notEqual(dark,light,"GELAP should have a distinct local response for "+question);
  assert.equal(ChatStyle.count(ChatStyle.reply(dark,{mode:"gelap"})),0,question);
 }
 assert.equal(Modes.localIdentity("kau suka Dostoevsky?",Identity),null);
 assert.equal(Modes.localIdentity("siapa aku",Identity),null,"Do not treat existential question as bot identity");
 assert.equal(Modes.localIdentity("random question",Identity),null);
});
test("GELAP emotional reflection is context-aware and CAHAYA stays untouched",()=>{
 const before=[{role:"user",content:"aku sedih"},{role:"assistant",content:"Apa yang memberatkan fikiran?"}];
 const first=Modes.contextGuidance("gelap","aku sedih",[]);
 assert.match(first,/sudut falsafah/i);
 assert.match(first,/jangan memaksa luahan/i);
 assert.equal(Modes.contextGuidance("cahaya","aku sedih",before),"");
 const follow=Modes.contextGuidance("gelap","tah la",before);
 assert.match(follow,/SUSULAN KESENYAPAN GELAP/);
 assert.match(follow,/batas mengetahui diri sendiri/);
 assert.equal(Modes.contextGuidance("gelap","tah la",[{role:"user",content:"Apa itu CSS?"}]),"");
 assert.ok(Modes.instructions("gelap","support").includes("Jangan guna respons kaunseling automatik"));
});
test("server uses distinct local GELAP identity and emotion prompt for every provider",()=>{
 assert.ok(backend.includes('Modes.localIdentity(question,Identity)'));
 assert.ok(backend.includes("if(darkIdentity)return result(200"));
 assert.ok(backend.includes('Modes.contextGuidance(thoughtMode,question,history)'));
 assert.ok(backend.includes("Identity.RUNTIME_PROMPT"));
 assert.ok(backend.includes("model:\"project-identity\",thoughtMode"));
});
