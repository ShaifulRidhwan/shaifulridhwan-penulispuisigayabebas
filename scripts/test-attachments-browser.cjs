"use strict";
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/.netlify/functions/**",route=>route.fulfill({status:503,contentType:"application/json",body:'{"error":"Offline QA"}'}));
  await page.goto(BASE+"/bilik-antara.html",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#attachmentTrigger");
  await page.waitForFunction(()=>!!window.AksaraCodeWorkspace?.importFiles,{timeout:12000});
  await page.locator("#attachmentTrigger").click();
  const names=await page.locator("#attachmentDialog [data-attachment-type]").evaluateAll(nodes=>nodes.map(n=>n.dataset.attachmentType));
  assert.deepEqual(names,["photo","video","document","audio","code"]);
  assert.equal(await page.locator("#attachmentCameraAction").isVisible(),true);
  assert.equal(await page.locator("#attachmentRecordAction").isVisible(),true);
  await page.locator("#attachmentClose").click();
  // Historical 100 KB restriction: 150 KB text must now be accepted.
  await page.locator("#attachmentDocument").setInputFiles({name:"long.txt",mimeType:"text/plain",buffer:Buffer.alloc(150000,65)});
  await page.waitForFunction(()=>document.querySelectorAll(".attachment-chip").length===1,{timeout:10000});
  assert.match(await page.locator("#docStatus").innerText(),/1 fail tersedia/);
  assert.equal(await page.locator("#attachmentTray").isVisible(),true);
  await page.locator("#attachmentDocument").setInputFiles({name:"note.md",mimeType:"text/markdown",buffer:Buffer.from("# Nota ringkas")});
  await page.waitForFunction(()=>document.querySelectorAll(".attachment-chip").length===2,{timeout:10000});
  await page.locator('.attachment-chip-remove[aria-label="Buang long.txt"]').click();
  assert.equal(await page.locator(".attachment-chip").count(),1);
  assert.equal(await page.locator(".attachment-chip-name").innerText(),"note.md");
  const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAJ4B9U0AAAAASUVORK5CYII=","base64");
  await page.locator("#attachmentPhoto").setInputFiles({name:"tiny.png",mimeType:"image/png",buffer:png});
  await page.waitForFunction(()=>document.querySelectorAll(".attachment-chip").length===2,{timeout:10000});
  assert.equal(await page.locator('.attachment-chip img[alt="Pratonton tiny.png"]').count(),1);
  await page.locator("#removeAttachment").click();
  assert.equal(await page.locator(".attachment-chip").count(),0);
  assert.equal(await page.locator("#attachmentTray").isVisible(),false);
  assert.equal(await page.locator("#removeAttachment").isVisible(),false);
  // Code import is opt-in, no AI call and no automatic execution.
  await page.locator("#attachmentCode").setInputFiles({name:"hello.html",mimeType:"text/html",buffer:Buffer.from("<h1>AKSARA LOCAL IMPORT</h1>")});
  await page.locator("#codeWorkspaceDialog").waitFor({state:"visible",timeout:10000});
  assert.match(await page.locator("#cwEditor").inputValue(),/AKSARA LOCAL IMPORT/);
  assert.equal(await page.locator("#cwFiles option").last().innerText(),"hello.html");
  assert.equal(await page.locator("#cwCppStatus").innerText(),"Sedia untuk compile.");
  await page.locator("#cwClose").click();
  assert.equal(errors.length,0,"No JS runtime errors: "+errors.join("; "));
  console.log("AKSARA smart attachments: picker, >100KB text, removable previews, code import PASS.");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
