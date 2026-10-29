"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const BASE=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
const REMOTE="https://shaifulridhwan-penulispuisigayabebas.netlify.app";
const errors=[];
function log(x){console.log("[browser-audit] "+x);}
function isNovel(p){return /antara-cahaya-dan-gelap|assets\/novel/i.test(p);}
async function snapshot(page,label){
 const size=await page.evaluate(()=>({width:window.innerWidth,contentWidth:document.documentElement.scrollWidth,height:window.innerHeight,contentHeight:document.documentElement.scrollHeight}));
 await page.screenshot({path:"audit-"+label+".png",fullPage:true,animations:"disabled",timeout:20000}).catch(e=>log("Screenshot unavailable: "+e.message.slice(0,100)));
 log(label+" viewport="+JSON.stringify(size));
 assert.ok(size.contentWidth<=size.width+6,label+" has horizontal overflow: "+JSON.stringify(size));
}
async function verifyLocalLinks(page){
 const links=await page.locator("a[href]").evaluateAll(nodes=>nodes.map(a=>a.getAttribute("href")));
 const missing=[];
 for(const href of links){
  if(!href||href.startsWith("#")||/^(?:https?:|mailto:|tel:)/i.test(href)||isNovel(href))continue;
  if(href.startsWith("/.netlify/"))continue;
  const local=decodeURIComponent(href.split("#")[0].split("?")[0]);
  const full=path.resolve(process.cwd(),local.replace(/^\//,""));
  if(!full.startsWith(process.cwd()+path.sep)||!fs.existsSync(full))missing.push(href);
 }
 assert.deepEqual(missing,[],"Broken internal links");
 log("Internal link checks passed: "+links.length+" links reviewed (novel excluded)");
}
async function home(page,device){
 await page.goto(BASE+"/",{waitUntil:"domcontentloaded",timeout:30000});
 await page.locator(".work").first().waitFor({timeout:15000});
 assert.equal(await page.locator(".work").count(),6,"Six editorial selections must appear");
 await verifyLocalLinks(page);
 await page.waitForFunction(()=>{
  const font=document.querySelector('link[href*="family=Syne"]');
  return font?.media==="all"&&!!font.sheet;
 },null,{timeout:12000});
 const homeStyles=await page.evaluate(()=>({
  heading:getComputedStyle(document.querySelector(".hero-title")).fontFamily,
  body:getComputedStyle(document.body).fontFamily,
  fonts:document.querySelectorAll('link[rel="preconnect"][href="https://fonts.googleapis.com"]').length
 }));
 assert.match(homeStyles.heading,/Syne/,"Original Syne hero typeface must remain");
 assert.match(homeStyles.body,/Archivo/,"Original Archivo body typeface must remain");
 assert.equal(homeStyles.fonts,1,"Google Fonts preconnect must not be duplicated");
 await snapshot(page,device+"-home-initial");
 await page.locator('[data-cat="all"]').click();
 assert.equal(await page.locator(".work").count(),33,"All poems accessible");
 await page.locator('[data-cat="media"]').click();
 assert.equal(await page.locator(".work").count(),24);
 await page.locator('[data-series="duologi"]').click();
 assert.equal(await page.locator(".work").count(),2);
 await page.locator('[data-series="trilogi"]').click();
 assert.equal(await page.locator(".work").count(),3);
 await page.locator('[data-series="tetralogi"]').click();
 assert.equal(await page.locator(".work").count(),4);
 await page.locator("#searchInput").fill("WANITA YANG DIAM");
 assert.equal(await page.locator(".work").count(),1);
 const head=page.locator(".work-head").first();
 await head.focus();
 await page.keyboard.press("Enter");
 assert.equal(await head.getAttribute("aria-expanded"),"true");
 await page.locator('#archiveDirectory summary').click();
 assert.equal(await page.locator('#archiveDirectory a[data-archive-title]').count(),33);
 await page.locator('#archiveDirectory a[data-archive-title]').first().click();
 assert.equal(await page.locator(".work").count(),1,"Directory click must filter single poem");
 await page.locator("#resetBtn").click();
 assert.equal(await page.locator(".work").count(),6,"Reset must return to editorial curation");
 if(device==="mobile"){
  // Theme button belongs to the collapsed mobile navigation. Open it first.
  await page.locator("#hamburger").click();
  assert.equal(await page.locator("#hamburger").getAttribute("aria-expanded"),"true");
 }
 await page.locator("#themeBtn").click();
 assert.equal(await page.locator("html").getAttribute("data-theme"),"light");
 if(device==="mobile"){
  await page.locator('.nav-links a[href="#karya"]').click();
  assert.equal(await page.locator("#hamburger").getAttribute("aria-expanded"),"false");
 }
 await snapshot(page,device+"-home-after");
 log(device+" archive navigation, search, keyboard, theme and menu passed");
}
async function chat(page,device){
 await page.goto(BASE+"/bilik-antara.html",{waitUntil:"domcontentloaded",timeout:30000});
 await page.locator("#input").waitFor();
 await page.locator("#voiceLive").waitFor();
 await page.locator("#voiceDictate").waitFor({state:"attached"});
 assert.equal(await page.locator("#voiceDictate").isVisible(),false,"Dictation stays in the collapsed privacy settings");
 await page.locator("#chat .message").first().waitFor({timeout:10000});
 assert.equal(await page.locator("#voicePanel").isVisible(),false);
 await verifyLocalLinks(page);
 // Async CSS must become fully effective, and every original effect must remain.
 await page.waitForFunction(()=>{
  const sheet=document.querySelector('link[href="bilik-antara-suite.css?v=6"]');
  return sheet?.media==="all"&&!!sheet.sheet;
 },null,{timeout:10000});
 const surface=await page.evaluate(()=>{
  const css=selector=>getComputedStyle(document.querySelector(selector));
  const glass=css(".conversation"),haze=css(".world-haze"),star=css(".world-embers i");
  const sparks=css(".world-hand-sparks i"),body=css("body");
  const rect=document.querySelector(".conversation").getBoundingClientRect();
  const app=document.querySelector(".app-shell").getBoundingClientRect();
  return {glass:glass.backdropFilter||glass.webkitBackdropFilter,
   haze:haze.animationName,stars:star.animationName,sparks:sparks.animationName,
   chatTop:rect.top,chatHeight:rect.height,appTop:app.top,
   redundantHero:!!document.querySelector(".identity,.eyebrow,.chapter-ornament"),
   bodyFont:body.fontFamily,
   suite:!!document.querySelector('link[href="bilik-antara-suite.css?v=6"]')?.sheet};
 });
 assert.match(surface.glass,/blur\(/,"Liquid Glass must retain its original blur");
 assert.match(surface.haze,/hazeDrift/,"Black fog animation must stay");
 assert.match(surface.stars,/embersTravel/,"Star particles must keep moving");
 assert.match(surface.sparks,/handSparkDescent/,"Hand sparks must keep falling");
 assert.equal(surface.redundantHero,false,"Large title introduction and its animations must be removed");
 assert.ok(surface.chatTop-surface.appTop<30,"Chat starts at the top of the main area");
 assert.ok(surface.chatHeight>300,"Chat fills the hero's former vertical space");
 assert.match(surface.bodyFont,/DM Sans/,"Chat typography must be unchanged");
 assert.equal(surface.suite,true,"Extra panel styles must load");
 await snapshot(page,device+"-chat");
 // Normal text chat must retain its real face without loading the 2.7 MB GLB,
 // 3D engine or texture decoders before Voice Chat is opened.
 const portrait=await page.locator(".message.ai").first().evaluate(node=>getComputedStyle(node,"::before").backgroundImage);
 assert.match(portrait,/bilik-antara-chat-portrait\.png/,"The genuine avatar still must display in text chat");
 const heavy=await page.evaluate(()=>performance.getEntriesByType("resource")
  .map(entry=>entry.name).filter(url=>/three\.(?:module|core)\.js|brunette\.glb|GLTFLoader\.js|KTX2Loader\.js/.test(url)));
 assert.deepEqual(heavy,[],"No 3D network dependency should load in ordinary text chat");
 await page.locator("#input").fill("Uji pengalaman menaip di Bilik Antara.");
 assert.equal(await page.locator("#sendBtn").isEnabled(),true);
 assert.equal(await page.locator("html").getAttribute("data-theme"),"dark","Chat retains its light-and-dark identity");
 await page.locator("#settingsPanel > summary").click();
 await page.locator("#privacySettings > summary").click();
 assert.equal(await page.locator("#voiceDictate").isVisible(),true,"Dictate is available within privacy settings");
 await page.locator("#settingsPanel > summary").click();
 if(device==="mobile"){
  const history=Array.from({length:24},(_,i)=>({role:i%2?"assistant":"user",content:"Ujian sejarah perbualan "+i+". "+"Teks yang cukup panjang untuk menguji tatal. ".repeat(3)}));
  await page.evaluate(history=>window.BilikAntaraBridge.load({history}),history);
  await page.waitForTimeout(100);
  await page.locator("#input").focus();
  // Android's resizes-content mode makes both the layout and visual viewport
  // smaller when the keyboard opens. Emulate that change without a real IME.
  await page.setViewportSize({width:390,height:480});
  await page.waitForTimeout(150);
  const keyboard=await page.evaluate(()=>{
   const chat=document.querySelector('#chat'),composer=document.querySelector('.composer').getBoundingClientRect();
   return {bottomGap:chat.scrollHeight-chat.scrollTop-chat.clientHeight,composerBottom:composer.bottom,
    viewport:window.innerHeight,rootOverflow:document.documentElement.scrollHeight-document.documentElement.clientHeight};
  });
  assert.ok(keyboard.composerBottom<=keyboard.viewport,"Composer remains visible above keyboard");
  assert.ok(keyboard.bottomGap<8,"Latest message remains visible when the keyboard opens");
  assert.ok(keyboard.rootOverflow<=1,"Keyboard must not add a scrollable blank page");
  await page.locator('#chat').evaluate(el=>{el.scrollTop=0;});
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#chat').evaluate(el=>el.scrollTop),0,"Resizing must not pull a user away from older messages");
  await page.locator("#input").focus();
  await snapshot(page,device+"-chat-focused");
 }
 log(device+" chat composer, opt-in voice and privacy settings passed; no paid API calls made");
}
async function novel(page,device){
 await page.goto(BASE+"/antara-cahaya-dan-gelap.html",{waitUntil:"domcontentloaded",timeout:30000});
 await page.locator("#cover .cv-art").waitFor({state:"visible"});
 const initial=await page.evaluate(()=>{
  const style=selector=>getComputedStyle(document.querySelector(selector));
  const art=style("#cover .cv-art"),glow=style("#cover .cv-shine"),fog=style("#cover .cv-smoke"),title=style("#cover h1");
  return {art:art.backgroundImage,glow:glow.animationName,fog:fog.animationName,font:title.fontFamily};
 });
 assert.match(initial.art,/cover-01\.jpg/,"Original novel cover art must remain");
 assert.match(initial.glow,/cvShine/,"Novel light must keep glowing");
 assert.match(initial.fog,/cvDrift/,"Novel shadow fog must keep moving");
 assert.match(initial.font,/Georgia/,"Novel cover typography must stay the same");
 await snapshot(page,device+"-novel-cover");
 await page.locator("#startReading").click();
 assert.equal(await page.locator("#readerHost").isVisible(),true,"Reader host must open");
 const reader=page.frameLocator("#novelFrame");
 await reader.locator("#backToCover").waitFor({state:"attached",timeout:30000});
 assert.equal(await reader.locator("#fontUp").count(),1,"Reader must preserve adjustable font size");
 assert.equal(await reader.locator('link[href*="family=Fraunces"]').count(),1,"Paginated reader must retain its original blocking font CSS");
 assert.equal(await reader.locator("#nextBtn").count(),1,"Reader must preserve page-turn navigation");
 await snapshot(page,device+"-novel-open");
 await reader.locator("#tocBtn").click();
 await reader.locator("#backToCover").click();
 assert.equal(await page.locator("#readerHost").isVisible(),false,"Back-to-cover must work");
 log(device+" novel artwork, animations, reader loading and navigation passed");
}
async function remoteProbe(browser){
 try{
  const res=await fetch(REMOTE+"/",{signal:AbortSignal.timeout(12000)});
  log("PRODUCTION homepage HTTP "+res.status);
  if(!res.ok)return;
  const html=await res.text();
  log("PRODUCTION editorial build marker="+html.includes('Pilihan Editorial')+"; external CSS="+html.includes('gaya-bebas.css?v=1'));
  const r=await fetch(REMOTE+"/bilik-antara.html",{signal:AbortSignal.timeout(12000)});
  log("PRODUCTION Bilik Antara HTTP "+r.status);
  if(!r.ok)return;
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:2});
  const page=await ctx.newPage();
  await page.goto(REMOTE+"/",{waitUntil:"domcontentloaded",timeout:25000});
  log("PRODUCTION rendered poems="+await page.locator(".work").count());
  await page.goto(REMOTE+"/bilik-antara.html",{waitUntil:"domcontentloaded",timeout:25000});
  log("PRODUCTION chat controls="+await page.locator("#voiceLive").count());
  await ctx.close();
 }catch(e){log("PRODUCTION unreachable from CI: "+String(e.message||e).slice(0,140));}
}
async function main(){
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const dev of [
   {label:"desktop",options:{viewport:{width:1440,height:900},deviceScaleFactor:1}},
   {label:"mobile",options:{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}}
  ]){
   const context=await browser.newContext(dev.options);
   const page=await context.newPage();
   page.on("pageerror",e=>{errors.push(dev.label+": "+e.message);log("JS ERROR "+e.message);});
   page.on("response",response=>{
     if(response.status()>=400&&response.url().startsWith(BASE)){
       // Static Python server cannot serve Netlify function POSTs; record only missing assets.
       const url=response.url();
       if(!url.includes("/.netlify/functions/")){
         errors.push(dev.label+": HTTP "+response.status()+" "+url);
         log("RESOURCE ERROR "+response.status()+" "+url);
       }
     }
   });
   await home(page,dev.label);
   await chat(page,dev.label);
   await novel(page,dev.label);
   await context.close();
  }
  assert.deepEqual(errors,[],"Browser JavaScript errors found");
  await remoteProbe(browser);
  log("PASS: browser interaction, keyboard, internal links, viewport checks");
 }finally{await browser.close();}
}
main().catch(e=>{console.error("[browser-audit] FAIL "+(e.stack||e));process.exitCode=1;});
