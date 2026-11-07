"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright");
const BASE=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
const out=path.resolve("browser-audit-artifacts");fs.mkdirSync(out,{recursive:true});
async function verify(browser,label,viewport){
 const context=await browser.newContext({viewport,deviceScaleFactor:1});
 const page=await context.newPage(),token=[],errors=[],failedRequests=[];
 page.on("request",req=>{if(req.url().includes("bilik-antara-live-token"))token.push(req.url());});
 page.on("requestfailed",r=>failedRequests.push({url:r.url(),failure:r.failure()?.errorText}));
 page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto(BASE+"/bilik-antara.html?voice-avatar=live2d&voice-preview=1&voice-avatar-demo=1",{waitUntil:"domcontentloaded",timeout:35000});
  await page.waitForSelector("#voicePanel.voice-ui-experiment-v3",{timeout:20000});
  await page.locator("#voiceLive").click();
  await page.waitForFunction(()=>window.AksaraLive2DExperiment?.snapshot?.().status==="ready"||window.AksaraLive2DExperiment?.snapshot?.().failed,{timeout:35000});
  const result=await page.evaluate(()=>{
   const stage=document.getElementById("voiceAvatarStage");
   const state=window.AksaraLive2DExperiment.snapshot();
   const canvas=stage.querySelector("canvas.aksara-live2d-webgl");
   const gl=canvas?.getContext("webgl")||canvas?.getContext("webgl2");
   return {
    state,
    stageChildren:stage.children.length,
    realCanvas:stage.querySelectorAll("canvas.aksara-live2d-webgl").length,
    fakeCanvas:stage.querySelectorAll("canvas.aksara-anime-canvas,canvas.voice-avatar-canvas").length,
    fakeSVG:stage.querySelectorAll("svg.aksara-2d-portrait").length,
    fakeImage:stage.querySelectorAll(".voice-x-avatar-fallback").length,
    size:canvas?.getBoundingClientRect().toJSON(),
    hasGL:!!gl,
    notice:stage.querySelector(".aksara-live2d-status")?.textContent||""
   };
  });
  await page.screenshot({path:path.join(out,"aksara-live2d-real-"+label+".png")});
  assert.equal(token.length,0,label+" no Gemini token in preview");
  assert.deepEqual(errors,[],label+" page errors");
  assert.equal(result.fakeCanvas,0,label+" pseudo-rig not allowed");
  assert.equal(result.fakeSVG,0,label+" flat vector not allowed");
  assert.equal(result.fakeImage,0,label+" static 3D fallback not allowed");
  assert.equal(result.state.ready,true,label+" actual Cubism model must initialize: "+JSON.stringify({result,failedRequests}));
  assert.equal(result.realCanvas,1,label+" one WebGL model canvas");
  assert.ok(result.hasGL,label+" requires hardware accelerated WebGL");
  assert.ok(result.size?.height>100&&result.size?.width>100,label+" model stage dimensions");
  await page.waitForTimeout(500);
  const later=await page.evaluate(()=>window.AksaraLive2DExperiment.snapshot());
  assert.ok(later.lastFrame>=result.state.lastFrame,label+" animation loop alive");
  await page.locator("#voicePanel .voice-x-end").click();
  assert.equal(await page.locator("#voicePanel").isVisible(),false);
  console.log("LIVE2D REAL "+label+" OK",JSON.stringify({ready:result.state.ready,canvas:result.realCanvas,size:result.size,frame:later.lastFrame}));
 }finally{await context.close();}
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  await verify(browser,"desktop",{width:1365,height:800});
  await verify(browser,"mobile",{width:390,height:844});
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});