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
 await page.locator("#themeBtn").click();
 assert.equal(await page.locator("html").getAttribute("data-theme"),"light");
 if(device==="mobile"){
  await page.locator("#hamburger").click();
  assert.equal(await page.locator("#hamburger").getAttribute("aria-expanded"),"true");
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
 await page.locator("#voiceDictate").waitFor();
 await page.locator("#chat .message").first().waitFor({timeout:10000});
 assert.equal(await page.locator("#voicePanel").isVisible(),false);
 await verifyLocalLinks(page);
 await snapshot(page,device+"-chat");
 await page.locator("#input").fill("Uji pengalaman menaip di Bilik Antara.");
 assert.equal(await page.locator("#sendBtn").isEnabled(),true);
 await page.locator("#themeToggle").click();
 assert.equal(await page.locator("html").getAttribute("data-theme"),"light");
 if(device==="mobile"){
  await page.locator("#input").focus();
  await snapshot(page,device+"-chat-focused");
 }
 log(device+" chat composer, opt-in voice and theme passed; no paid API calls made");
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
   await home(page,dev.label);
   await chat(page,dev.label);
   await context.close();
  }
  assert.deepEqual(errors,[],"Browser JavaScript errors found");
  await remoteProbe(browser);
  log("PASS: browser interaction, keyboard, internal links, viewport checks");
 }finally{await browser.close();}
}
main().catch(e=>{console.error("[browser-audit] FAIL "+(e.stack||e));process.exitCode=1;});
