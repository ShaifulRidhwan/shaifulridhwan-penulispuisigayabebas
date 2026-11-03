"use strict";
/* Two-tab storage regression against a local static server; all AI calls mocked. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
const KEY="bilik-antara-suite-v1-archive",MEM="bilik-antara-suite-v1-memory";
async function mock(page){
 await page.route("**/.netlify/functions/**",route=>{
  const url=route.request().url();
  if(url.includes("-stream"))return route.fulfill({status:404,contentType:"application/json",body:"{}"});
  return route.fulfill({status:200,contentType:"application/json",
   body:JSON.stringify({mode:"fallback",provider:"local",reply:"Ujian tanpa kuota",toolsUsed:[]})});
 });
}
async function ready(page){
 await page.goto(BASE+"/bilik-antara.html",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>!!window.BilikAntaraBridge&&!!window.BilikAntaraSuite,{timeout:20000});
}
async function sessions(page){
 await page.locator("#settingsPanel > summary").click();
 await page.locator("#featureSessions").click();
 await page.waitForFunction(()=>document.body.classList.contains("ba-panel-open"),{timeout:5000});
}
async function close(page){
 await page.keyboard.press("Escape");
 await page.waitForFunction(()=>!document.body.classList.contains("ba-panel-open"),{timeout:5000});
}
async function localMessage(page,name){
 return page.evaluate(n=>window.BilikAntaraBridge.addLocalCode([
  {role:"user",content:"Perbualan "+n+" panjang untuk ujian sesi."},
  {role:"assistant",content:"Jawapan "+n+" disimpan setempat."}
 ]),name);
}
async function archived(page){
 return page.evaluate(key=>{
  const raw=localStorage.getItem(key);
  return raw?JSON.parse(raw):[];
 },KEY);
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const context=await browser.newContext();
  const a=await context.newPage();await mock(a);await ready(a);
  assert.equal(await a.locator("#rememberChat").isChecked(),true);
  assert.equal(await a.evaluate(()=>window.BilikAntaraSuite.getStorageStatus().memoryEnabled),true);
  await sessions(a);
  const fieldA=a.locator(".ba-drawer .ba-editor").first();
  await fieldA.fill("Ingatan A yang disahkan");
  await a.getByRole("button",{name:"Simpan memori",exact:true}).click();
  assert.equal(await a.evaluate(()=>window.BilikAntaraSuite.memoryForPrompt("Apa ingatan?")),"Ingatan A yang disahkan");
  await close(a);
  assert.equal(await localMessage(a,"A"),true);
  assert.equal((await archived(a)).length,1);

  const b=await context.newPage();await mock(b);await ready(b);
  assert.equal(await b.evaluate(()=>window.BilikAntaraSuite.memoryForPrompt("Apa ingatan?")),"Ingatan A yang disahkan");
  await sessions(b);
  await b.getByRole("button",{name:"+ Sesi baharu",exact:true}).click();
  await localMessage(b,"B");
  assert.equal((await archived(b)).length,2,"Two tabs must not erase each other's archives");

  await a.reload({waitUntil:"domcontentloaded"});
  await a.waitForFunction(()=>!!window.BilikAntaraSuite);
  const restoredA=await a.evaluate(()=>window.BilikAntaraBridge.snapshot().history);
  assert.ok(restoredA.some(x=>x.content.includes("Perbualan A")),"Tab A must restore A, not overwritten B");
  await b.reload({waitUntil:"domcontentloaded"});
  await b.waitForFunction(()=>!!window.BilikAntaraSuite);
  const restoredB=await b.evaluate(()=>window.BilikAntaraBridge.snapshot().history);
  assert.ok(restoredB.some(x=>x.content.includes("Perbualan B")),"Tab B must restore B");

  await sessions(b);
  await b.locator(".ba-drawer .ba-editor").first().fill("Draf B yang belum disimpan");
  await sessions(a);
  await a.locator(".ba-drawer .ba-editor").first().fill("Ingatan A yang dikemas kini");
  await a.getByRole("button",{name:"Simpan memori",exact:true}).click();
  await close(a);
  const dialogs=[];
  b.once("dialog",async d=>{dialogs.push(d.message());await d.dismiss();});
  await b.getByRole("button",{name:"Simpan memori",exact:true}).click();
  assert.ok(dialogs.some(x=>x.includes("berubah di tab lain")),"Stale note save requires confirmation");
  assert.equal(await b.evaluate(key=>JSON.parse(localStorage.getItem(key)).text,MEM),"Ingatan A yang dikemas kini");
  b.once("dialog",d=>d.dismiss());
  await b.keyboard.press("Escape");
  assert.equal(await b.locator(".ba-drawer").isVisible(),true,"Cancel must retain unsaved draft");
  b.once("dialog",d=>d.accept());
  await close(b);

  await a.locator("#settingsPanel > summary").click();
  a.once("dialog",d=>d.dismiss());
  await a.locator("#rememberChat").uncheck();
  assert.equal(await a.locator("#rememberChat").isChecked(),true);
  assert.equal((await archived(a)).length,2,"Cancelled opt-out must keep archive");
  a.once("dialog",d=>d.accept());
  await a.locator("#rememberChat").uncheck();
  assert.equal(await a.locator("#rememberChat").isChecked(),false);
  await b.waitForFunction(()=>document.querySelector("#rememberChat")?.checked===false,{timeout:8000});
  assert.equal((await archived(a)).length,0);
  assert.equal(await localMessage(b,"After opt out"),true);
  assert.equal((await archived(a)).length,0,"Another tab cannot silently resave after opt-out");
  assert.equal(await a.evaluate(key=>JSON.parse(localStorage.getItem(key)).text,MEM),
   "Ingatan A yang dikemas kini","Session opt-out never deletes separately saved memory");
  await context.close();
  console.log("AKSARA Sesi & Memori Integrity v2 PASS: two tabs, note drafts, opt-outs, no inference calls.");
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
