"use strict";
/* AKSARA Pusat Rujukan · mock browser audit (no paid provider or external request). */
const assert=require("node:assert/strict"),{chromium}=require("playwright");
const BASE=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();const errors=[],questions=[];let indexLoads=0;
  page.on("pageerror",err=>errors.push(err.message));
  page.on("request",r=>{if(new URL(r.url()).pathname==="/karya-index.json")indexLoads++;});
  await page.route("**/.netlify/functions/**",async route=>{
   const url=route.request().url();let payload={};
   try{payload=route.request().postDataJSON()||{};}catch(_){}
   if(payload.providerStatus)return route.fulfill({status:503,contentType:"application/json",
    body:'{"error":"Health check unavailable in CI"}'});
   if(url.includes("-stream"))return route.fulfill({status:404,contentType:"application/json",body:"{}"});
   if(payload.question)questions.push(payload.question);
   return route.fulfill({status:200,contentType:"application/json",
    body:JSON.stringify({mode:"live",model:"mock-encyclopedia",provider:"gemini",
     reply:"Ringkasan falsafah yang diperoleh daripada rujukan ujian.",researchStatus:"encyclopedia",
     sources:[{title:"Falsafah · Wikipedia",url:"https://ms.wikipedia.org/wiki/Falsafah"}],
     toolsUsed:[],durMs:140,usage:{totalTokenCount:60}})});
  });
  await page.goto(BASE+"/bilik-antara.html",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>!!window.AksaraReferenceHubUI&&!!window.AksaraObserveUI,{timeout:12000});
  assert.equal(indexLoads,0,"Public poetry index must not be downloaded on initial paint");
  await page.locator("#settingsPanel > summary").click();
  await page.locator("#featureKnowledge").click();
  assert.equal(await page.locator("#knowledgeDialog").evaluate(d=>d.open),true);
  assert.equal(await page.locator("#knowledgeTitle").innerText(),"Pusat Rujukan");
  assert.equal(await page.locator('[role="tab"][aria-selected="true"]').innerText(),"Karya");
  await page.waitForFunction(()=>window.AksaraReferenceHubUI.snapshot().loaded,{timeout:7500});
  assert.equal(indexLoads,1,"Opening Reference Hub fetches existing public index once");
  assert.equal(questions.length,0,"Browsing local works must not contact an AI");
  await page.locator("#referenceWorkQuery").fill("aporia");
  await page.waitForFunction(()=>document.querySelector("#referenceWorkResults")?.textContent.includes("ANTARA TAHU DAN APORIA"));
  const card=page.locator("#referenceWorkResults .reference-work").first();
  assert.match(await card.locator("strong").innerText(),/ANTARA TAHU DAN APORIA/);
  const direct=await card.locator("a").getAttribute("href");
  assert.match(direct,/index\.html\?cari=.*#karya/);
  const archive=await context.newPage();
  await archive.goto(new URL(direct,BASE+"/").href,{waitUntil:"domcontentloaded"});
  await archive.waitForFunction(()=>document.querySelector("#searchInput")?.value.includes("ANTARA TAHU DAN APORIA")&&
   document.querySelectorAll("#works .work").length===1,{timeout:10000});
  assert.equal(await archive.locator("#works .work.open").count(),1,"Original poem opens from reference link");
  await archive.close();
  await card.getByRole("button",{name:"Tanya AKSARA"}).click();
  assert.equal(await page.locator("#knowledgeDialog").evaluate(d=>d.open),false);
  assert.match(await page.locator("#input").inputValue(),/ANTARA TAHU DAN APORIA/);
  assert.equal(questions.length,0,"Prepare never submits a chat request");

  await page.locator("#settingsPanel > summary").click();
  await page.locator("#featureKnowledge").click();
  const tabs=page.locator('#referenceHub [role="tab"]');
  await tabs.first().focus();await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator('[role="tab"][aria-selected="true"]').innerText(),"Wikipedia");
  await page.locator("#referenceWikiTopic").fill("falsafah");
  await page.locator("#referencePrepareWiki").click();
  assert.equal(await page.locator("#knowledgeDialog").evaluate(d=>d.open),false);
  assert.equal(await page.locator("#input").inputValue(),"Cari rujukan Wikipedia tentang falsafah");
  assert.equal(questions.length,0,"Wikipedia only runs on Send");
  await page.locator("#sendBtn").click();
  await page.waitForFunction(()=>window.AksaraReferenceHubUI.snapshot().sources.length===1,{timeout:11000});
  assert.deepEqual(questions,["Cari rujukan Wikipedia tentang falsafah"]);
  await page.locator("#settingsPanel > summary").click();
  await page.locator("#featureKnowledge").click();
  await page.locator("#referenceSourcesSection").scrollIntoViewIfNeeded();
  assert.match(await page.locator("#referenceSourceList").innerText(),/Ringkasan Wikipedia diperoleh/);
  assert.equal(await page.locator("#referenceSourceList a").count(),1);
  assert.equal(await page.locator("#referenceSourceList a").getAttribute("href"),"https://ms.wikipedia.org/wiki/Falsafah");
  await page.locator("#webObserveV2 > summary").click();
  assert.match(await page.locator("#webObserveV2 .aksara-observe-body").innerText(),/Ringkasan Wikipedia diperoleh/);

  await page.locator("#referenceTabPautan").click();
  await page.locator("#referenceUrl").fill("https://127.0.0.1/private");
  await page.locator("#referencePrepareUrl").click();
  assert.equal(await page.locator("#knowledgeDialog").evaluate(d=>d.open),true,"Reject unsafe local URL in browser");
  assert.match(await page.locator("#referenceFormNotice").innerText(),/URL awam HTTPS/);
  assert.equal(questions.length,1);
  await page.locator("#referenceUrl").fill("https://ms.wikipedia.org/wiki/Aporia");
  await page.locator("#referencePrepareUrl").click();
  assert.match(await page.locator("#input").inputValue(),/Baca teks halaman ini:/);
  assert.equal(questions.length,1,"URL prepare must never call AI automatically");
  await page.locator("#settingsPanel > summary").click();
  await page.locator("#featureKnowledge").click();
  await page.setViewportSize({width:320,height:760});
  const dimensions=await page.locator("#knowledgeDialog").evaluate(el=>{
   const r=el.getBoundingClientRect();
   return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,screen:innerWidth,overflow:el.scrollWidth>el.clientWidth+2};
  });
  assert.ok(dimensions.left>=-1&&dimensions.right<=dimensions.screen+1,"Reference modal must fit narrow mobile");
  assert.equal(dimensions.overflow,false,"No horizontal overflow within Reference modal");
  await page.evaluate(()=>window.dispatchEvent(new Event("ba:session-changed")));
  assert.equal(await page.locator("#referenceSourceList a").count(),0,"New session cannot inherit old references");
  assert.equal(await page.locator("#referenceSourceCount").innerText(),"0 pautan");
  assert.deepEqual(errors,[],"Uncaught JS errors: "+errors.join("; "));
  console.log("Pusat Rujukan v2 LULUS: karya asal, tab, Wikipedia, sumber, URL selamat, mobile dan privasi.");
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
