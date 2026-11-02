"use strict";
/* Chromium: sahkan mod pilihan, mod permintaan dan keputusan tanpa API sebenar. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];let phase="gagal",sentModes=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/.netlify/functions/**",async route=>{
   const url=route.request().url();
   if(url.includes("-stream"))return route.fulfill({status:404,contentType:"application/json",body:"{}"});
   let payload={};try{payload=route.request().postDataJSON()||{};}catch(_){}
   if(payload.providerStatus)return route.fulfill({status:503,contentType:"application/json",
    body:'{"error":"Health check unavailable"}'});
   if(payload.question)sentModes.push(payload.thoughtMode);
   if(phase==="perlahan")await new Promise(resolve=>setTimeout(resolve,1400));
   return route.fulfill({status:503,contentType:"application/json",body:
    '{"code":"ALL_PROVIDERS_BUSY","error":"Test: providers unavailable","retryable":false}'});
  });
  await page.goto(BASE+"/bilik-antara.html",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>!!window.AksaraThinkingStatusUI,{timeout:10000});
  const trigger=page.locator("#thoughtMode");
  await trigger.click();
  assert.equal(await page.locator("#thoughtModeStatusSelected").innerText(),"Cahaya");
  assert.equal(await page.locator("#thoughtModeStatusCurrent").innerText(),"Tiada permintaan aktif");
  assert.match(await page.locator("#thoughtModeStatusLast").innerText(),/Belum ada/);
  assert.equal(await page.locator("#thoughtModeDialog .thought-mode-choice").count(),2);
  assert.match(await page.locator("#thoughtModeStatus").innerText(),/Tahap penaakulan model ditentukan secara adaptif/);
  await page.locator('[data-mode-option="gelap"]').click();
  assert.equal(await trigger.getAttribute("data-mode"),"gelap");
  assert.match(await trigger.getAttribute("aria-label"),/Aktif: Gelap/);
  await page.locator("#input").fill("Siapa Aku");
  await page.locator("#sendBtn").click();
  await page.waitForFunction(()=>document.querySelector("#thoughtModeStatusCurrent")?.textContent.includes("Gelap"),{timeout:6000});
  await trigger.click();
  assert.match(await page.locator("#thoughtModeStatusCurrent").innerText(),/Sedang dijawab · Gelap/);
  await page.locator('[data-mode-option="cahaya"]').click();
  assert.equal(await trigger.getAttribute("data-mode"),"cahaya");
  assert.match(await trigger.getAttribute("aria-label"),/Permintaan sedang dijawab dalam Gelap/);
  await trigger.click();
  assert.equal(await page.locator("#thoughtModeStatusSelected").innerText(),"Cahaya");
  assert.equal(await page.locator("#thoughtModeStatusCurrent").innerText(),"Sedang dijawab · Gelap");
  await page.locator("#thoughtModeClose").click();
  await page.waitForFunction(()=>document.querySelector("#thoughtModeStatusLast")?.textContent==="Selesai · Gelap",{timeout:11000});
  assert.equal(await page.locator("#thoughtModeStatusCurrent").innerText(),"Tiada permintaan aktif");
  assert.equal(await trigger.getAttribute("data-mode"),"cahaya");

  phase="perlahan";
  await page.locator("#input").fill("Semak kegagalan permintaan untuk ujian Thinking Mode");
  await page.locator("#sendBtn").click();
  await page.waitForFunction(()=>document.querySelector("#thoughtModeStatusCurrent")?.textContent.includes("Cahaya"),{timeout:6000});
  assert.equal(await trigger.getAttribute("data-permintaan"),"sedang");
  await page.locator("#stopBtn").click();
  await page.waitForFunction(()=>document.querySelector("#thoughtModeStatusLast")?.textContent==="Dihentikan · Cahaya",{timeout:8000});
  assert.equal(await trigger.getAttribute("data-permintaan"),"dihentikan");

  phase="gagal";
  await page.locator("#input").fill("Uji ralat API, bukan mod model.");
  await page.locator("#sendBtn").click();
  await page.waitForFunction(()=>document.querySelector("#thoughtModeStatusLast")?.textContent==="Gagal · Cahaya",{timeout:9000});
  assert.equal(await trigger.getAttribute("data-permintaan"),"gagal");
  assert.deepEqual(sentModes,["cahaya","cahaya"],"No unrelated backend changes and request snapshots follow selection");
  assert.deepEqual(errors,[],"Console errors: "+errors.join("; "));
  console.log("Thinking Status v2 LULUS: Gelap ke Cahaya semasa permintaan, selesai, henti, gagal, mod kekal.");
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
