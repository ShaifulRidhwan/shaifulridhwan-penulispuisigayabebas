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
 const pageErrors=[],tokenRequests=[];
 page.on("pageerror",error=>pageErrors.push(String(error.message)));
 page.on("request",request=>{
  if(/bilik-antara-live-token/.test(request.url()))tokenRequests.push(request.url());
 });
 try{
  await page.goto(ROOT+"/bilik-antara.html?voice-ui=3d",{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForSelector("#voicePanel.voice-ui-experiment-v3 .voice-v4-brand",{state:"attached",timeout:18000});
  const panel=page.locator("#voicePanel");
  assert.equal(await panel.isVisible(),false,"Panel must stay hidden before clicking Voice Chat");
  const launch=page.locator("#voiceLive");
  assert.equal(await launch.isEnabled(),true,"Voice Chat entry must be clickable");
  await launch.click({timeout:5000});
  await page.waitForSelector("#voicePanel .voice-x-hero",{state:"visible",timeout:6000});
  assert.equal(await panel.isVisible(),true,"Actual Voice Chat tap must open V4");
  assert.equal(await page.locator("#voicePanel .voice-x-live-text").innerText(),"PRATONTON UI");
  assert.match(await page.locator("#voiceStatus").innerText(),/Pratonton reka bentuk sahaja/);
  assert.equal(tokenRequests.length,0,"Visual preview must not call the Live token endpoint");
  await page.locator(".voice-x-avatar-fallback").waitFor({state:"attached"});
  await page.evaluate(async()=>{await document.fonts.ready;});
  const data=await page.evaluate(()=>{
   const $=sel=>document.querySelector(sel);
   const rect=sel=>{const r=$(sel).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,cx:r.x+r.width/2,cy:r.y+r.height/2};};
   const styles=(sel,pseudo)=>getComputedStyle($(sel),pseudo||null);
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
    heading:$(".voice-v4-brand").textContent.replace(/\s+/g," ").trim(),
    decorativeBrandMarks:document.querySelectorAll(".voice-v4-brand-mark").length,
    panelRadius:styles("#voicePanel").borderTopLeftRadius,
    settingsRadius:styles("#voicePanel .voice-x-aside").borderTopLeftRadius,
    dockRadius:styles("#voicePanel .voice-x-footer").borderTopLeftRadius,
    settingsGlass:styles("#voicePanel .voice-x-aside").backdropFilter,
    dockGlass:styles("#voicePanel .voice-x-footer").backdropFilter,
    endIcon:styles("#voicePanel .voice-x-end","::before").maskImage,
    micIcon:styles("#voiceMuteMic","::before").maskImage,
    speakerIcon:styles("#voiceMuteSpeaker","::before").maskImage,
    micGlyph:styles("#voiceMuteMic","::before").width,
    endGlyph:styles("#voicePanel .voice-x-end","::before").width,
    speakerGlyph:styles("#voiceMuteSpeaker","::before").width,
    waveParent:$("#voiceWave").parentElement.className,
    wavePosition:styles("#voiceWave").position,
    waveBox:rect("#voiceWave"),
    phaseBox:rect("#voicePhaseLabel"),
    fallbackScale:styles(".voice-x-avatar-fallback").transform,
    hangupBackground:styles(".voice-x-end").backgroundImage
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
  assert.equal(data.decorativeBrandMarks,0,"No extraneous icon beside AKSARA");
  assert.ok(parseFloat(data.settingsRadius)>=18,label+" settings must be rounded");
  assert.ok(parseFloat(data.dockRadius)>=18,label+" call dock must be rounded");
  assert.match(data.settingsGlass,/blur\(/,label+" settings must be frosted glass");
  assert.match(data.dockGlass,/blur\(/,label+" dock must be frosted glass");
  assert.ok(data.endIcon.includes("M3.3%209.1"),label+" end icon must use optically balanced SVG");
  assert.equal(data.hiddenDiagnostics,"none");
  assert.ok(data.modelFallback?.includes("portrait"),"Use captured existing 3D avatar only");
  assert.match(data.waveParent,/voice-dialogue-dock/,label+" waveform must belong to status panel");
  assert.equal(data.wavePosition,"relative",label+" waveform should not float over the chest");
  assert.ok(data.waveBox.bottom<=data.phaseBox.y+4,label+" waveform must be above phase label");
  assert.match(data.fallbackScale,/0\.935/,label+" fallback image needs wider framing");
  assert.match(data.hangupBackground,/180, 71, 78/,label+" hangup must retain red visual emphasis");
  console.log("V4 LAYOUT "+label+" "+JSON.stringify({mic:data.mic,end:data.end,speaker:data.speaker,hero:data.hero,aside:data.aside,footer:data.footer}));
  await page.screenshot({path:path.join(OUT,"aksara-voice-v4-"+label+".png"),fullPage:false});
  assert.ok(data.mic.cx<data.end.cx&&data.end.cx<data.speaker.cx,label+" wrong order");
  assert.ok(Math.abs(data.mic.cy-data.speaker.cy)<3,label+" mic/speaker not aligned");
  assert.ok(Math.abs(data.mic.w-data.end.w)<1,label+" end circle not same diameter");
  assert.equal(data.micGlyph,"27px",label+" mic icon size");
  assert.equal(data.endGlyph,"27px",label+" end icon size");
  assert.equal(data.speakerGlyph,"27px",label+" speaker icon size");
  assert.match(data.micIcon,/data:image\/svg\+xml/,label+" mic vector icon");
  assert.match(data.speakerIcon,/data:image\/svg\+xml/,label+" speaker vector icon");
  assert.ok(Math.abs(data.mic.w-data.speaker.w)<1,label+" speaker circle not same diameter");
  assert.ok(Math.abs(data.mic.h-data.end.h)<1,label+" end circle height differs");
  assert.ok(Math.abs(data.end.cx-(data.mic.cx+data.speaker.cx)/2)<4,label+" hangup must be centered");
  assert.ok(data.footer.bottom<=data.height+4,label+" controls clipped by viewport");
  const ui=page.locator("#voiceStyleTrigger");
  assert.equal(await ui.isVisible(),true,"Dialect control must remain accessible");
  await ui.click();
  assert.equal(await page.locator("#voiceStyleDialog").isVisible(),true,"Dialect menu must open");

  assert.equal(await page.locator(".voice-x-volume .voice-x-setting-label").innerText(),"Volume","Volume label must be in English");
  const glassQA=await page.evaluate(()=>{
   const get=s=>document.querySelector(s);
   const style=s=>getComputedStyle(get(s));
   const brand=style("#voicePanel .voice-v4-brand");
   const close=style("#voiceStop");
   const dialog=style("#voiceStyleDialog");
   const option=style("#voiceStyleDialog .voice-style-option");
   const selected=style("#voiceStyleDialog .voice-style-option.is-selected");
   return {
     brandRadius:brand.borderTopLeftRadius,brandGlass:brand.backdropFilter,brandBackground:brand.backgroundImage,
     closeWidth:close.width,closeHeight:close.height,closeRadius:close.borderTopLeftRadius,closeGlass:close.backdropFilter,
     dialogRadius:dialog.borderTopLeftRadius,dialogGlass:dialog.backdropFilter,dialogBackground:dialog.backgroundColor,
     optionRadius:option.borderTopLeftRadius,optionGlass:option.backdropFilter,
     selectedBackground:selected.backgroundImage,
     head:style("#voicePanel .voice-panel-head").backdropFilter
   };
  });
  assert.ok(parseFloat(glassQA.brandRadius)>=15,label+" brand pill not rounded");
  assert.match(glassQA.brandGlass,/blur\(/,label+" brand not glass");
  assert.equal(glassQA.closeWidth,glassQA.closeHeight,label+" X button not round");
  assert.ok(parseFloat(glassQA.closeRadius)>=19,label+" X button corners not round");
  assert.match(glassQA.closeGlass,/blur\(/,label+" X button not glass");
  assert.ok(parseFloat(glassQA.dialogRadius)>=24,label+" dialect modal not curved");
  assert.match(glassQA.dialogGlass,/blur\(28px\)/,label+" dialect modal not translucent glass");
  assert.ok(parseFloat(glassQA.optionRadius)>=15,label+" dialect options still squared");
  assert.match(glassQA.optionGlass,/blur\(/,label+" dialect options not frosted glass");
  assert.match(glassQA.selectedBackground,/linear-gradient/,label+" selected loghat missing glass state");
  console.log("V4.4 GLASS "+label+" "+JSON.stringify(glassQA));
  await page.screenshot({path:path.join(OUT,"aksara-voice-v44-loghat-"+label+".png"),fullPage:false});

  await page.locator("#voiceStyleDialog .voice-style-close").click();
  assert.equal(await page.locator("#voiceStyleDialog").isVisible(),false,"Dialect menu must close");
  await page.locator(".voice-x-end").click();
  assert.equal(await panel.isVisible(),false,"Center end-call must close the visual preview");
  assert.equal(await launch.isEnabled(),true,"Voice Chat entry must remain available after closing");
  await launch.click();
  assert.equal(await panel.isVisible(),true,"The same button must reopen the UI preview");
  await page.locator("#voiceStop").click();
  assert.equal(await panel.isVisible(),false,"Header close must close preview");
  assert.equal(tokenRequests.length,0,"No Gemini token requests may occur in UI preview");
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