"use strict";
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
async function testLive2D(browser,label,viewport){
 const context=await browser.newContext({viewport,deviceScaleFactor:1});
 const page=await context.newPage(),tokenCalls=[],uncaught=[];
 page.on("request",req=>{if(req.url().includes("bilik-antara-live-token"))tokenCalls.push(req.url());});
 page.on("pageerror",err=>uncaught.push(err.message));
 try{
  await page.goto(BASE+"/bilik-antara.html?voice-avatar=live2d&voice-preview=1&voice-avatar-demo=1",{waitUntil:"domcontentloaded",timeout:35000});
  await page.waitForSelector("#voicePanel.voice-ui-experiment-v3",{state:"attached",timeout:20000});
  await page.locator("#voiceLive").click();
  await page.waitForFunction(()=>window.AksaraLive2DExperiment?.snapshot?.().status==="model-missing",{timeout:12000});
  const v=await page.evaluate(()=>{
   const stage=document.getElementById("voiceAvatarStage");
   return {
    status:window.AksaraLive2DExperiment.snapshot(),
    oldCanvas:stage.querySelectorAll("canvas.aksara-anime-canvas, canvas.voice-avatar-canvas").length,
    flatSVG:stage.querySelectorAll("svg.aksara-2d-portrait").length,
    imageFallback:stage.querySelectorAll(".voice-x-avatar-fallback").length,
    notice:stage.querySelector(".aksara-live2d-status")?.textContent||"",
    stageStyle:getComputedStyle(stage).display
   };
  });
  assert.equal(v.status.ready,false,label+" should not claim rig readiness");
  assert.equal(v.status.modelLoaded,false,label+" must not claim to have a real Cubism rig");
  assert.match(v.notice,/Rig Live2D belum dipasang/i,label+" must explain missing rig");
  assert.equal(v.oldCanvas,0,label+" never draw the old pseudo-rig");
  assert.equal(v.flatSVG,0,label+" never draw the old SVG cartoon");
  assert.equal(v.imageFallback,0,label+" never display the old 3D portrait fallback");
  assert.equal(tokenCalls.length,0,label+" preview cannot call Gemini Live");
  assert.deepEqual(uncaught,[],label+" page errors");
  await page.locator("#voicePanel .voice-x-end").click();
  assert.equal(await page.locator("#voicePanel").isVisible(),false,label+" preview closes cleanly");
  console.log("LIVE2D V0.3 "+label+" missing-rig gate correct");
 }finally{await context.close();}
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  await testLive2D(browser,"desktop",{width:1365,height:800});
  await testLive2D(browser,"mobile",{width:390,height:844});
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});