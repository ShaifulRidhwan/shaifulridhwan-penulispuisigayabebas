"use strict";
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.AUDIT_BASE||"http://127.0.0.1:4177";
function textPdf(){
 const stream="BT /F1 14 Tf 36 170 Td (AKSARA PDF TEXT VERIFIED) Tj ET";
 const objects=[
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 240] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  "<< /Length "+Buffer.byteLength(stream)+" >>\nstream\n"+stream+"\nendstream"
 ];
 let doc="%PDF-1.4\n",offsets=[0];
 objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(doc));doc+=(i+1)+" 0 obj\n"+obj+"\nendobj\n";});
 const xref=Buffer.byteLength(doc);
 doc+="xref\n0 "+(objects.length+1)+"\n0000000000 65535 f \n";
 for(const n of offsets.slice(1))doc+=String(n).padStart(10,"0")+" 00000 n \n";
 doc+="trailer\n<< /Size "+(objects.length+1)+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF";
 return Buffer.from(doc,"ascii");
}

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
  assert.match(await page.locator("#docStatus").innerText(),/1 fail sedia/);
  assert.equal(await page.locator("#attachmentTray").isVisible(),true);
  assert.equal(await page.locator("#removeAttachment").isVisible(),false,"One file already has its own remove button");
  assert.equal(await page.locator("#docStatus").evaluate(el=>getComputedStyle(el).clipPath),"inset(50%)","Ready status must not duplicate filename visually");
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
  // Real PDF.js smoke: verify actual on-demand extraction, not just a stub.
  await page.locator("#attachmentDocument").setInputFiles({name:"actual.pdf",mimeType:"application/pdf",buffer:textPdf()});
  await page.waitForFunction(()=>document.querySelector(".attachment-chip-name")?.textContent==="actual.pdf",{timeout:30000});
  await page.waitForFunction(()=>document.querySelector(".attachment-chip-size")?.textContent?.includes("hlm · teks")||document.querySelector("#docStatus")?.dataset.state==="warning",{timeout:40000});
  const parsedLabel=await page.locator(".attachment-chip-size").innerText();
  const pdfNotice=await page.locator("#docStatus").innerText();
  assert.match(parsedLabel,/1 hlm · teks/,"PDF.js must extract real text. "+pdfNotice);
  await page.locator('.attachment-chip-remove[aria-label="Buang actual.pdf"]').click();
  // Stub the browser-only extractor to test the deterministic file-routing path.
  await page.evaluate(()=>{
   window.AksaraPdfReader={read:async file=>({text:"Isi PDF yang boleh dibaca secara setempat. Halaman puisi.",pages:12,textPages:12,truncated:false})};
  });
  await page.locator("#attachmentDocument").setInputFiles({name:"trilogi.pdf",mimeType:"application/pdf",buffer:Buffer.alloc(569000,65)});
  await page.waitForFunction(()=>document.querySelector(".attachment-chip-name")?.textContent==="trilogi.pdf",{timeout:10000});
  assert.match(await page.locator(".attachment-chip-size").innerText(),/12 hlm · teks/);
  assert.equal(await page.locator("#docStatus").getAttribute("data-state"),"ready");
  assert.equal(await page.locator("#removeAttachment").isVisible(),false);
  await page.locator('.attachment-chip-remove[aria-label="Buang trilogi.pdf"]').click();
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
