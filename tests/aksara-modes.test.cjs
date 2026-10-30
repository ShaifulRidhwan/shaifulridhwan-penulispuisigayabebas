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
 assert.ok(Modes.instructions("gelap","support",false).includes("SOKONGAN GELAP"));
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
 assert.ok(html.includes("const payload={question,thoughtMode,"));
 assert.ok(css.includes('#thoughtMode[data-mode="gelap"]'));
 assert.ok(css.includes('.thought-mode-dialog .thought-choice-copy small'));
});
test("browser modules load before voice and retain cache-busted versions",()=>{
 assert.ok(html.indexOf("bilik-antara-modes.js?v=1")<html.indexOf("bilik-antara-voice.js?v=41"));
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
