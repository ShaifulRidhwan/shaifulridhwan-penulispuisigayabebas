"use strict";
/* AKSARA Voice V4 visual regression, without starting microphone, socket or AI.
 * Browser viewport tests the actual site and captures the experimental UI. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const ROOT=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
const OUT=path.resolve("browser-audit-artifacts");
fs.mkdirSync(OUT,{recursive:true});
async function audit(browser,label,viewport){
 const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:label!=="desktop",hasTouch:label!=="desktop"});
 const page=await context.newPage();
 const pageErrors=[];
 page.on("pageerror",error=>pageErrors.push(String(error.message)));
 try{
  await page.goto(ROOT+"/bilik-antara.html?voice-ui=3d",{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForSelector("#voicePanel.voice-ui-experiment-v3 .voice-v4-brand",{state:"attached",timeout:18000});
  const panel=page.locator("#voicePanel");
  assert.equal(await panel.isVisible(),false,"Panel must stay hidden before the call starts");
  await page.evaluate(()=>{document.getElementById("voicePanel").hidden=false;});
  await page.waitForSelector("#voicePanel .voice-x-hero",{state:"visible",timeout:6000});
  await page.locator(".voice-x-avatar-fallback").waitFor({state:"attached"});
  await page.evaluate(async()=>{await document.fonts.ready;});
  const data=await page.evaluate(()=>{
   const $=sel=>document.querySelector(sel);
   const rect=sel=>{const r=$(sel).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,cx:r.x+r.width/2,cy:r.y+r.height/2};};
   const styles=sel=>getComputedStyle($(sel));
   return {
    width:innerWidth,height:innerHeight,pageWidth:document.documentElement.scrollWidth,
    panel:rect("#voicePanel"),header:rect("#voicePanel .voice-panel-head"),
    hero:rect("#voicePanel .voice-x-hero"),aside:rect("#voicePanel .voice-x-aside"),
    footer:rect("#voicePanel .voice-x-footer"),
    mic:rect("#voiceMuteMic"),end:rect("#voicePanel .voice-x-end"),speaker:rect("#voiceMuteSpeaker"),
    brandFont:styles(".voice-v4-wordmark strong").fontFamily,
    bodyFont:styles("#voicePanel").fontFamily,
    glass:styles("#voicePanel").backdropFilter||styles("#voicePanel").webkitBackdropFilter,
    muteIcon:styles("#voiceMuteMic","::before").maskImage,
    heroPhase:$(".voice-x-hero").dataset.phase||"",
    hiddenDiagnostics:styles("#voiceObserveV2").display,
    modelFallback:$(".voice-x-avatar-fallback")?.getAttribute("src"),
    heading:$(".voice-v4-brand").textContent.replace(/\s+/g," ").trim()
   };
  });
  assert.ok(data.pageWidth<=data.width+4,label+" horizontal overflow "+JSON.stringify(data));
  assert.ok(data.panel.w>300&&data.panel.h>420,label+" panel dimensions "+JSON.stringify(data));
  assert.ok(data.header.h>=58,label+" header squashed");
  assert.ok(data.hero.h>=170,label+" avatar cropped by settings");
  assert.ok(data.aside.h>50&&data.footer.h>=65,label+" settings / controls missing");
  assert.match(data.bodyFont,/DM Sans/);
  assert.match(data.brandFont,/Space Grotesk/);
  assert.match(data.glass,/blur\(/);
  assert.match(data.heading,/AKSARA.*VOICE CHAT/);
  assert.equal(data.hiddenDiagnostics,"none");
  assert.ok(data.modelFallback?.includes("portrait"),"Use captured existing 3D avatar only");
  assert.ok(data.mic.cx<data.end.cx&&data.end.cx<data.speaker.cx,label+" wrong order");
  assert.ok(Math.abs(data.mic.cy-data.speaker.cy)<3,label+" mic/speaker not aligned");
  assert.ok(Math.abs(data.end.cx-(data.mic.cx+data.speaker.cx)/2)<4,label+" hangup must be centered");
  assert.ok(data.footer.bottom<=data.height+4,label+" controls clipped by viewport");
  const ui=page.locator("#voiceStyleTrigger");
  assert.equal(await ui.isVisible(),true,"Dialect control must remain accessible");
  await ui.click();
  assert.equal(await page.locator("#voiceStyleDialog").isVisible(),true,"Dialect menu must open");
  await page.locator("#voiceStyleDialog .voice-style-close").click();
  assert.equal(await page.locator("#voiceStyleDialog").isVisible(),false,"Dialect menu must close");
  await page.screenshot({path:path.join(OUT,"aksara-voice-v4-"+label+".png"),fullPage:false});
  assert.deepEqual(pageErrors,[],label+" browser errors: "+pageErrors.join("; "));
  console.log("Voice V4 "+label+" PASS: glass, typography, hero, icons, controls, dialog, bounds.");
 }finally{await context.close();}
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  await audit(browser,"desktop",{width:1280,height:800});
  await audit(browser,"mobile",{width:390,height:844});
  await audit(browser,"compact",{width:360,height:640});
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});