"use strict";
/* No API keys or external inference. Tests the UI state separation in Chromium. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];let phase="connected",healthRequests=0;
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/.netlify/functions/**",async route=>{
   const url=route.request().url();
   if(url.includes("-stream"))return route.fulfill({status:404,contentType:"application/json",body:"{}"});
   let body={};try{body=route.request().postDataJSON()||{};}catch(_){}
   if(body.providerStatus===true){
    healthRequests++;
    if(phase==="error")return route.fulfill({status:503,contentType:"application/json",body:'{"error":"Provider health unavailable"}'});
    if(phase==="limited")return route.fulfill({status:429,contentType:"application/json",body:'{"code":"STATUS_RATE_LIMIT","retryAfterSeconds":45}'});
    const providers=phase==="connected"?[
     {id:"gemini",status:"online",model:"gemini-flash",pool:[
      {slot:1,status:"online",checkedAt:Date.now(),model:"gemini-flash"},
      {slot:2,status:"ready",model:"gemini-flash"},
      {slot:3,status:"off"},{slot:4,status:"off"}]},
     {id:"groq",status:"ready",model:"openai/gpt-oss-120b"},
     {id:"workers_ai",status:"off"},
     {id:"openrouter",status:"ready"}]:[
      {id:"gemini",status:"ready",pool:[]},
      {id:"groq",status:"ready"},{id:"workers_ai",status:"off"},
      {id:"openrouter",status:"ready"}
     ];
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
     ok:true,providers,checkedAt:Date.now(),someOnline:phase==="connected",
     someReady:true,preferredProvider:"gemini",freeModels:{status:"unavailable",models:[]}
    })});
   }
   return route.fulfill({status:503,contentType:"application/json",
    body:JSON.stringify({code:"ALL_PROVIDERS_BUSY",error:"Provider unavailable",retryable:false})});
  });
  await page.goto(BASE+"/bilik-antara.html",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.querySelector("#connectionText")?.textContent==="Multi A.I Connected",{timeout:15000});
  const health=page.locator("#connection");
  assert.equal(await health.getAttribute("data-health-state"),"connected");
  await page.evaluate(()=>window.dispatchEvent(new Event("ba:voice-connected")));
  assert.equal(await page.locator("#connectionText").innerText(),"Multi A.I Connected","Voice must not override text-provider health");
  await page.locator("#input").fill("Hello, test compact status separation");
  await page.locator("#sendBtn").click();
  await page.waitForFunction(()=>document.querySelector("#connectionInfoText")?.textContent.includes("Waiting for Capacity"),{timeout:12000});
  assert.equal(await page.locator("#connectionText").innerText(),"Multi A.I Connected","Busy request must NOT overwrite health pill");
  assert.match(await page.locator("#connectionInfoText").innerText(),/Waiting for Capacity/);
  await health.click();
  assert.equal(await page.locator("#multiAiDialog").isVisible(),true);
  assert.match(await page.locator("#multiAiCheckedAt").innerText(),/1\/4 Connected/);
  assert.equal(await page.locator('[data-provider="gemini"] [data-gemini-slot]').count(),4);
  phase="ready";
  await page.locator("#multiAiRefresh").click();
  await page.waitForFunction(()=>document.querySelector("#connectionText")?.textContent==="Multi A.I Ready",{timeout:12000});
  assert.equal(await health.getAttribute("data-health-state"),"ready");
  assert.equal(await health.evaluate(el=>el.classList.contains("ready")),false,"Ready cannot be green");
  phase="error";
  await page.locator("#multiAiRefresh").click();
  await page.waitForFunction(()=>document.querySelector("#connectionText")?.textContent==="Multi A.I Unverified",{timeout:12000});
  assert.notEqual(await page.locator("#connectionText").innerText(),"Multi A.I Offline");
  assert.equal(await page.locator("#multiAiList .multi-ai-state.is-online").count(),0);
  assert.match(await page.locator("#multiAiCheckedAt").innerText(),/Health check failed/);
  phase="limited";
  await page.locator("#multiAiRefresh").click();
  await page.waitForFunction(()=>document.querySelector("#multiAiCheckedAt")?.textContent.includes("HTTP 429"),{timeout:12000});
  assert.match(await page.locator("#multiAiCheckedAt").innerText(),/Retry in 45s/);
  assert.equal(await page.locator("#multiAiRefresh").isDisabled(),true,"Respect server Retry-After");
  const callsAtLimit=healthRequests;
  await health.evaluate(el=>el.click());
  assert.equal(healthRequests,callsAtLimit,"An in-cooldown retry must not call the backend");
  await page.locator("#multiAiClose").click();
  assert.equal(errors.length,0,"Browser errors: "+errors.join("; "));
  console.log("Multi A.I Status v2 PASS: connected, request isolation, Gemini 1-4, ready, refresh failure.");
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
