"use strict";
/* Browser QA for Voice permission preflight and native-select replacement.
   No real microphone permission, Google request or code execution. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const ROOT=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
async function inspect(browser,name,viewport){
 const context=await browser.newContext({viewport,isMobile:name==="mobile",hasTouch:name==="mobile"});
 const page=await context.newPage();
 let tokens=0;
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/.netlify/functions/bilik-antara-live-token",async route=>{
  tokens++;
  await route.fulfill({status:503,contentType:"application/json",
   body:JSON.stringify({error:"Mock only",reason:"TOKEN_HTTP_503"})});
 });
 await page.addInitScript(()=>{
  window.__micRequests=0;
  Object.defineProperty(navigator,"permissions",{configurable:true,value:{
   query:async()=>({state:"prompt",onchange:null})
  }});
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{
   getUserMedia:async()=>{window.__micRequests++;throw new DOMException("Mock permission","NotAllowedError");}
  }});
 });
 try{
  await page.goto(ROOT+"/bilik-antara.html",{waitUntil:"domcontentloaded",timeout:35000});
  await page.waitForSelector("#voicePanel.voice-ui-experiment-v3 .voice-v4-brand",{state:"attached",timeout:18000});
  await page.waitForFunction(()=>Boolean(document.querySelector('link[href*="bilik-antara-ui-polish.css"]')?.sheet),null,{timeout:8000});
  const voice=page.locator("#voiceLive");
  await voice.click();
  const mic=page.locator("#aksaraMicPermission");
  await mic.waitFor({state:"visible",timeout:3000});
  assert.equal(tokens,0,name+" preflight requested token before consent");
  assert.equal(await page.evaluate(()=>window.__micRequests),0,name+" preflight requested microphone before consent");
  const look=await mic.evaluate(el=>{
   const s=getComputedStyle(el);return {bg:s.backgroundImage,blur:s.backdropFilter,radius:parseFloat(s.borderTopLeftRadius)};
  });
  assert.match(look.bg,/linear-gradient/);assert.match(look.blur,/blur/);assert.ok(look.radius>=20);
  await page.locator("#aksaraMicCancel").click();
  assert.equal(await mic.isVisible(),false,name+" cancel should close preflight");
  assert.equal(await page.evaluate(()=>window.__micRequests),0);
  await voice.click();
  await page.locator("#aksaraMicContinue").click();
  await page.waitForFunction(()=>window.__micRequests===1,null,{timeout:3000});
  assert.equal(await mic.isVisible(),false,name+" continue must dismiss preflight");
  assert.equal(await page.evaluate(()=>window.BilikAntaraVoiceDiagnostics.snapshot().sessionActive),false);
  await page.locator("#codeAITerminalOpen").click();
  const terminal=page.locator("#aksaraAITerminal");
  await terminal.waitFor({state:"visible",timeout:4000});
  assert.equal(await page.locator("#aitExampleSelect").isVisible(),false,"native terminal select must be hidden");
  await page.locator("#aitExampleGlass").click();
  const picker=page.locator("#aksaraTerminalGlassPicker");
  await picker.waitFor({state:"visible",timeout:3000});
  assert.equal(await picker.locator(".aksara-glass-picker-option").count(),7,"all code examples exposed");
  const pickerSkin=await picker.evaluate(el=>{const s=getComputedStyle(el);return {bg:s.backgroundImage,blur:s.backdropFilter};});
  assert.match(pickerSkin.bg,/linear-gradient/);assert.match(pickerSkin.blur,/blur/);
  await picker.locator(".aksara-glass-picker-option").filter({hasText:"JavaScript · 42"}).click();
  assert.equal(await page.locator("#aitExampleSelect").inputValue(),"javascript");
  await page.locator("#aitLoadExample").click();
  assert.match(await page.locator("#aitEditor").inputValue(),/console\.log/);
  await page.locator("#aitFileGlass").click();
  await picker.waitFor({state:"visible"});
  await page.keyboard.press("Escape");
  assert.equal(await picker.isVisible(),false,"Escape closes picker without changing file");
  assert.deepEqual(errors,[],name+" page errors: "+errors.join("; "));
  console.log("UI POLISH "+name+" PASS: preflight, cancel/continue, dark glass picker, native select events");
 }finally{await context.close();}
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  await inspect(browser,"desktop",{width:1280,height:800});
  await inspect(browser,"mobile",{width:390,height:844});
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
