"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright");
const url=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
const folder=path.resolve("browser-audit-artifacts");fs.mkdirSync(folder,{recursive:true});
async function check(browser,name,viewport){
 const context=await browser.newContext({viewport,deviceScaleFactor:1});
 const page=await context.newPage();
 const errors=[],tokenRequests=[];
 page.on("pageerror",error=>errors.push(error.message));
 page.on("request",request=>{if(request.url().includes("bilik-antara-live-token"))tokenRequests.push(request.url());});
 try{
  await page.goto(url+"/bilik-antara.html?voice-rig=skeletal3d&voice-preview=1&voice-avatar-demo=1",{waitUntil:"domcontentloaded",timeout:45000});
  await page.waitForSelector("#voicePanel",{state:"attached",timeout:15000});
  await page.locator("#voiceLive").click();
  await page.waitForFunction(()=>window.AksaraVoiceSkeletal3D?.snapshot?.().ready===true,
     null,{timeout:45000});
  const before=await page.evaluate(()=>window.AksaraVoiceSkeletal3D.snapshot());
  await page.waitForTimeout(1200);
  const after=await page.evaluate(()=>({
    rig:window.AksaraVoiceSkeletal3D.snapshot(),
    canvas:document.querySelectorAll("#voiceAvatarStage canvas.voice-avatar-canvas").length,
    mode:document.getElementById("voiceAvatarStage")?.dataset?.skeletal3d,
    status:document.getElementById("voiceStatus")?.textContent
  }));
  assert.equal(before.ready,true);
  assert.ok(before.mappedBoneCount>=3,name+" needs head + neck + torso, got "+JSON.stringify(before));
  assert.ok(after.rig.frames>before.frames,name+" must animate real bones over time");
  assert.equal(after.canvas,1,"3D canvas missing");
  assert.equal(after.mode,"ready","real humanoid rig must be found");
  assert.match(after.status,/Demo skeletal 3D/);
  assert.equal(tokenRequests.length,0,"no live Gemini token during 3D demo");
  assert.deepEqual(errors,[],"uncaught browser errors");
  await page.screenshot({path:path.join(folder,"aksara-skeletal3d-v07-"+name+".png")});
  console.log(name+" SKELETAL3D PASS",JSON.stringify(after.rig));
 }finally{await context.close();}
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--enable-webgl","--use-gl=angle","--use-angle=swiftshader"]});
 try{
  await check(browser,"desktop",{width:1365,height:800});
  await check(browser,"mobile",{width:390,height:844});
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
