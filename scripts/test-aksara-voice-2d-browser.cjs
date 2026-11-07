"use strict";
/* Visual-only Playwright smoke: no Gemini requests and no microphone access. */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright");
const BASE=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
const out=path.resolve("browser-audit-artifacts");
fs.mkdirSync(out,{recursive:true});
async function inspect(browser,label,viewport){
 const context=await browser.newContext({viewport,deviceScaleFactor:1});
 const page=await context.newPage();
 const token=[],errors=[];
 page.on("request",request=>{if(request.url().includes("bilik-antara-live-token"))token.push(request.url());});
 page.on("pageerror",error=>errors.push(error.message));
 try{
  await page.goto(BASE+"/bilik-antara.html?voice-avatar=2d&voice-preview=1&voice-avatar-demo=1",{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForSelector("#voicePanel.voice-ui-experiment-v3",{state:"attached",timeout:20000});
  await page.locator("#voiceLive").click();
  await page.waitForFunction(()=>window.AksaraAvatar2D?.snapshot?.().loaded===true,{timeout:20000});
  const before=await page.evaluate(()=>{
   const stage=document.getElementById("voiceAvatarStage");
   return {
    svgCount:stage.querySelectorAll("svg.aksara-2d-portrait").length,
    canvasCount:stage.querySelectorAll("canvas.voice-avatar-canvas").length,
    fallbackCount:stage.querySelectorAll(".voice-x-avatar-fallback").length,
    phase:document.querySelector("#voiceStatus")?.textContent,
    loaded:window.AksaraAvatar2D.snapshot().loaded,
    bounds:stage.getBoundingClientRect().toJSON(),
    imageBounds:stage.querySelector(".aksara-2d-portrait")?.getBoundingClientRect().toJSON()
   };
  });
  assert.equal(before.svgCount,1,label+" expects one 2D svg");
  assert.equal(before.canvasCount,0,label+" 3D WebGL must never start");
  assert.equal(before.fallbackCount,0,label+" must not load the 3D still");
  assert.match(before.phase,/Pratonton reka bentuk sahaja/);
  assert.ok(before.imageBounds?.height>100,label+" portrait height");
  assert.ok(before.imageBounds?.width>100,label+" portrait width");
  assert.ok(before.bounds.width>0,label+" stage visible");
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("ba:voice-avatar-text",{detail:{text:"Tahniah, seronok juga!"}})));
  await page.waitForFunction(()=>document.getElementById("voiceAvatarStage").dataset.expression==="smile",{timeout:4000});
  await page.evaluate(()=>{const panel=document.getElementById("voicePanel");panel.classList.add("voice-speaking");});
  await page.waitForFunction(()=>Number(document.getElementById("a2d-mouth")?.getAttribute("ry"))>3,{timeout:4000});
  const mouth=await page.locator("#a2d-mouth").getAttribute("ry");
  assert.ok(Number(mouth)>3,label+" speaking mouth animation");
  assert.equal(token.length,0,label+" preview unexpectedly sent Live token request");
  assert.deepEqual(errors,[],label+" page errors");
  await page.screenshot({path:path.join(out,"aksara-voice-anime-2d-"+label+".png")});
  await page.locator("#voicePanel .voice-x-end").click();
  assert.equal(await page.locator("#voicePanel").isVisible(),false,label+" preview must close");
  console.log(label+" 2D avatar OK",JSON.stringify({svgCount:before.svgCount,mouth,tokenRequests:token.length}));
 }finally{await context.close();}
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  await inspect(browser,"desktop",{width:1365,height:800});
  await inspect(browser,"mobile",{width:390,height:844});
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});