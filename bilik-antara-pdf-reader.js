/* AKSARA PDF Reader: text extraction in browser; no PDF bytes leave the tab until Send.
 * PDF.js is downloaded on demand, not on initial page load.
 * Scanned-only PDFs return no text so caller may use existing multimodal path. */
(function(root){
 "use strict";
 const PDFJS_URL="https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/pdf.mjs";
 const WORKER_URL="https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/pdf.worker.mjs";
 const MAX_PDF_BYTES=25000000,MAX_PAGES=250,MAX_CHARS=950000;
 let loaded;
 function engine(){
  if(!loaded)loaded=import(PDFJS_URL).then(mod=>{
   if(typeof mod.getDocument!=="function")throw Error("Pembaca PDF tidak sah.");
   mod.GlobalWorkerOptions.workerSrc=WORKER_URL;
   return mod;
  }).catch(error=>{loaded=null;throw error;});
  return loaded;
 }
 async function read(file){
  if(!file||!file.size)throw Error("PDF kosong.");
  if(file.size>MAX_PDF_BYTES)throw Error("PDF melebihi had pembacaan setempat 25 MB.");
  const pdfjs=await engine();
  const task=pdfjs.getDocument({
   data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,
   useSystemFonts:true,enableXfa:false,stopAtErrors:false
  });
  let pdf;
  try{
   pdf=await task.promise;
   if(pdf.numPages>MAX_PAGES)throw Error("PDF mempunyai lebih 250 halaman. Bahagikan fail terlebih dahulu.");
   const parts=[];let count=0,truncated=false,textPages=0;
   for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
    const page=await pdf.getPage(pageNo);
    const content=await page.getTextContent({disableNormalization:false});
    let line="";
    for(const span of content.items||[]){
     if(typeof span.str!=="string")continue;
     const piece=span.str+(span.hasEOL?"\n":" ");
     if(count+line.length+piece.length>MAX_CHARS){truncated=true;break;}
     line+=piece;
    }
    const clean=line.trim();
    if(clean){
     parts.push("[Halaman "+pageNo+"]\n"+clean);
     count+=clean.length+24;textPages++;
    }
    page.cleanup();
    if(truncated)break;
   }
   const text=parts.join("\n\n").trim();
   if(!text)return {text:"",pages:pdf.numPages,textPages:0,truncated:false};
   return {text:text+(truncated?"\n\n[PERHATIAN: kandungan selebihnya dipotong kerana had bacaan 950,000 aksara.]":""),pages:pdf.numPages,textPages,truncated};
  }finally{
   // PDF.js 6.4 exposes destruction on the loading task. Using pdf.destroy()
   // can throw after a successful extraction and lose the extracted text.
   await task.destroy().catch(()=>{});
  }
 }
 // Explicit opt-in only. PDF.js rasterizes at most three pages locally;
 // Tesseract does not accept PDFs directly. Language assets load from CDN.
 const OCR_URL="https://cdn.jsdelivr.net/npm/tesseract.js@5.0.0/dist/tesseract.esm.min.js";
 async function readOcr(file,{allowed=false,maxPages=3,signal}={}){
  if(!allowed)throw Error("OCR memerlukan izin pengguna.");
  if(!file||!file.size||file.size>12000000)throw Error("OCR terhad kepada PDF sehingga 12 MB.");
  if(signal?.aborted)throw Error("OCR dibatalkan.");
  const pdfjs=await engine();
  const module=await import(OCR_URL);
  const createWorker=module.createWorker||module.default?.createWorker;
  if(typeof createWorker!=="function")throw Error("OCR engine tidak tersedia.");
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),
   isEvalSupported:false,enableXfa:false,stopAtErrors:false});
  let worker=null;
  try{
   const doc=await task.promise,limit=Math.min(doc.numPages,Math.max(1,Math.min(3,maxPages)));
   worker=await createWorker("eng");
   const sections=[];let characters=0;
   for(let i=1;i<=limit;i++){
    if(signal?.aborted)throw Error("OCR dibatalkan.");
    const page=await doc.getPage(i),viewport=page.getViewport({scale:1.3});
    const canvas=document.createElement("canvas");
    canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    if(canvas.width*canvas.height>6500000)throw Error("Resolusi halaman terlalu tinggi untuk OCR setempat.");
    const context=canvas.getContext("2d",{alpha:false});
    if(!context)throw Error("Canvas tidak disokong.");
    try{
     await page.render({canvasContext:context,viewport}).promise;
     const result=await worker.recognize(canvas);
     const text=String(result?.data?.text||"").trim().slice(0,30000);
     if(text){sections.push("[OCR Halaman "+i+"]\n"+text);characters+=text.length;}
    }finally{canvas.width=0;canvas.height=0;page.cleanup();}
    if(characters>85000)break;
   }
   return {text:sections.join("\n\n").slice(0,95000),pages:doc.numPages,
    scannedPages:limit,partial:doc.numPages>limit,method:"local_ocr_not_full_document"};
  }finally{
   if(worker)await worker.terminate().catch(()=>{});
   await task.destroy().catch(()=>{});
  }
 }
 root.AksaraPdfReader=Object.freeze({read,readOcr,maxBytes:MAX_PDF_BYTES,maxPages:MAX_PAGES});
})(window);
