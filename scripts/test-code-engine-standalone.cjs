"use strict";
const {chromium}=require("playwright"),assert=require("node:assert/strict"),path=require("node:path");
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  const file="file://"+path.resolve(__dirname,"../code-engine-demo/AKSARA-Code-Engine-v0.1.html");
  await page.goto(file,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.querySelector("#engineStatus")?.textContent.includes("READY"),{timeout:15000});
  await page.locator("#editor").fill('console.log("JALAN TANPA AI"); console.log(21*2);');
  await page.locator("#run").click();
  await page.waitForFunction(()=>document.querySelector("#progress")?.textContent.startsWith("Berjaya"),{timeout:15000});
  const output=await page.locator("#output").innerText();
  assert.match(output,/JALAN TANPA AI/);assert.match(output,/42/);
  console.log("AKSARA standalone HTML PASS: JS run from local file, no server, no AI.");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
