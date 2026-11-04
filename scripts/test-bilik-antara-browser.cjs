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
  assert.equal(await page.locator(".world-embers i").count(),0,"Static background must not render moving particles");
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
  const dialog=page.locator("#thoughtModeDialog");
  assert.equal(await thought.count(),1,"Mode trigger must exist beside Send");
  assert.equal(await thought.isVisible(),true,label+" Mode trigger is hidden");
  assert.equal(await thought.getAttribute("data-mode"),"cahaya");
  assert.equal(await dialog.isVisible(),false,"Mode dialog must start closed");
  const thoughtBounds=await thought.boundingBox(),sendBounds=await page.locator("#sendBtn").boundingBox();
  assert.ok(thoughtBounds&&sendBounds&&thoughtBounds.x+thoughtBounds.width<=sendBounds.x+15,label+" Mode trigger not beside Send");
  await thought.click();
  assert.equal(await dialog.isVisible(),true,"Mode dialog must open");
  assert.equal(await thought.getAttribute("aria-expanded"),"true");
  const options=dialog.locator("[data-mode-option]");
  assert.equal(await options.count(),2);
  assert.equal(await options.first().getAttribute("aria-pressed"),"true");
  assert.equal(await dialog.locator(".thought-choice-copy small").count(),2);
  const sizes=await dialog.locator(".thought-mode-choice").first().evaluate(el=>{
   const title=el.querySelector("strong"),description=el.querySelector("small");
   return {title:parseFloat(getComputedStyle(title).fontSize),description:parseFloat(getComputedStyle(description).fontSize)};
  });
  assert.ok(sizes.description<sizes.title,"Mode explanation must be smaller than title");
  await options.nth(1).click();
  assert.equal(await dialog.isVisible(),false,"Selecting Gelap must close dialog");
  assert.equal(await thought.getAttribute("data-mode"),"gelap");
  const darkOutput=await page.evaluate(()=>({
   current:window.BilikAntaraThought.getMode(),
   text:window.BilikAntaraChatStyle.reply("Satu hujah. 🙂✨",{mode:window.BilikAntaraThought.getMode()})
  }));
  assert.deepEqual(darkOutput,{current:"gelap",text:"Satu hujah."},"GELAP output must never append CAHAYA emojis");
  await thought.click();
  assert.equal(await options.nth(1).getAttribute("aria-pressed"),"true");
  await page.keyboard.press("Escape");
  assert.equal(await dialog.isVisible(),false,"Escape must close Mode dialog");
  assert.equal(await thought.getAttribute("data-mode"),"gelap","Escape must preserve mode");
  await thought.click();
  await options.first().click();
  assert.equal(await thought.getAttribute("data-mode"),"cahaya");
  const lightOutput=await page.evaluate(()=>window.BilikAntaraChatStyle.reply("Aku Aksara.",{mode:window.BilikAntaraThought.getMode()}));
  assert.equal((lightOutput.match(/[🙂✨]/gu)||[]).length,2,"CAHAYA retains the original two emojis");
  if(label!=="desktop"){
   const composer=await page.locator(".composer").boundingBox();
   const viewport=page.viewportSize();
   assert.ok(composer&&viewport&&composer.y+composer.height<=viewport.height+6,label+" composer clipped after Mode dialog");
  }

  // Regression: opening Ciri & Fungsi must blur the entire chat surface,
  // especially the left strip previously left sharp beside the menu.
  await page.locator("#settingsPanel > summary").click();
  await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector(".feature-focus-veil")).opacity)>.95,{timeout:3000});
  const featureGlass=await page.evaluate(()=>{
   const root=document.querySelector(".conversation").getBoundingClientRect();
   const veil=document.querySelector(".feature-focus-veil");
   const sceneFilter=getComputedStyle(document.querySelector(".world-scene")).filter;
   const chatBackdrop=getComputedStyle(document.querySelector(".conversation")).backdropFilter;
   const bounds=veil.getBoundingClientRect(),style=getComputedStyle(veil);
   return {open:document.querySelector("#settingsPanel").open,
    visible:style.visibility,opacity:Number(style.opacity),
    sceneFilter,chatBackdrop,
    blur:style.backdropFilter||style.webkitBackdropFilter,
    chat:{left:root.left,top:root.top,right:root.right,bottom:root.bottom},
    veil:{left:bounds.left,top:bounds.top,right:bounds.right,bottom:bounds.bottom}};
  });
  assert.equal(featureGlass.open,true,label+" feature dialog must open");
  assert.equal(featureGlass.visible,"visible",label+" entire-glass veil must be visible");
  assert.ok(featureGlass.opacity>.9,label+" feature veil must be opaque enough to blur");
  assert.match(featureGlass.blur,/blur\(8px\)/,label+" feature veil needs uniform backdrop blur");
  assert.match(featureGlass.sceneFilter,/blur\(10px\)/,
    label+" background scene itself must blur, not just interior chat elements");
  assert.match(featureGlass.chatBackdrop,/blur\(14px\)/,
    label+" underlying artwork must blur through the chat backdrop root");
  assert.ok(Math.abs(featureGlass.veil.left-featureGlass.chat.left)<=1 &&
    Math.abs(featureGlass.veil.right-featureGlass.chat.right)<=1 &&
    Math.abs(featureGlass.veil.top-featureGlass.chat.top)<=1 &&
    Math.abs(featureGlass.veil.bottom-featureGlass.chat.bottom)<=1,
    label+" feature veil does not cover the full chat border: "+JSON.stringify(featureGlass));
  await page.screenshot({path:path.join(OUT,label+"-feature-glass.png"),animations:"disabled"});
  await page.keyboard.press("Escape");
  await page.waitForFunction(()=>!document.querySelector("#settingsPanel").open,{timeout:3000});
  await page.waitForFunction(()=>getComputedStyle(document.querySelector(".feature-focus-veil")).visibility==="hidden",{timeout:3000});
  assert.equal(await page.locator(".feature-focus-veil").evaluate(el=>getComputedStyle(el).visibility),"hidden",
   "Feature veil must close without blocking normal chat controls");
  const recoveredGlass=await page.evaluate(()=>({
   scene:getComputedStyle(document.querySelector(".world-scene")).filter,
   chat:getComputedStyle(document.querySelector(".conversation")).backdropFilter
  }));
  assert.doesNotMatch(recoveredGlass.scene,/blur\(10px\)/,
    label+" closing Ciri & Fungsi must restore the original background");
  assert.doesNotMatch(recoveredGlass.chat,/blur\(14px\)/,
    label+" closing Ciri & Fungsi must restore normal glass performance");

  const attachmentTrigger=page.locator("#attachmentTrigger"),attachmentDialog=page.locator("#attachmentDialog");
  await attachmentTrigger.click();
  assert.equal(await attachmentDialog.isVisible(),true,"Glass attachment dialog opens");
  assert.equal(await attachmentDialog.locator("[data-attachment-type]").count(),5);
  const chooserPromise=page.waitForEvent("filechooser");
  await attachmentDialog.locator('[data-attachment-type="document"]').click();
  const chooser=await chooserPromise;
  await chooser.setFiles({name:"browser-check.txt",mimeType:"text/plain",buffer:Buffer.from("aksara attachment test")});
  await page.locator('.attachment-chip-remove[aria-label="Buang browser-check.txt"]').waitFor({state:"visible"});
  assert.match(await page.locator("#docStatus").innerText(),/browser-check.txt/);
  assert.equal(await page.locator("#removeAttachment").isVisible(),false,"One file has its own remove button");
  await page.locator('.attachment-chip-remove[aria-label="Buang browser-check.txt"]').click();
  await attachmentTrigger.click();
  await page.keyboard.press("Escape");
  assert.equal(await attachmentDialog.isVisible(),false);
  const locationDialog=page.locator("#metaLocationDialog");
  await page.evaluate(()=>document.getElementById("metaLocationDialog").showModal());
  await locationDialog.locator("#messageLocationInput").fill("Shah Alam, Selangor");
  await locationDialog.locator("#metaLocationSave").click();
  assert.equal(await locationDialog.isVisible(),false);
  await page.evaluate(()=>window.BilikAntaraBridge.load({history:[
    {role:"user",content:"uji lokasi dan waktu",timestamp:Date.now()-60000,locationLabel:"Shah Alam, Selangor"},
    {role:"assistant",content:"uji masa diterima",timestamp:Date.now(),locationLabel:"Shah Alam, Selangor",thoughtMode:"cahaya"}
  ]}));
  assert.equal(await page.locator(".message-meta").count(),2);
  assert.equal(await page.locator(".message-place").count(),0,"Chatbox metadata shows time only, never the optional location label");
  assert.match(await page.locator(".message-clock").first().innerText(),/Dihantar/);
  assert.match(await page.locator(".message-clock").last().innerText(),/Diterima/);
  await page.evaluate(()=>window.BilikAntaraBridge.fresh());
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
  // Prevent the 320px regression: the original header clipped AKSARA, while
  // the oversized dialect card and duplicate status obscured the 3D stage.
  await page.locator("#voiceStyleTrigger").waitFor({state:"visible",timeout:5000});
  const voiceLayout=await page.evaluate(()=>{
   const rect=selector=>{
    const node=document.querySelector(selector),r=node.getBoundingClientRect();
    return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};
   };
   return {
    name:rect(".voice-panel .voice-live-label"),
    actions:rect(".voice-panel .voice-panel-head-actions"),
    row:rect(".voice-panel .voice-style-row"),
    trigger:rect("#voiceStyleTrigger"),
    mode:rect("#voiceModeBadge"),
    hint:rect("#voiceDialectHint"),
    viewportWidth:document.documentElement.clientWidth,
    contentWidth:document.documentElement.scrollWidth
   };
  });
  assert.ok(voiceLayout.name.right<=voiceLayout.actions.x+3,
   label+" Voice header overlaps: "+JSON.stringify(voiceLayout));
  assert.ok(voiceLayout.row.height<=54,
   label+" loghat toolbar must be one compact row: "+JSON.stringify(voiceLayout));
  assert.ok(Math.abs(voiceLayout.trigger.y-voiceLayout.mode.y)<5,
   label+" loghat and mode controls must share one row: "+JSON.stringify(voiceLayout));
  assert.ok(voiceLayout.hint.width<=2,
   label+" explanatory Aoede line should be screen-reader-only");
  assert.ok(voiceLayout.contentWidth<=voiceLayout.viewportWidth+3,
   label+" Voice UI caused horizontal overflow");
  await page.locator("#voiceStyleTrigger").click();
  const dialectDialog=page.locator("#voiceStyleDialog");
  await dialectDialog.waitFor({state:"visible",timeout:3000});
  assert.equal(await dialectDialog.locator(".voice-style-option").count(),8);
  const dialLayout=await page.evaluate(()=>{
   const d=document.querySelector("#voiceStyleDialog").getBoundingClientRect();
   const xs=[...document.querySelectorAll("#voiceStyleDialog .voice-style-option")].map(el=>el.getBoundingClientRect().x);
   return {left:d.left,right:d.right,viewport:document.documentElement.clientWidth,oneColumn:xs.every(x=>Math.abs(x-xs[0])<2)};
  });
  assert.ok(dialLayout.left>=-1&&dialLayout.right<=dialLayout.viewport+1,
   label+" dialect dialog overflows screen: "+JSON.stringify(dialLayout));
  assert.equal(dialLayout.oneColumn,true,label+" dialect choices must not be crammed into two columns");
  await page.screenshot({path:path.join(OUT,label+"-voice-loghat-menu.png"),animations:"disabled"});
  await page.keyboard.press("Escape");
  await dialectDialog.waitFor({state:"hidden",timeout:3000});
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
  if(label==="desktop"){
   // Typed identity questions remain clean. The contextual suggestion belongs
   // ONLY to a real starter click, and navigates nowhere by itself.
   await page.evaluate(()=>window.BilikAntaraBridge.fresh());
   await page.locator("#input").fill("Siapa Aku");
   await page.locator("#composer").evaluate(form=>form.requestSubmit());
   await page.waitForFunction(()=>[...document.querySelectorAll(".message.ai .bubble")].some(el=>el.textContent.includes("AI routing")),{timeout:12000});
   assert.equal(await page.locator(".msg-followup-btn").count(),0,"No suggestion for manually typed prompts");
   await page.evaluate(()=>window.BilikAntaraBridge.fresh());
   await page.locator("#starters .starter").first().click();
   const suggestion=page.locator(".msg-followup-btn");
   await suggestion.waitFor({state:"visible",timeout:12000});
   assert.match(await suggestion.innerText(),/Nak tahu tentang "The Coder Poet" pulak ke/);
   await suggestion.click();
   await page.waitForFunction(()=>[...document.querySelectorAll(".message.ai .bubble")].some(el=>el.textContent.includes("Twister Kernel")),{timeout:12000});
   assert.equal(await page.locator(".msg-followup-btn").count(),1,"Do not chain suggestions after The Coder Poet");
   await page.screenshot({path:path.join(OUT,"desktop-coder-poet-followup.png"),animations:"disabled"});
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
