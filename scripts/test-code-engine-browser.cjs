"use strict";
/* Code Engine browser regression: no API key, never relies on AI provider uptime. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/.netlify/functions/**",route=>route.fulfill({status:503,contentType:"application/json",body:'{"error":"AI offline"}'}));
  await page.goto(BASE+"/bilik-antara.html",{waitUntil:"domcontentloaded"});
  await page.locator("#codeEngineStatusText").waitFor({timeout:12000});
  await page.waitForFunction(()=>document.querySelector("#codeEngineStatusText")?.textContent==="Code Engine Ready",{timeout:15000});
  const header=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,pills:document.querySelectorAll("#connection,#codeEngineStatus").length}));
  assert.ok(header.scroll<=header.width+6,"Mobile horizontal overflow: "+JSON.stringify(header));
  assert.equal(header.pills,2,"Exactly two independent statuses");
  await page.locator("#codeEngineStatus").click();
  await page.waitForURL("**/bilik-antara-code-engine.html");
  assert.equal(await page.locator("#language option").count(),2,"Only confirmed runtime candidates should be selectable");
  await page.locator("#editor").fill('console.log(6 * 7);');
  await page.locator("#run").click();
  await page.waitForFunction(()=>document.getElementById("progress")?.textContent.startsWith("Berjaya"),{timeout:12000});
  assert.equal((await page.locator("#output").innerText()).trim(),"42");
  await page.locator("#editor").fill('throw new Error("ujian-ralat");');
  await page.locator("#run").click();
  await page.waitForFunction(()=>document.getElementById("progress")?.textContent.includes("ralat"),{timeout:12000});
  assert.match(await page.locator("#output").innerText(),/ujian-ralat/);
  await page.locator("#editor").fill('try { await fetch("/api/aksara-health"); } catch (e) { console.log("NETWORK BLOCKED"); }');
  await page.locator("#run").click();
  await page.waitForFunction(()=>document.getElementById("progress")?.textContent.startsWith("Berjaya"),{timeout:12000});
  assert.match(await page.locator("#output").innerText(),/NETWORK BLOCKED/,"Sandbox must block network");
  assert.equal(errors.length,0,"Uncaught parent page errors: "+errors.join("; "));
  console.log("AKSARA Code Engine browser smoke passed: independent status, mobile width, JS result/error, CSP network block.");
  await page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
