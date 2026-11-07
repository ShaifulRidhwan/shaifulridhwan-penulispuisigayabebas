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
  await page.waitForSelector("#voicePanel.voice-ui-experiment-v3",{state:"attached",timeout:20000});
  await page.locator("#voiceLive").click();
  // Guard against accidentally rendering the old faceless rig artifact.
  const moc=await page.request.get(BASE+"/assets/live2d/aksara/aksara-celestial-layered-draft.moc3");
  assert.equal(moc.status(),200,label+" actual Cubism .moc3 must be served");
  assert.ok((await moc.body()).length>1200000,label+" corrected face stacking model expected");
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
  // v0.4 regression: Cubism is animated by the new controller, not just painted.
  assert.equal(later.version,"0.5");
  assert.ok(later.motion&&Number.isFinite(later.motion.headAngle),"missing natural-motion controller");
  assert.equal(later.targetFPS,60,"Quality Mode must target 60 FPS even on Android");
  assert.ok(later.resolution>=2&&later.resolution<=3,"Quality Mode must use sharp 2-3x supersampling");
  if(label==="mobile")assert.equal(later.targetFPS,60,"no mobile battery fallback");
  await page.evaluate(()=>{
   window.dispatchEvent(new CustomEvent("ba:voice-avatar-text",{detail:{text:"Tahniah, syabas!"}}));
  });
  await page.waitForFunction(()=>window.AksaraLive2DExperiment?.snapshot().motion.emotion>.12,{timeout:5000});
  await page.evaluate(()=>document.getElementById("voicePanel").classList.add("voice-speaking"));
  await page.waitForFunction(()=>window.AksaraLive2DExperiment?.snapshot().motion.mouth>.08,{timeout:5000});
  const smooth=await page.evaluate(()=>({
   snapshot:window.AksaraLive2DExperiment.snapshot(),
   preview:document.getElementById("voiceStatus")?.textContent,
   panel:document.getElementById("voicePanel")?.className
  }));
  assert.match(smooth.preview,/Pratonton Live2D/);
  assert.match(smooth.panel,/voice-live2d-v05/);
  const modelResponse=await page.request.get(BASE+"/assets/live2d/aksara/aksara.model3.json");
  assert.equal(modelResponse.status(),200);
  const manifest=await modelResponse.json();
  if(manifest.FileReferences.Textures.some(name=>name.includes(".4096/"))){
    await page.waitForFunction(()=>{
      const v=window.AksaraLive2DExperiment?.snapshot?.();
      return v?.accessories?.active||v?.accessories?.reason!=="not-loaded";
    },null,{timeout:15000});
    const accessoryState=await page.evaluate(()=>window.AksaraLive2DExperiment.snapshot().accessories);
    assert.equal(accessoryState.active,true,"V0.5 high fidelity rig requires independently animated sun/moon accessories: "+JSON.stringify(accessoryState));
    assert.equal(accessoryState.sprites,2);
  }
  await page.screenshot({path:path.join(out,"aksara-live2d-v05-"+label+".png")});
  console.log("LIVE2D v0.5 "+label+" QUALITY OK",JSON.stringify({fps:smooth.snapshot.targetFPS,quality:smooth.snapshot.quality,mouth:smooth.snapshot.motion.mouth}));
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