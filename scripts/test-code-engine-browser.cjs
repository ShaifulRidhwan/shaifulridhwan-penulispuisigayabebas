"use strict";
/* Real Chromium regression: in-chat code routing, AI offline, sandbox + worker watchdog. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];let aiPostCount=0;
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/.netlify/functions/**",route=>{
   if(route.request().method()==="POST")aiPostCount++;
   return route.fulfill({status:503,contentType:"application/json",body:'{"error":"AI offline"}'});
  });
  await page.goto(BASE+"/bilik-antara.html",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.querySelector("#codeEngineStatusText")?.textContent==="Code Engine Ready",{timeout:15000});
  const geom=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,pills:document.querySelectorAll("#connection,#codeEngineStatus").length}));
  assert.ok(geom.scroll<=geom.width+6,"Mobile horizontal overflow: "+JSON.stringify(geom));
  assert.equal(geom.pills,2,"Multi AI and Code Engine must show independent statuses");

  await page.locator("#codeEngineStatus").click();
  assert.equal(await page.locator("#codeEngineMenu").isVisible(),true,"Status must open a menu, not navigate to another page");
  assert.equal(await page.locator('[data-code-language]').count(),2);
  assert.match(await page.locator("#codeEngineMenu").innerText(),/10 compiler sasaran/);
  await page.locator('[data-code-language="javascript"]').click();
  assert.equal(await page.locator("#codeEngineMenu").isVisible(),false);
  assert.match(page.url(),/bilik-antara\.html/);

  const snippet='const nombor = [10,20,30,40]; console.log(nombor.reduce((a,b)=>a+b,0));';
  await page.locator("#input").fill(snippet);
  assert.equal(await page.locator("#codeRunAction").isVisible(),true);
  await page.locator("#sendBtn").click();
  assert.equal(await page.locator("#codeSendAI").isVisible(),true,"Send code must ask confirmation");
  assert.equal(aiPostCount,0,"Code confirmation may not use any AI endpoint");
  await page.locator("#codeRunAction").click();
  await page.waitForFunction(()=>document.querySelector("#chat .code-engine-message.ai .bubble")?.textContent.includes("100"),{timeout:12000});
  assert.match(await page.locator("#chat .code-engine-message.ai").last().innerText(),/BERJAYA/);
  assert.equal(await page.locator("#input").inputValue(),"","Executed script should clear composer");
  assert.equal(aiPostCount,0,"Code execution must not call any AI endpoint");

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
  await page.waitForFunction(()=>[...document.querySelectorAll("#chat .code-engine-message.ai .bubble")].some(x=>x.textContent.includes("PYTHON DALAM CHAT")),{timeout:65000});
  const pyText=await page.locator("#chat .code-engine-message.ai").last().innerText();
  assert.match(pyText,/BERJAYA/,"Python Pyodide failed: "+pyText);
  assert.match(pyText,/17/);
  assert.equal(aiPostCount,0,"Python may load Pyodide CDN but must not call AI");

  // A CPU-bound JS loop must terminate on watchdog without freezing the main chat.
  await page.locator("#codeEngineStatus").click();
  await page.locator('[data-code-language="javascript"]').click();
  await page.locator("#input").fill('while (true) {}');
  await page.locator("#codeRunAction").click();
  await page.waitForFunction(()=>[...document.querySelectorAll("#chat .code-engine-message.ai .bubble")].some(x=>x.textContent.includes("Had masa dicapai")),{timeout:16000});
  assert.ok(await page.locator("#sendBtn").count(),"Chat must remain responsive after timeout");
  await page.locator("#input").fill('console.log("AFTER TIMEOUT OK");');
  await page.locator("#codeRunAction").click();
  await page.waitForFunction(()=>[...document.querySelectorAll("#chat .code-engine-message.ai .bubble")].some(x=>x.textContent.includes("AFTER TIMEOUT OK")),{timeout:12000});
  assert.equal(aiPostCount,0,"No AI requests in the entire code test");

  assert.deepEqual(errors,[],"Browser page errors: "+errors.join("; "));
  console.log("AKSARA in-chat Code Engine PASS: status menu, explicit consent, JS 100, Python 17, offline AI, worker watchdog and recovery.");
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
