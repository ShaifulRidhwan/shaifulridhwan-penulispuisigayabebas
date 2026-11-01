"use strict";
/* Real Chromium regression: in-chat code routing, AI offline, sandbox + worker watchdog. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];const aiChatRequests=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/.netlify/functions/**",route=>{
   if(route.request().method()==="POST"){try{const data=route.request().postDataJSON();if(data?.question)aiChatRequests.push(data);}catch(_){}}
   return route.fulfill({status:503,contentType:"application/json",body:'{"error":"AI offline"}'});
  });
  await page.goto(BASE+"/bilik-antara.html",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.querySelector("#codeEngineStatusText")?.textContent==="Code Engine Ready",{timeout:15000});
  const geom=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,pills:document.querySelectorAll("#connection,#codeEngineStatus").length}));
  assert.ok(geom.scroll<=geom.width+6,"Mobile horizontal overflow: "+JSON.stringify(geom));
  assert.equal(geom.pills,2,"Multi AI and Code Engine must show independent statuses");
  assert.equal(await page.locator("#voiceLive").innerText(),"Voice Chat");
  async function oneLine(){
   return page.evaluate(()=>{
    const qs=["#voiceLive","#connection","#codeEngineStatus"].map(q=>document.querySelector(q).getBoundingClientRect());
    return {ys:qs.map(r=>Math.round(r.y)),overflow:document.documentElement.scrollWidth>innerWidth,headHeight:document.querySelector(".conversation-head").getBoundingClientRect().height};
   });
  }
  let one=await oneLine();
  assert.equal(one.overflow,false,"Mobile header overflow");
  assert.ok(Math.max(...one.ys)-Math.min(...one.ys)<12,"Status must be one line at 390px: "+JSON.stringify(one));
  await page.setViewportSize({width:320,height:760});
  one=await oneLine();
  assert.equal(one.overflow,false,"320px viewport overflow");
  assert.ok(Math.max(...one.ys)-Math.min(...one.ys)<12,"Status must be one line at 320px: "+JSON.stringify(one));
  await page.setViewportSize({width:390,height:844});

  // PORTAL keeps the feature panel, but its trigger now occupies the far-right topbar.
  const portal=await page.evaluate(()=>{
   const trigger=document.querySelector("#settingsPanel > summary");
   const text=trigger.querySelector("span").getBoundingClientRect();
   const icon=trigger.querySelector("svg").getBoundingClientRect();
   return {topbar:!!trigger.closest(".topbar"),iconAfter:icon.left>=text.right,
    navLinks:[...document.querySelectorAll(".topbar .nav-link")].map(a=>a.textContent.trim())};
  });
  assert.equal(portal.topbar,true,"PORTAL trigger must be in topbar");
  assert.equal(portal.iconAfter,true,"Grid icon must be to the RIGHT of PORTAL label");
  assert.deepEqual(portal.navLinks,["Laman utama"],"Studio and Novel belong only inside PORTAL");
  await page.locator("#settingsPanel > summary").click();
  assert.equal(await page.locator("#settingsPanel .settings-card").isVisible(),true);
  assert.equal(await page.locator("#featureStudio").getAttribute("href"),"studio-antara.html");
  assert.equal(await page.locator("#featureLibrary").getAttribute("href"),"perpustakaan-aksara.html");
  await page.keyboard.press("Escape");
  await page.waitForFunction(()=>!document.querySelector("#settingsPanel").open,{timeout:3000});
  assert.equal(await page.locator("#settingsPanel .settings-card").isVisible(),false);

  // Use the exact Multi A.I. glass modal primitives, not a visually separate popup.
  await page.locator("#connection").click();
  const visualSignature=selector=>page.locator(selector).evaluate(el=>{
   const s=getComputedStyle(el);
   return {width:Math.round(el.getBoundingClientRect().width),borderRadius:s.borderRadius,
    borderColor:s.borderColor,background:s.backgroundImage,backgroundColor:s.backgroundColor,
    padding:s.padding,backdropFilter:s.backdropFilter,boxShadow:s.boxShadow};
  });
  const multiGlass=await visualSignature("#multiAiDialog");
  const multiFooter=await page.locator("#multiAiRefresh").evaluate(el=>{
   const s=getComputedStyle(el);
   return {borderRadius:s.borderRadius,minHeight:s.minHeight,padding:s.padding,font:s.font,backgroundImage:s.backgroundImage};
  });
  await page.locator("#multiAiClose").click();
  await page.locator("#codeEngineStatus").click();
  const codeGlass=await visualSignature("#codeEngineMenu");
  assert.deepEqual(codeGlass,multiGlass,"Code Engine modal must reuse Multi AI glass layout and backdrop");
  assert.equal(await page.locator("#codeEngineMenu .multi-ai-head").count(),1);
  assert.equal(await page.locator("#codeEngineMenu .multi-ai-row").count(),6);
  const codeFooter=await page.locator("#codeEngineRefresh").evaluate(el=>{
   const s=getComputedStyle(el);
   return {borderRadius:s.borderRadius,minHeight:s.minHeight,padding:s.padding,font:s.font,backgroundImage:s.backgroundImage};
  });
  assert.deepEqual(codeFooter,multiFooter,"Code Engine footer must match Multi AI refresh styling");
  await page.locator("#codeEngineRefresh").click();
  await page.waitForFunction(()=>document.querySelector("#codeJavaScriptState")?.textContent==="Ready",{timeout:12000});
  assert.equal(await page.locator("#codeEngineMenu").isVisible(),true,"Refresh cannot close the dialog");
  assert.equal(await page.locator("#codeEngineStatus").getAttribute("aria-expanded"),"true");
  assert.equal(await page.locator("#codeJavaScriptState").innerText(),"Ready");
  assert.equal(await page.locator("#codeEngineMenu").isVisible(),true,"Status must open a menu, not navigate to another page");
  assert.equal(await page.locator('[data-code-language]').count(),4);
  assert.match(await page.locator("#codeEngineMenu").innerText(),/Enam bahasa pilihan/);
  assert.equal(await page.locator("#codeEngineMenu .code-menu-unavailable").count(),2,"C and C++ remain disabled until verified");
  await page.locator('[data-code-language="javascript"]').click();
  assert.equal(await page.locator("#codeEngineMenu").isVisible(),false);
  assert.match(page.url(),/bilik-antara\.html/);

  const snippet='const nombor = [10,20,30,40]; console.log(nombor.reduce((a,b)=>a+b,0));';
  await page.locator("#input").fill(snippet);
  assert.equal(await page.locator("#codeRunAction").isVisible(),true);
  await page.locator("#sendBtn").click();
  assert.equal(await page.locator("#codeSendAI").isVisible(),true,"Send code must ask confirmation");
  assert.equal(aiChatRequests.length,0,"Code confirmation may not use any AI endpoint");
  const started=Date.now();
  await page.locator("#codeRunAction").click();
  assert.equal(await page.locator("#runtimeAntaraDialog").isVisible(),true,"Runtime theatre should open during execution");
  assert.match(await page.locator("#runtimeAntaraTitle").innerText(),/RUNTIME ANTARA/);
  assert.equal(await page.locator("#runtimeAntaraLanguage").innerText(),"JavaScript");
  await page.waitForFunction(()=>document.querySelector("#chat .code-engine-message.ai .bubble")?.textContent.includes("100"),{timeout:12000});
  assert.ok(Date.now()-started>=2600,"Cinematic runtime view should display at least 3 seconds");
  assert.equal(await page.locator("#runtimeAntaraDialog").isVisible(),false,"Overlay should close after output");
  assert.match(await page.locator("#chat .code-engine-message.ai").last().innerText(),/BERJAYA/);
  assert.equal(await page.locator("#input").inputValue(),"","Executed script should clear composer");
  assert.equal(aiChatRequests.length,0,"Code execution must not call any AI endpoint");

  // The local chat result must be in history marked as code, not an AI reply.
  const local=await page.evaluate(()=>window.BilikAntaraBridge.snapshot().history.slice(-2));
  assert.deepEqual(local.map(x=>x.mode),["code","code"]);

  // Ordinary prose must remain an AI-chat intent rather than a code action.
  await page.locator("#input").fill("Kenapa langit berwarna biru?");
  assert.equal(await page.locator("#codeActionBar").isVisible(),false);

  // Python runs inside the disposable Web Worker using CDN Pyodide, without AI keys.
  await page.locator("#codeEngineStatus").click();
  await page.locator('[data-code-language="python"]').click();
  await page.locator("#input").fill('print("PYTHON DALAM CHAT")\nprint(sum([2,3,5,7]))');
  await page.locator("#codeRunAction").click();
  assert.equal(await page.locator("#runtimeAntaraDialog").isVisible(),true);
  assert.equal(await page.locator("#runtimeAntaraLanguage").innerText(),"Python");
  await page.waitForFunction(()=>[...document.querySelectorAll("#chat .code-engine-message.ai .bubble")].some(x=>x.textContent.includes("PYTHON DALAM CHAT")),{timeout:65000});
  const pyText=await page.locator("#chat .code-engine-message.ai").last().innerText();
  assert.match(pyText,/BERJAYA/,"Python Pyodide failed: "+pyText);
  assert.match(pyText,/17/);
  assert.equal(await page.locator("#runtimeAntaraDialog").isVisible(),false);
  assert.equal(aiChatRequests.length,0,"Python may load Pyodide CDN but must not call AI");

  // TypeScript: real transpilation and execution, not merely an extra menu label.
  await page.locator("#codeEngineStatus").click();
  await page.locator('[data-code-language="typescript"]').click();
  await page.locator("#input").fill('const value: number = 6 * 7;\\nconsole.log("TS CHECK:", value);'.replace('\\n','\n'));
  await page.locator("#codeRunAction").click();
  await page.waitForFunction(()=>[...document.querySelectorAll("#chat .code-engine-message.ai .bubble")].some(x=>x.textContent.includes("TS CHECK: 42")),{timeout:42000});
  assert.match(await page.locator("#chat .code-engine-message.ai").last().innerText(),/TypeScript · BERJAYA/);
  assert.equal(aiChatRequests.length,0);

  // SQL: WebAssembly SQLite executes a fresh in-memory database per request.
  await page.locator("#codeEngineStatus").click();
  await page.locator('[data-code-language="sql"]').click();
  await page.locator("#input").fill('CREATE TABLE numbers (n INTEGER); INSERT INTO numbers VALUES (6), (7); SELECT SUM(n) AS total FROM numbers;');
  await page.locator("#codeRunAction").click();
  await page.waitForFunction(()=>[...document.querySelectorAll("#chat .code-engine-message.ai .bubble")].some(x=>x.textContent.includes("total\\n13")),{timeout:45000});
  assert.match(await page.locator("#chat .code-engine-message.ai").last().innerText(),/SQL · BERJAYA/);
  assert.equal(aiChatRequests.length,0);

  // A CPU-bound JS loop must terminate on watchdog without freezing the main chat.
  await page.locator("#codeEngineStatus").click();
  await page.locator('[data-code-language="javascript"]').click();
  await page.locator("#input").fill('while (true) {}');
  await page.locator("#codeRunAction").click();
  await page.waitForFunction(()=>[...document.querySelectorAll("#chat .code-engine-message.ai .bubble")].some(x=>x.textContent.includes("Had masa dicapai")),{timeout:16000});
  assert.ok(await page.locator("#sendBtn").count(),"Chat must remain responsive after timeout");
  assert.equal(await page.locator("#runtimeAntaraDialog").isVisible(),false,"Timeout must close theatre");
  // Stop inside the overlay must abort immediately, without a forced 3-second delay.
  await page.locator("#input").fill('console.log("STOP TEST"); while (true) {}');
  const beforeStop=Date.now();
  await page.locator("#codeRunAction").click();
  await page.locator("#runtimeAntaraStop").click();
  await page.waitForFunction(()=>[...document.querySelectorAll("#chat .code-engine-message.ai .bubble")].some(x=>x.textContent.includes("Pelaksanaan dihentikan.")),{timeout:6500});
  assert.ok(Date.now()-beforeStop<3000,"Stop must bypass cinematic minimum delay");
  assert.equal(await page.locator("#runtimeAntaraDialog").isVisible(),false);
  await page.locator("#input").fill('console.log("AFTER TIMEOUT OK");');
  await page.locator("#codeRunAction").click();
  await page.waitForFunction(()=>[...document.querySelectorAll("#chat .code-engine-message.ai .bubble")].some(x=>x.textContent.includes("AFTER TIMEOUT OK")),{timeout:12000});
  assert.equal(aiChatRequests.length,0,"No AI requests in the entire code test");

  assert.deepEqual(errors,[],"Browser page errors: "+errors.join("; "));
  console.log("AKSARA in-chat Code Engine PASS: status menu, explicit consent, JS 100, Python 17, offline AI, worker watchdog and recovery.");
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
