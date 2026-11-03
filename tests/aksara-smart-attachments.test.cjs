"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
test("smart attachment UI has five explicit types and capture actions",()=>{
 const html=read("bilik-antara.html");
 for(const kind of ["photo","video","document","audio","code"])assert.ok(html.includes('data-attachment-type="'+kind+'"'),kind);
 assert.equal((html.match(/data-attachment-type="/g)||[]).length,5);
 for(const id of ["attachmentCamera","attachmentAudio","attachmentCode","attachmentTray",
   "attachmentCameraAction","attachmentRecordAction","attachmentRecordStop"])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(html.includes('capture="environment"'));
});
test("large text and Netlify-safe media caps agree between client and server",()=>{
 const html=read("bilik-antara.html"),client=read("bilik-antara-attachments.js"),handler=read("netlify/functions/bilik-antara.js");
 const sanitizer=read("netlify/functions/antara-intelligence.js");
 assert.ok(client.includes("MAX_MEDIA_BYTES=3850000"));
 assert.ok(client.includes("MAX_TEXT_BYTES=2000000,MAX_TEXT_CHARS=1000000"));
 assert.ok(html.includes("requestBytes>5350000"));
 assert.ok(handler.includes("const MAX_BODY=5500000"));
 assert.ok(handler.includes("const MAX_MEDIA_ENCODED=5200000"));
 assert.ok(handler.includes('documentText.length>1000000'));
 assert.ok(sanitizer.includes("encoded.length>5200000"));
 assert.ok(sanitizer.includes("rawBytes>3850000"));
});
test("attachment previews, removal, compression and code bridge are explicit and local",()=>{
 const html=read("bilik-antara.html"),client=read("bilik-antara-attachments.js"),workspace=read("bilik-antara-code-workspace.js");
 assert.ok(client.includes("URL.revokeObjectURL"));
 assert.ok(client.includes("renderAttachmentTray()"));
 assert.ok(client.includes("compressImageForChat"));
 assert.ok(client.includes("navigator.mediaDevices.getUserMedia"));
 assert.ok(client.includes("micStream?.getTracks().forEach(t=>t.stop())"));
 assert.ok(client.includes("workspace.importFiles(files)"));
 assert.ok(workspace.includes("async function importFiles(selected)"));
 assert.ok(workspace.includes("importFiles});"));
 assert.ok(workspace.includes("if(!dialog.open)dialog.showModal()"));
 assert.doesNotMatch(workspace,/importFiles\(selected\)[\s\S]{0,850}engine\.run/);
});
test("browser source scripts parse",()=>{
 const html=read("bilik-antara.html");
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
  if(!match[2].trim()||/application\/ld\+json|importmap/.test(match[1]))continue;
  assert.doesNotThrow(()=>new vm.Script(match[2]));
 }
 assert.doesNotThrow(()=>new vm.Script(read("bilik-antara-code-workspace.js")));
 assert.doesNotThrow(()=>new vm.Script(read("bilik-antara-attachments.js")));
 assert.doesNotThrow(()=>new vm.Script(read("bilik-antara-pdf-reader.js")));
});

test("PDF text reader and compact composer protect user consent",()=>{
 const html=read("bilik-antara.html"),client=read("bilik-antara-attachments.js");
 const reader=read("bilik-antara-pdf-reader.js"),css=read("bilik-antara-attachments.css");
 const backend=read("netlify/functions/bilik-antara.js");
 assert.ok(html.includes('bilik-antara-pdf-reader.js?v=3'));
 assert.ok(html.includes('bilik-antara-attachments.js?v=4'));
 assert.ok(html.includes('bilik-antara-attachments.css?v=2'));
 assert.ok(html.includes('class="attachment-preview-row"'));
 assert.ok(html.length<80000,"Bilik Antara HTML must remain below the performance budget");
 assert.ok(client.includes('window.AksaraPdfReader.read(file)'));
 assert.ok(client.includes('if(item){'));
 assert.ok(client.includes('ui.remove.hidden=stagedFiles.length<2'));
 assert.ok(client.includes('ui.docStatus.dataset.state=note?"warning":"ready"'));
 assert.ok(client.includes('kind:"text"'));
 assert.ok(reader.includes('pdfjs-dist@6.4.299/build/pdf.mjs'));
 assert.ok(reader.includes('pdfjs-dist@6.4.299/build/pdf.worker.mjs'));
 assert.ok(reader.includes('isEvalSupported:false'));
 assert.ok(reader.includes('await page.getTextContent('));
 assert.ok(css.includes('#docStatus[data-state="ready"]'));
 assert.ok(backend.includes('const textOnly=media.length===0'));
 assert.ok(backend.includes('payload.contextFallback===true'));
});
