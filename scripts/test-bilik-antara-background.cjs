"use strict";
/* Visual audit for the static background: desktop/mobile, fallback and controls. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright");
const url=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
const out="browser-audit-artifacts";fs.mkdirSync(out,{recursive:true});
const sizes=[[1920,1080],[1366,768],[390,844],[360,800]];
async function inspect(browser,width,height,blockImage=false){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
 const page=await context.newPage(),errors=[],assets=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("response",r=>{if(r.url().includes("aksara-celestial-static.webp"))assets.push(r.status());});
 await page.route("**/.netlify/functions/**",r=>r.fulfill({status:503,json:{error:"Offline browser audit"}}));
 if(blockImage)await page.route("**/aksara-celestial-static.webp*",r=>r.abort("failed"));
 await page.goto(url+"/bilik-antara.html",{waitUntil:"networkidle"});
 await page.locator("#chat .message.ai").first().waitFor();
 const state=await page.evaluate(()=>{
  const style=x=>getComputedStyle(document.querySelector(x));
  const art=document.querySelector(".world-art"),css=style(".world-art"),glass=style(".conversation");
  return {background:css.backgroundImage,size:css.backgroundSize,
   running:art.getAnimations().filter(a=>a.playState==="running").length,
   haze:document.querySelectorAll(".world-haze,.world-embers i,.world-video").length,
   videos:document.querySelectorAll("video#aksaraAmbientVideo").length,
   width:document.documentElement.scrollWidth,viewport:innerWidth,
   glass:glass.backdropFilter||glass.webkitBackdropFilter,
   frameAnimation:style(".frame-glow--light").animationName};
 });
 assert.ok(state.width<=state.viewport+6,"No horizontal overflow at "+width);
 assert.ok(state.background.includes("aksara-celestial-static.webp"),"Shared wallpaper selected");
 assert.ok(state.background.includes("linear-gradient"),"Gradient fallback exists");
 assert.equal(state.running,0,"Wallpaper animation removed");
 assert.equal(state.haze,0,"No animated wallpaper layers");
 assert.equal(state.videos,0,"No ambient video player");
 assert.match(state.glass,/blur\(/,"Glass UI remains");
 assert.equal(state.frameAnimation,"frameLightBreathe","Existing glass frame animation remains");
 if(!blockImage){
  const dimension=await page.evaluate(async()=>{
   const i=new Image();i.src="/aksara-celestial-static.webp?v=1";await i.decode();
   return [i.naturalWidth,i.naturalHeight];
  });
  assert.deepEqual(dimension,[320,569],"The new portrait WebP must decode");
  assert.ok(assets.includes(200),"Wallpaper was fetched successfully");
 }
 await page.screenshot({path:path.join(out,"celestial-"+width+"x"+height+(blockImage?"-fallback":"")+".png"),animations:"disabled"});
 await page.locator("#input").fill("Ujian latar");
 assert.equal(await page.locator("#sendBtn").isEnabled(),true);
 await page.locator("#settingsPanel > summary").click();
 assert.equal(await page.locator("#featureSessions").isVisible(),true);
 assert.equal(await page.locator("#voicePanel").isVisible(),false);
 assert.deepEqual(errors,[],"No JavaScript console errors");
 await context.close();
}
(async()=>{const b=await chromium.launch({headless:true,args:["--no-sandbox"]});try{
 for(const [w,h]of sizes){await inspect(b,w,h,false);await inspect(b,w,h,true);
  console.log(JSON.stringify({viewport:[w,h],static:true,asset:true,fallback:true,glass:true,controls:true}));}
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
