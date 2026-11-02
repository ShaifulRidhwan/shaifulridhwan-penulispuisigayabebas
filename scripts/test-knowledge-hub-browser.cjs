"use strict";
/* Playwright mock: Tiada kuota AI, Tavily atau Wikimedia sebenar digunakan. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[],calls=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.route("**/.netlify/functions/**",async route=>{
   const u=route.request().url();
   let payload={};try{payload=route.request().postDataJSON()||{};}catch(_){}
   if(u.endsWith("/aksara-reference-hub")){
    calls.push(payload);
    const data=payload.action==="wikipedia"?{status:"ada_hasil",
     sources:[{title:"Falsafah",url:"https://ms.wikipedia.org/wiki/Falsafah",
      excerpt:"Kajian tentang pengetahuan dan hakikat realiti."}]}:
     {status:"berjaya",result:60,source:"Pengiraan selamat"};
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
   }
   return route.fulfill({status:503,contentType:"application/json",body:"{}"});
  });
  await page.goto(BASE+"/bilik-antara.html",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>Boolean(window.AksaraKnowledgeHubUI),{timeout:12000});
  assert.equal(calls.length,0,"Panel cannot trigger paid or Wikipedia calls on page load");
  await page.locator("#settingsPanel > summary").click();
  await page.locator("#featureKnowledge").click();
  assert.equal(await page.locator("#knowledgeDialog").isVisible(),true);
  assert.equal(await page.locator("#knowledgeHubV3").count(),1);
  assert.equal(await page.locator("#knowledgeHubV3 [role=tab]").count(),4);
  assert.match(await page.locator("#knowledgeDescription").innerText(),/Cari puisi AKSARA/);
  assert.equal(calls.length,0,"Opening reference hub must not fetch Wikipedia");
  await page.locator("#knowledgeHubInput").fill("aporia");
  await page.locator("#knowledgeHubSubmit").click();
  await page.waitForFunction(()=>document.querySelector("#knowledgeHubStatus")?.textContent.includes("karya ditemui"));
  assert.match(await page.locator("#knowledgeHubResults").innerText(),/ANTARA TAHU DAN APORIA/);
  const workHref=await page.locator("#knowledgeHubResults .knowledge-hub-result-actions a").first().getAttribute("href");
  assert.match(workHref,/index\.html\?karya=ANTARA%20TAHU%20DAN%20APORIA#karya/);
  assert.equal(calls.length,0,"Local artwork search must remain free and offline-capable");

  await page.locator("#knowledgeTab-wikipedia").click();
  assert.match(await page.locator("#knowledgeHubGuide").innerText(),/Wikipedia Melayu dan Inggeris/);
  await page.locator("#knowledgeHubInput").fill("falsafah");
  await page.locator("#knowledgeHubSubmit").click();
  await page.waitForFunction(()=>document.querySelector("#knowledgeHubResults")?.textContent.includes("Falsafah"),{timeout:7000});
  assert.equal(calls.length,1);
  assert.deepEqual(calls[0],{action:"wikipedia",query:"falsafah"});
  assert.match(await page.locator("#knowledgeHubResults").innerText(),/Kajian tentang pengetahuan/);
  assert.equal(await page.locator("#knowledgeHubResults a").first().getAttribute("href"),"https://ms.wikipedia.org/wiki/Falsafah");

  await page.locator("#knowledgeTab-kira").click();
  await page.locator("#knowledgeHubInput").fill("(12+8)*3");
  await page.locator("#knowledgeHubSubmit").click();
  await page.waitForFunction(()=>document.querySelector("#knowledgeHubResults")?.textContent.includes("= 60"),{timeout:7000});
  assert.deepEqual(calls[1],{action:"calculate",expression:"(12+8)*3"});
  assert.match(await page.locator("#knowledgeHubStatus").innerText(),/bukan model AI/);

  await page.locator("#knowledgeTab-url").click();
  await page.locator("#knowledgeHubInput").fill("https://localhost/private");
  await page.locator("#knowledgeHubSubmit").click();
  assert.match(await page.locator("#knowledgeHubStatus").innerText(),/Alamat setempat tidak dibenarkan/);
  assert.equal(await page.locator("#knowledgeDialog").isVisible(),true);
  await page.locator("#knowledgeHubInput").fill("https://example.org/article");
  await page.locator("#knowledgeHubSubmit").click();
  assert.equal(await page.locator("#knowledgeDialog").isVisible(),false);
  assert.match(await page.locator("#input").inputValue(),/Baca dan semak kandungan URL ini: https:\/\/example.org\/article/);
  assert.equal(calls.length,2,"URL handoff only prepares chat, no hidden network call");

  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("ba:answered",{
   detail:{sources:[{title:"Sumber ujian",url:"https://ms.wikipedia.org/wiki/Falsafah"}]}
  })));
  await page.locator("#settingsPanel > summary").click();
  await page.locator("#featureKnowledge").click();
  await page.locator("#knowledgeHubSources > summary").click();
  assert.match(await page.locator("#knowledgeHubSourcesList").innerText(),/Sumber ujian/);
  await page.evaluate(()=>window.dispatchEvent(new Event("ba:session-changed")));
  assert.match(await page.locator("#knowledgeHubSourcesList").innerText(),/Tiada sumber dipautkan/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,"No narrow-screen horizontal overflow");
  await page.locator("#knowledgeClose").click();

  await page.goto(BASE+"/index.html?karya=ANTARA%20TAHU%20DAN%20APORIA#karya",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.querySelector("#works .work.open h3")?.textContent==="ANTARA TAHU DAN APORIA",{timeout:12000});
  assert.equal(await page.locator("#searchInput").inputValue(),"ANTARA TAHU DAN APORIA");
  assert.deepEqual(errors,[],"Browser errors: "+errors.join("; "));
  console.log("Pusat Rujukan v3 LULUS: karya + deep link, Wikipedia, kalkulator, URL, sumber per sesi.");
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
