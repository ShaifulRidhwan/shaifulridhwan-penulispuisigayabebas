"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {chromium}=require("playwright");
const {PDFDocument}=require("pdf-lib");
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:900,height:400}});
  page.on("pageerror",e=>console.log("Browser console:",e.message.slice(0,190)));
  await page.setContent('<!doctype html><html><body style="margin:0;background:white;padding:50px;font:900 70px Arial,sans-serif;color:black"><div>AKSARA OCR TEST</div><div>2026 V4</div></body></html>');
  const image=await page.screenshot({type:"png"});
  const doc=await PDFDocument.create();
  const p=doc.addPage([900,400]);const embedded=await doc.embedPng(image);
  p.drawImage(embedded,{x:0,y:0,width:900,height:400});
  const pdf=await doc.save();
  await page.goto("https://shaifulridhwan-penulispuisigayabebas.netlify.app/index.html",{waitUntil:"domcontentloaded",timeout:30000});
  await page.addScriptTag({content:fs.readFileSync("bilik-antara-pdf-reader.js","utf8")});
  const out=await page.evaluate(async payload=>{
   const bytes=Uint8Array.from(atob(payload),c=>c.charCodeAt(0));
   const file=new File([bytes],"aksara-scanned-test.pdf",{type:"application/pdf"});
   const baseline=await window.AksaraPdfReader.read(file);
   let denied=false;
   try{await window.AksaraPdfReader.readOcr(file,{allowed:false});}
   catch(error){denied=/izin pengguna/i.test(String(error.message));}
   if(!denied)throw new Error("OCR consent gate did not deny default request");
   const ocr=await window.AksaraPdfReader.readOcr(file,{allowed:true,maxPages:1});
   return {baselineTextChars:baseline.text.length,ocrText:ocr.text,
     scannedPages:ocr.scannedPages,sourcePages:ocr.pages,method:ocr.method};
  },Buffer.from(pdf).toString("base64"));
  assert.equal(out.baselineTextChars,0,"Scanned PDF should have no extractable text");
  assert.equal(out.scannedPages,1);
  assert.match(out.ocrText,/AKSARA/i,"OCR must read the image-based text");
  console.log("PASS OCR actual scanned PDF in production-origin browser",JSON.stringify({
    baselineTextChars:out.baselineTextChars,ocrSnippet:out.ocrText.slice(0,130),
    pages:out.scannedPages,method:out.method}));
 }finally{await browser.close();}
})().catch(error=>{console.error("FAIL OCR live browser",error);process.exitCode=1});
