"use strict";
const fs=require("node:fs");
const Vision=require("../netlify/functions/aksara-vision-diagnostics");
const V5=require("../netlify/functions/aksara-intelligence-v5");
function run(){
 const tests=[],check=(name,pass)=>tests.push({name,pass:!!pass});
 const media=[{mimeType:"image/png"},{mimeType:"application/pdf"}];
 const vision=Vision.inspect({media,provider:"gemini",reply:"Response"});
 const report=V5.multimodalAudit({media,vision});
 check("Vision reply is not visual proof",vision.actualImageUnderstandingConfirmed===false);
 check("Count without private bytes",report.images===1&&report.pdfs===1);
 check("OCR requires permission",report.ocrRequiresConsent===true);
 check("Android manual gate",report.deviceValidation==="android_manual_qa_required");
 const pdf=fs.readFileSync("bilik-antara-pdf-reader.js","utf8"),attach=fs.readFileSync("bilik-antara-attachments.js","utf8");
 check("PDF consent gate",pdf.includes("if(!allowed)throw Error")&&attach.includes('window.confirm("PDF imbasan'));
 check("Tesseract default ESM export",pdf.includes("module.default?.createWorker"));
 check("PDF.js compatibility",pdf.includes("Map.prototype.getOrInsertComputed"));
 return {suite:"AKSARA-V5-MULTIMODAL",mode:"offline-contract-only",tests,
  passed:tests.filter(x=>x.pass).length,failed:tests.filter(x=>!x.pass).length,
  pending:["Android OCR on real scanned PDF","Real screenshot visual accuracy","Real metadata validation"]};
}
if(require.main===module){const r=run();console.log(JSON.stringify(r,null,2));if(r.failed)process.exitCode=1;}
module.exports={run};