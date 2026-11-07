"use strict";
/* Real visual preview smoke: both mobile and desktop, no microphone or Live token. */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright");
const BASE=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
const out=path.resolve("browser-audit-artifacts");
fs.mkdirSync(out,{recursive:true});
async function audit(browser,label,viewport){
 const context=await browser.newContext({viewport,deviceScaleFactor:1});
 const page=await context.newPage();
 const tokens=[],errors=[],artRequests=[];
 page.on("request",req=>{
  if(req.url().includes("bilik-antara-live-token"))tokens.push(req.url());
  if(req.url().includes("bilik-antara-avatar-2d-art.webp"))artRequests.push(req.url());
 });
 page.on("pageerror",err=>errors.push(String(err.message)));
 try{
  await page.goto(BASE+"/bilik-antara.html?voice-avatar=2d&voice-preview=1&voice-avatar-demo=1",{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForSelector("#voicePanel.voice-ui-experiment-v3",{state:"attached",timeout:25000});
  await page.locator("#voiceLive").click();
  await page.waitForFunction(()=>window.AksaraAvatar2D?.snapshot?.().loaded===true,{timeout:25000});
  const before=await page.evaluate(()=>{
   const stage=document.getElementById("voiceAvatarStage");
   const canvas=stage.querySelector("canvas.aksara-anime-canvas");
   return {
    mode:window.AksaraAvatar2D.snapshot().renderer,
    canvasCount:stage.querySelectorAll("canvas.aksara-anime-canvas").length,
    glbCanvasCount:stage.querySelectorAll("canvas.voice-avatar-canvas").length,
    svgCount:stage.querySelectorAll("svg.aksara-2d-portrait").length,
    fallbackCount:stage.querySelectorAll(".voice-x-avatar-fallback").length,
    phase:document.getElementById("voiceStatus")?.textContent,
    canvasBounds:canvas?.getBoundingClientRect().toJSON(),
    pixels:canvas?Array.from(canvas.getContext("2d").getImageData(360,390,1,1).data):[],
    status:window.AksaraAvatar2D.snapshot()
   };
  });
  assert.equal(before.mode,"canvas2d",label+" must use new cinematic Canvas renderer");
  assert.equal(before.canvasCount,1,label+" should have one anime canvas");
  assert.equal(before.glbCanvasCount,0,label+" must not load a GLB canvas");
  assert.equal(before.svgCount,0,label+" obsolete vector must not remain");
  assert.equal(before.fallbackCount,0,label+" 3D still not loaded");
  assert.match(before.phase,/Pratonton reka bentuk sahaja/);
  assert.ok(before.canvasBounds?.width>100&&before.canvasBounds?.height>100,label+" canvas dimensions");
  assert.equal(before.pixels[3],255,label+" image pixels must paint opaque portrait");
  assert.ok(artRequests.length>=1,label+" self-hosted artwork must be requested");
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("ba:voice-avatar-text",{detail:{text:"Tahniah, seronok juga!"}})));
  await page.waitForFunction(()=>document.getElementById("voiceAvatarStage").dataset.expression==="smile",{timeout:6000});
  await page.evaluate(()=>document.getElementById("voicePanel").classList.add("voice-speaking"));
  await page.waitForFunction(()=>document.getElementById("voiceAvatarStage").dataset.avatarPhase==="speaking",{timeout:6000});
  await page.screenshot({path:path.join(out,"aksara-voice-anime-v02-"+label+".png")});
  assert.equal(tokens.length,0,label+" preview must never request a Live token");
  assert.deepEqual(errors,[],label+" browser errors");
  await page.locator("#voicePanel .voice-x-end").click();
  assert.equal(await page.locator("#voicePanel").isVisible(),false,label+" preview must close");
  console.log("2D anime "+label+" OK",JSON.stringify({mode:before.mode,painted:before.pixels[3],tokenRequests:tokens.length}));
 }finally{await context.close();}
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  await audit(browser,"desktop",{width:1365,height:800});
  await audit(browser,"mobile",{width:390,height:844});
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});