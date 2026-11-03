"use strict";
const assert=require("node:assert/strict"),{chromium}=require("playwright");
const BASE=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const viewport of [{width:390,height:844},{width:1280,height:800}]){
   const page=await browser.newPage({viewport});
   const errors=[],sent=[],lookups=[];
   page.on("pageerror",e=>errors.push(e.message));
   await page.route("**/.netlify/functions/**",async route=>{
    if(route.request().url().includes("-stream"))return route.fulfill({status:404,contentType:"application/json",body:"{}"});
    let body={};try{body=route.request().postDataJSON()||{}}catch(_){}
    if(body.providerStatus)return route.fulfill({status:503,contentType:"application/json",body:'{"error":"Health offline for test"}'});
    if(route.request().url().includes("/aksara-reference-hub")){
     lookups.push(body);
     const reply=body.action==="wikipedia"?
      {status:"ada_hasil",sources:[{title:"Aporia",url:"https://ms.wikipedia.org/wiki/Aporia",
       excerpt:"Aporia bermaksud kebuntuan hujah dalam falsafah."}]}:
      {status:"berjaya",expression:body.expression,result:60};
     return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(reply)});
    }
    sent.push(body);
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
     mode:"live",provider:"gemini",model:"mock-model",reply:"Rujukan Aporia ditemui.",
     durMs:85,toolsUsed:["wikipedia_summary"],sources:[
      {title:"Aporia – Wikipedia",url:"https://ms.wikipedia.org/wiki/Aporia"},
      {title:"Pautan setempat",url:"https://127.0.0.1/internal"},
      {title:"Sumber http",url:"http://example.com/unverified"}
     ]})});
   });
   await page.goto(BASE+"/bilik-antara.html",{waitUntil:"domcontentloaded"});
   await page.waitForFunction(()=>!!window.AksaraKnowledgeHubUI,{timeout:12000});
   async function open(){
    await page.locator("#settingsPanel > summary").click();
    await page.locator("#featureKnowledge").click();
    assert.equal(await page.locator("#knowledgeDialog").isVisible(),true);
   }
   await open();
   const hub=page.locator("#knowledgeHub");
   await page.waitForFunction(()=>document.querySelectorAll("#knowledgeWorkResults .knowledge-item").length>0,{timeout:12000});
   assert.equal(await page.locator("#knowledgeDialog #knowledgeTitle").innerText(),"Pusat Pengetahuan & Rujukan");
   assert.match(await page.locator("#knowledgeWorkStatus").innerText(),/entri arkib/);
   assert.equal(sent.length,0,"Local archive must not trigger AI or external research");
   await page.locator("#knowledgeWorkSearch").fill("aporia");
   assert.match(await hub.locator(".knowledge-item").first().innerText(),/ANTARA TAHU DAN APORIA/);
   const poemUrl=await hub.locator(".knowledge-item .knowledge-work-original").first().getAttribute("href");
   assert.match(poemUrl,/index\.html\?karya=ANTARA%20TAHU%20DAN%20APORIA#karya/);
   await hub.locator(".knowledge-item details summary").first().click();
   assert.match(await hub.locator(".knowledge-item details p").first().innerText(),/Jemari menyeluk/);
   await hub.locator(".knowledge-item button").first().click();
   assert.equal(await page.locator("#knowledgeDialog").isVisible(),false);
   assert.match(await page.locator("#input").inputValue(),/Analisis puisi ANTARA TAHU DAN APORIA/);
   assert.equal(sent.length,0,"Drafting poem questions must not silently send them");

   await open();
   await page.locator("#knowledgeTabWiki").click();
   assert.equal(await page.locator("#knowledgeWiki").isVisible(),true);
   await page.locator("#knowledgeWikiQuery").fill("aporia");
   assert.equal(lookups.length,0,"No Wikipedia calls just for opening the panel");
   await page.locator("#knowledgeWikiSearch").click();
   await page.waitForFunction(()=>document.querySelector("#knowledgeWikiResults")?.textContent.includes("Aporia"),{timeout:7000});
   assert.equal(lookups.length,1);
   assert.deepEqual(lookups[0],{action:"wikipedia",query:"aporia"});
   assert.match(await page.locator("#knowledgeWikiResults").innerText(),/kebuntuan hujah/);
   assert.equal(await page.locator("#knowledgeWikiResults a").first().getAttribute("href"),"https://ms.wikipedia.org/wiki/Aporia");
   assert.equal(sent.length,0,"Direct reference lookup must not use AI inference");
   await page.locator("#knowledgeWikiDraft").click();
   assert.equal(await page.locator("#knowledgeDialog").isVisible(),false);
   assert.match(await page.locator("#input").inputValue(),/Cari rujukan Wikipedia tentang aporia/);
   assert.equal(sent.length,0,"Wikipedia button only prepares a question");

   await page.locator("#sendBtn").click();
   await page.waitForFunction(()=>document.querySelector("#webObserveV2")?.dataset.state==="ringkasan",{timeout:13000});
   assert.equal(sent.length,1);
   assert.match(sent[0].question,/Wikipedia tentang aporia/);
   await open();
   assert.match(await page.locator("#knowledgeSourceSummary").innerText(),/Ringkasan Wikipedia diperoleh/);
   assert.equal(await page.locator("#knowledgeSourcesList a").count(),1,"Private or HTTP links must be filtered");
   assert.equal(await page.locator("#knowledgeSourcesList a").first().getAttribute("href"),"https://ms.wikipedia.org/wiki/Aporia");
   assert.equal(await page.locator("#knowledgeSourcesList a").first().getAttribute("rel"),"noopener noreferrer");

   await page.locator("#knowledgeTabCalc").click();
   assert.equal(await page.locator("#knowledgeCalc").isVisible(),true);
   await page.locator("#knowledgeCalcInput").fill("(12+8)*3");
   await page.locator("#knowledgeCalcRun").click();
   await page.waitForFunction(()=>document.querySelector("#knowledgeCalcStatus")?.textContent.includes("= 60"),{timeout:7000});
   assert.deepEqual(lookups[1],{action:"calculate",expression:"(12+8)*3"});
   assert.equal(sent.length,1,"Direct calculator must not call AI");
   await page.locator("#knowledgeCalcDraft").click();
   assert.equal(await page.locator("#knowledgeDialog").isVisible(),false);
   assert.equal(await page.locator("#input").inputValue(),"Kira (12+8)*3");
   assert.equal(sent.length,1,"Calculator only prepares a draft; it does not execute code");
   await open();
   await page.locator("#knowledgeTabUrl").click();
   await page.locator("#knowledgeUrlInput").fill("http://127.0.0.1/secrets");
   await page.locator("#knowledgeUrlDraft").click();
   assert.equal(await page.locator("#knowledgeDialog").isVisible(),true);
   assert.match(await page.locator("#knowledgeHubAlert").innerText(),/HTTPS awam/);
   await page.locator("#knowledgeUrlInput").fill("https://example.com/artikel");
   await page.locator("#knowledgeUrlDraft").click();
   assert.equal(await page.locator("#knowledgeDialog").isVisible(),false);
   assert.match(await page.locator("#input").inputValue(),/Baca teks halaman awam di URL ini: https:\/\/example.com\/artikel/);
   assert.equal(sent.length,1,"URL preparation cannot run a background crawler");
   await page.evaluate(()=>window.dispatchEvent(new Event("ba:session-changed")));
   await open();
   assert.equal(await page.locator("#knowledgeSourcesList a").count(),0,"Old session sources must not persist");
   assert.ok(await page.locator("#knowledgeHub").evaluate(el=>el.scrollWidth<=el.clientWidth+2),"Reference hub mobile overflow");
   await page.locator("#knowledgeClose").click();
   assert.deepEqual(errors,[],"Browser errors: "+errors.join("; "));
   await page.goto(BASE+"/index.html?karya=ANTARA%20TAHU%20DAN%20APORIA#karya",{waitUntil:"domcontentloaded"});
   await page.waitForFunction(()=>document.querySelector("#works .work.open h3")?.textContent==="ANTARA TAHU DAN APORIA",{timeout:12000});
   assert.equal(await page.locator("#searchInput").inputValue(),"ANTARA TAHU DAN APORIA");
   await page.close();
  }
  console.log("Pusat Rujukan v3 LULUS: karya sebenar, Wikipedia, URL, bukti sumber, privasi dan mobile/desktop.");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
