"use strict";
const { chromium }=require("playwright");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const base=process.env.AKSARA_LOCAL_BASE||"http://127.0.0.1:4177";
async function run(){
 const browser=await chromium.launch({headless:true});
 try{
  const screenshots=path.resolve("browser-audit-artifacts/perpustakaan");
  fs.mkdirSync(screenshots,{recursive:true});
  for(const viewport of [{name:"mobile",width:390,height:844},{name:"desktop",width:1366,height:900}]){
   const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1, reducedMotion:"reduce"});
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   await page.goto(base+"/perpustakaan-aksara.html",{waitUntil:"domcontentloaded"});
   await page.locator(".book").first().waitFor({timeout:15000});
   assert.equal(await page.locator(".book").count(),15,"15 curated books load");
   assert.equal(await page.locator("select").count(),0,"No native select exists");
   const pos=await page.evaluate(()=>({x:document.documentElement.scrollWidth,w:document.documentElement.clientWidth,grid:getComputedStyle(document.querySelector(".books")).gridTemplateColumns,glass:getComputedStyle(document.querySelector(".book")).backdropFilter}));
   assert.ok(pos.x<=pos.w+2,viewport.name+": unwanted horizontal scrolling "+JSON.stringify(pos));
   assert.ok(pos.glass&&pos.glass!=="none",viewport.name+": glass blur must be active");
   if(viewport.name==="mobile")assert.equal(pos.grid.trim().split(/\s+/).length,1,"mobile cards must form one column");
   assert.equal(await page.locator(".toolbar,.heading,.pills").count(),0,"Marked headings and filters removed");
   assert.equal(await page.locator("#search").count(),0,"Search stays removed");
   const cover=page.locator(".book").first().locator(".art");
   const ratio=await cover.evaluate(el=>{const b=el.getBoundingClientRect();return b.width/b.height});
   assert.ok(Math.abs(ratio-9/16)<0.03,"Original novel cover uses portrait 9:16 ratio");
   await page.screenshot({path:path.join(screenshots,"karya-"+viewport.name+".png"),fullPage:viewport.name==="desktop"});
   assert.deepEqual(errors,[],viewport.name+": JavaScript exceptions");
   await page.close();
  }
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(base+"/bilik-antara.html",{waitUntil:"domcontentloaded"});
  const nav=page.locator(".topbar .nav-actions a",{hasText:"Novel"});
  assert.match(await nav.getAttribute("href"),/perpustakaan-aksara\.html/,"Novel nav destination");
  await page.goto(base+"/antara-cahaya-dan-gelap.html?baca=1",{waitUntil:"domcontentloaded"});
  await page.locator("#readerHost:not([hidden])").waitFor({timeout:15000});
  await page.frameLocator("#novelFrame").locator("#reader").waitFor({timeout:15000});
  assert.equal(await page.locator("#cover.is-reading").count(),1,"Reader opens automatically");
  await page.close();
  console.log("Perpustakaan browser audit passed for mobile/desktop, clean layout, portrait cover, glass, direct reading.");
 }finally{await browser.close()}
}
run().catch(e=>{console.error(e);process.exitCode=1});
