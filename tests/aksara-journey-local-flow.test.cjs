"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const Journey=require("../bilik-antara-journey");
const Identity=require("../bilik-antara-identity");

test("all thirty chapters resolve locally, in order, including introduction and ending",()=>{
 assert.equal(Journey.steps.length,30);
 for(let i=0;i<Journey.steps.length;i++){
  const q=Journey.steps[i].question;
  const chapter=Journey.resolve(q,Identity,"journey-button");
  assert.ok(chapter,"Missing local answer for "+q);
  assert.equal(chapter.index,i);
  assert.equal(chapter.provider,"local");
  assert.equal(chapter.model,i<2?"project-identity":"project-journey");
  assert.ok(chapter.reply.length>20,"Empty chapter "+q);
  const next=Journey.steps[i+1];
  assert.equal(chapter.next?.question||null,next?.question||null);
 }
 assert.equal(Journey.resolve(Journey.steps.at(-1).question,Identity,"journey-button").next,null);
});

test("typing a question is never an implicit invitation to start the scripted journey",()=>{
 const chapter=Journey.steps[14].question;
 assert.equal(chapter,"Code Engine Aku Boleh Buat Apa?");
 assert.equal(Journey.resolve(chapter,Identity,"typed"),null);
 assert.equal(Journey.resolve(chapter,Identity),null);
 assert.equal(Journey.resolve("apa maksud compiler?",Identity,"journey-button"),null);
 assert.equal(Journey.resolve(chapter,Identity,"journey-button").provider,"local");
});

test("chapter buttons do not use submit, retries, quota or API calls",()=>{
 const html=fs.readFileSync(path.join(__dirname,"../bilik-antara.html"),"utf8");
 const start=html.indexOf("function playJourney(question){");
 const end=html.indexOf("\nfunction welcome(",start);
 assert.ok(start>=0&&end>start);
 const chapterHandler=html.slice(start,end);
 assert.match(chapterHandler,/AksaraJourney\?\.resolve/);
 assert.match(chapterHandler,/provider:"local"/);
 for(const forbidden of ["fetch(","ask(","askWithReconnect(","requestSubmit(","quotaCooldownUntil","selectedFile","fileState","codeContext"]){
  assert.ok(!chapterHandler.includes(forbidden),"Local journey wrongly depends on "+forbidden);
 }
 assert.match(html,/suggestion\.addEventListener\("click",\(\)=>\{playJourney\(journeyNext\.question\);\}\)/);
 assert.match(html,/playJourney\(btn\.textContent\.trim\(\)\)/);
 assert.ok(!html.includes("const journey=window.AksaraJourney?.answer(payload.question)"));
 assert.match(html,/const journeyNext=null; \/\/ Provider replies never silently join the fixed narrative/);
});

test("normal free typing cannot accidentally trigger the static server journey",()=>{
 const server=fs.readFileSync(path.join(__dirname,"../netlify/functions/bilik-antara.js"),"utf8");
 assert.ok(server.includes("payload.journeyStep===true&&!media.length&&!documentText"));
});
