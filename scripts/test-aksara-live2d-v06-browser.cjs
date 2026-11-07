"use strict";
/* PR #263: do not ship a cohesive rig until a real WebGL draw is observed.
 * This runs against staged exported .moc3 and uses no Gemini Live token. */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright");
const BASE=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
const output=path.resolve("browser-audit-artifacts");
fs.mkdirSync(output,{recursive:true});
async function audit(browser,name,viewport){
 const context=await browser.newContext({viewport,deviceScaleFactor:1});
 const page=await context.newPage();
 const pageErrors=[],tokens=[];
 page.on("pageerror",err=>pageErrors.push(String(err.message)));
 page.on("request",request=>{if(request.url().includes("bilik-antara-live-token"))tokens.push(request.url());});
 try{
  await page.goto(BASE+"/bilik-antara.html?voice-avatar=live2d&voice-rig=cohesive&voice-preview=1&voice-avatar-demo=1&voice-quality=ultra",{waitUntil:"domcontentloaded",timeout:30000});
  await page.locator("#voiceLive").click();
  await page.waitForFunction(()=>window.AksaraLive2DExperiment?.snapshot?.().ready===true||window.AksaraLive2DExperiment?.snapshot?.().failed===true,null,{timeout:35000});
  let status=await page.evaluate(()=>{
   const state=window.AksaraLive2DExperiment.snapshot();
   return {state,canvas:document.querySelectorAll("#voiceAvatarStage canvas.aksara-live2d-webgl").length,
    fallback:document.querySelectorAll("#voiceAvatarStage .voice-x-avatar-fallback").length};
  });
  assert.equal(status.state.ready,true,name+" failed to load actual Cubism model: "+JSON.stringify(status));
  assert.equal(status.state.rig,"cohesive-v06");
  assert.equal(status.canvas,1);
  assert.equal(status.fallback,0);
  assert.equal(status.state.targetFPS,60);
  assert.ok(status.state.resolution>=2);
  assert.equal(status.state.accessories.active,false,"no detached duplicate ornaments");
  const manifest=await page.request.get(BASE+"/assets/live2d/aksara-v06/aksara.model3.json");
  assert.equal(manifest.status(),200);
  const references=(await manifest.json()).FileReferences;
  assert.match(references.Moc,/\.moc3$/);
  assert.ok(references.Textures.some(t=>t.includes(".4096/")));
  // Wait for the animation to render several live frames before taking stills.
  await page.waitForTimeout(1200);
  await page.screenshot({path:path.join(output,"aksara-v06-"+name+"-neutral.png")});
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("ba:voice-avatar-text",{detail:{text:"Tahniah, seronok!"}})));
  await page.waitForFunction(()=>window.AksaraLive2DExperiment.snapshot().motion.emotion>.11,null,{timeout:5000});
  await page.evaluate(()=>document.querySelector("#voicePanel").classList.add("voice-speaking"));
  await page.waitForFunction(()=>window.AksaraLive2DExperiment.snapshot().motion.mouth>.05,null,{timeout:5000});
  await page.screenshot({path:path.join(output,"aksara-v06-"+name+"-speaking.png")});
  assert.deepEqual(pageErrors,[]);
  assert.equal(tokens.length,0);
  const latest=await page.evaluate(()=>window.AksaraLive2DExperiment.snapshot());
  console.log("AKSARA V06 COHESIVE "+name+" PASS",JSON.stringify({model:latest.rig,frame:latest.lastFrame,fpsTarget:latest.targetFPS,mouth:latest.motion.mouth}));
 }finally{await context.close();}
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  await audit(browser,"desktop",{width:1365,height:800});
  await audit(browser,"mobile",{width:390,height:844});
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});