"use strict";
/* Pengesahan UI setempat tanpa panggilan AI sebenar. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[],requests=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/.netlify/functions/**",async route=>{
   const url=route.request().url();
   if(url.includes("-stream"))return route.fulfill({status:404,contentType:"application/json",body:"{}"});
   let payload={};try{payload=route.request().postDataJSON()||{};}catch(_){}
   if(payload.providerStatus)return route.fulfill({status:503,contentType:"application/json",
    body:'{"error":"Health check is unavailable"}'});
   requests.push(payload);
   return route.fulfill({status:200,contentType:"application/json",
    body:JSON.stringify({mode:"fallback",provider:"groq",model:"mock",
     reply:"Sumber laman dibaca sebagai teks sahaja.",researchStatus:"success",
     toolsUsed:["tavily_extract"],urlTrace:{status:"unverified"},
     sources:[{title:"Rujukan ujian",url:"https://example.com/public"}],
     durMs:120,usage:{totalTokenCount:40}})});
  });
  await page.goto(BASE+"/bilik-antara.html",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>!!window.AksaraObserveUI&&!!window.BilikAntaraSuite,{timeout:12000});
  const attach=page.locator("#attachmentObserveV2");
  assert.equal(await attach.count(),1,"Lampiran status uses the existing dialog");
  await page.locator("#attachmentTrigger").click();
  await page.locator("#attachmentDocument").setInputFiles({
   name:"nota-uji.txt",mimeType:"text/plain",buffer:Buffer.from("Ujian pemprosesan lampiran setempat.")});
  await page.waitForFunction(()=>document.querySelector("#attachmentObserveV2")?.dataset.phase==="sedia",{timeout:9000});
  await attach.locator("summary").click();
  assert.match(await attach.locator(".aksara-observe-body").textContent(),/Sedia dihantar · 1 fail/);
  await page.locator("#attachmentClose").click();

  // Existing Voice diagnostics, NOT a made-up check of actual audible output.
  const voice=page.locator("#voiceObserveV2");
  assert.equal(await voice.count(),1);
  const voiceText=await voice.locator(".aksara-observe-body").textContent();
  assert.match(voiceText,/Sambungan: Tidak aktif/);
  assert.match(voiceText,/Masa audio pertama ialah jadual Web Audio/);

  // Sesi & Sejarah stays clean; optional legacy memory data stays intact.
  await page.locator("#settingsPanel > summary").click();
  await page.locator("#featureSessions").click();
  await page.waitForFunction(()=>document.body.classList.contains("ba-panel-open"),{timeout:6000});
  assert.match(await page.locator(".ba-drawer").innerText(),/Sesi & Sejarah/);
  assert.doesNotMatch(await page.locator(".ba-drawer").innerText(),/Kesihatan simpanan|Memori pilihan|Buka Bilik Antara Cloudflare/);
  assert.equal(await page.evaluate(()=>window.BilikAntaraSuite.getStorageStatus().memoryEnabled),true);
  assert.equal(await page.evaluate(()=>window.BilikAntaraSuite.getStorageStatus().memorySaved),false,
   "Hiding the old memory editor must not fabricate or overwrite notes");
  await page.keyboard.press("Escape");
  await page.waitForFunction(()=>!document.body.classList.contains("ba-panel-open"),{timeout:6000});

  // Real mocked HTTP completion carries verified tool metadata to the local UI.
  await page.locator("#input").fill("Terangkan sumber halaman web untuk ujian");
  await page.locator("#sendBtn").click();
  await page.waitForFunction(()=>document.querySelector("#webObserveV2")?.dataset.state==="dibaca",{timeout:10000});
  assert.equal(requests.length,1);
  await page.locator("#settingsPanel > summary").click();
  await page.locator("#featureKnowledge").click();
  const web=page.locator("#webObserveV2");
  await web.locator("summary").click();
  assert.match(await web.locator(".aksara-observe-body").innerText(),/Teks halaman diperoleh/);
  assert.match(await web.locator(".aksara-observe-body").innerText(),/bukan bukti halaman telah dibaca sepenuhnya/);
  await page.locator("#knowledgeClose").click();

  await page.locator("#settingsPanel > summary").click();
  await page.locator("#featureMetrics").click();
  await page.waitForFunction(()=>document.body.classList.contains("ba-panel-open"));
  assert.match(await page.locator(".ba-drawer").innerText(),/Status pengukuran: Data tempatan tersedia/);
  assert.match(await page.locator(".ba-drawer").innerText(),/Peristiwa terakhir/);
  assert.match(await page.locator(".ba-drawer").innerText(),/Kesihatan simpanan/);
  assert.match(await page.locator(".ba-drawer").innerText(),/Bacaan storan/);
  await page.keyboard.press("Escape");
  assert.deepEqual(errors,[],"Browser errors "+errors.join("; "));
  console.log("AKSARA Observability v2 LULUS: lampiran, Voice, simpanan, bukti carian dan prestasi.");
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
