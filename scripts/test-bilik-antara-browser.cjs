"use strict";
/* Reproducible desktop/mobile smoke audit of Bilik Antara with NO AI API keys.
 * Runs against a local static server, never sends prompts to an external AI. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const BASE=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
const OUT=path.join(process.cwd(),"browser-audit-artifacts");
fs.mkdirSync(OUT,{recursive:true});
const results=[];
async function audit(browser,label,options){
 const context=await browser.newContext(options);
 const page=await context.newPage();
 const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 page.on("response",response=>{
  if(response.status()>=400&&response.url().startsWith(BASE)&&
    !response.url().includes("/.netlify/functions/"))errors.push("HTTP "+response.status()+" "+response.url());
 });
 try{
  await page.goto(BASE+"/bilik-antara.html",{waitUntil:"domcontentloaded",timeout:30000});
  await page.locator("#voiceLive").waitFor({timeout:15000});
  await page.waitForFunction(()=>document.querySelector(".message.ai")!==null,{timeout:10000}).catch(()=>{});
  const state=await page.evaluate(()=>{
   const style=sel=>getComputedStyle(document.querySelector(sel));
   const frame=style(".glass-frame-orbit"),light=style(".frame-glow--light"),dark=style(".frame-glow--shadow");
   const hazeNode=document.querySelector(".world-haze");
    const haze=hazeNode?getComputedStyle(hazeNode):null;
   const glass=style(".conversation"),rect=document.querySelector(".conversation").getBoundingClientRect();
   const resource=performance.getEntriesByType("resource").map(x=>x.name);
   return {
    width:window.innerWidth,documentWidth:document.documentElement.scrollWidth,
    chatTop:rect.top,chatHeight:rect.height,
    framePointer:frame.pointerEvents,lightAnimation:light.animationName,darkAnimation:dark.animationName,
    hazeAnimation:haze?.animationName||"none",
    glass:glass.backdropFilter||glass.webkitBackdropFilter,
    bodyFont:style("body").fontFamily,
    heavyAssets:resource.filter(x=>/brunette\.glb|GLTFLoader|KTX2Loader|three\.module/.test(x)),
    handSparks:document.querySelectorAll(".world-hand-sparks i").length,
    providers:document.querySelectorAll("#connection").length,
    normalHair:!resource.some(x=>x.includes("messybun"))
   };
  });
  assert.ok(state.documentWidth<=state.width+6,label+" horizontal overflow: "+JSON.stringify(state));
  assert.ok(state.chatHeight>300,label+" chat height");
  assert.equal(state.framePointer,"none");
  assert.equal(state.lightAnimation,"frameLightBreathe");
  assert.equal(state.darkAnimation,"frameShadowBreathe");
  assert.equal(state.hazeAnimation,"none","Removed smoke/haze must remain inactive");
  assert.equal(state.handSparks,0,"Obsolete hand sparks must not render");
  assert.match(state.glass,/blur\(/);
  assert.match(state.bodyFont,/DM Sans/);
  assert.equal(await page.locator(".world-embers i").count(),3,"Ambient particles remain");
  assert.deepEqual(state.heavyAssets,[],"3D assets must stay lazy until Voice Chat");
  assert.equal(await page.locator("#voicePanel").isVisible(),false,"Voice must be opt-in");
  if(label!=="desktop"){
   // Android expands its browser toolbar without changing the layout viewport.
   // This mock shrinks only the VisualViewport and must keep composer onscreen.
   const toolbar=await page.evaluate(async()=>{
    const viewport=window.visualViewport;
    if(!viewport)return {skipped:true};
    const ownHeight=Object.getOwnPropertyDescriptor(viewport,"height");
    const visible=Math.round(window.innerHeight-110);
    Object.defineProperty(viewport,"height",{configurable:true,get:()=>visible});
    viewport.dispatchEvent(new Event("resize"));
    await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
    const rect=selector=>document.querySelector(selector).getBoundingClientRect();
    const measured={visible,composerBottom:rect(".composer").bottom,modeBottom:rect("#thoughtMode").bottom,
     sendBottom:rect("#sendBtn").bottom,shellBottom:rect(".shell").bottom};
    if(ownHeight)Object.defineProperty(viewport,"height",ownHeight);
    else delete viewport.height;
    viewport.dispatchEvent(new Event("resize"));
    await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
    return measured;
   });
   assert.ok(!toolbar.skipped,label+" requires VisualViewport");
   assert.ok(toolbar.composerBottom<=toolbar.visible+3,label+" composer behind browser toolbar: "+JSON.stringify(toolbar));
   assert.ok(toolbar.modeBottom<=toolbar.visible+3,label+" mode control clipped: "+JSON.stringify(toolbar));
   assert.ok(toolbar.sendBottom<=toolbar.visible+3,label+" Send clipped: "+JSON.stringify(toolbar));
   assert.ok(toolbar.shellBottom<=toolbar.visible+3,label+" shell too tall: "+JSON.stringify(toolbar));
  }
  // Removed recorder assets must never run, while active microphone/dictation remain available.
  assert.equal(await page.locator("#voiceFallback, #voiceFallbackStart, #voiceFallbackStop").count(),0);
  assert.equal(await page.locator("#voiceDictate").count(),1);
  assert.equal(await page.locator("#sendBtn").count(),1);
   const thought=page.locator("#thoughtMode");
   assert.equal(await thought.count(),1,"Thought selector must exist beside Send");
   assert.equal(await thought.isVisible(),true,label+" thought selector is hidden");
   assert.equal(await thought.getAttribute("data-mode"),"cahaya");
   const thoughtBounds=await thought.boundingBox(),sendBounds=await page.locator("#sendBtn").boundingBox();
   assert.ok(thoughtBounds&&sendBounds&&thoughtBounds.x+thoughtBounds.width<=sendBounds.x+15,label+" thought mode not beside Send");
   await thought.click();
   assert.equal(await thought.getAttribute("data-mode"),"gelap");
   assert.equal(await thought.getAttribute("aria-pressed"),"true");
   await thought.click();
   assert.equal(await thought.getAttribute("data-mode"),"cahaya");
  assert.equal(await page.locator(".composer #sendBtn").evaluate(el=>getComputedStyle(el).minWidth)!=="0px",true);
  assert.equal(state.heavyAssets.some(x=>x.includes("bilik-antara-voice-fallback")),false);
  await page.screenshot({path:path.join(OUT,label+"-chat.png"),animations:"disabled"});

  // Inspect the new Voice glass label without initiating microphone/paid API calls.
  await page.locator("#voicePanel").evaluate(el=>{el.hidden=false;});
  const labelStyles=await page.locator(".voice-live-label").evaluate(el=>{
   const style=getComputedStyle(el),rim=getComputedStyle(el,"::after");
   return {animation:style.animationName,rimAnimation:rim.animationName};
  });
  assert.match(labelStyles.animation,/voiceIdentityBreath/);
  assert.match(labelStyles.rimAnimation,/voiceIdentityBorderLight/);
  await page.screenshot({path:path.join(OUT,label+"-voice-visual.png"),animations:"disabled"});
  await page.locator("#voicePanel").evaluate(el=>{el.hidden=true;});

  if(label==="mobile"){
   await page.locator("#input").focus();
   await page.setViewportSize({width:390,height:480});
   await page.waitForTimeout(300);
   const keyboard=await page.evaluate(()=>{
    const composer=document.querySelector(".composer").getBoundingClientRect();
    return {bottom:composer.bottom,viewport:innerHeight,width:document.documentElement.scrollWidth};
   });
   assert.ok(keyboard.bottom<=keyboard.viewport+6,"Composer hidden by keyboard: "+JSON.stringify(keyboard));
   assert.ok(keyboard.width<=396,"Horizontal overflow after keyboard resize");
   await page.screenshot({path:path.join(OUT,label+"-keyboard.png"),animations:"disabled"});
  }
  assert.deepEqual(errors,[],"Browser console or asset errors");
  results.push({device:label,pass:true,...state});
 }finally{await context.close();}
}
async function main(){
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  await audit(browser,"desktop",{viewport:{width:1440,height:900},deviceScaleFactor:1});
  await audit(browser,"mobile",{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await audit(browser,"small-mobile",{viewport:{width:320,height:720},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  console.log("Bilik Antara browser audit PASS\n"+JSON.stringify(results,null,2));
 }finally{await browser.close();}
 // Production is informational: Netlify may still be paused for build-minute limits.
 try{
  const live=await fetch("https://shaifulridhwan-penulispuisigayabebas.netlify.app/bilik-antara.html",{signal:AbortSignal.timeout(9000)});
  const text=await live.text();
  console.log("Production HTTP "+live.status+"; current CSS revision present: "+/bilik-antara\.css\?v=\d+/.test(text));
 }catch(e){console.log("Production verification unavailable: "+String(e.message||e).slice(0,140));}
}
main().catch(err=>{console.error(err);process.exitCode=1;});
