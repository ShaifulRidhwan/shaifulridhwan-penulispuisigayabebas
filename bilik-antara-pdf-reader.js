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
 root.AksaraPdfReader=Object.freeze({read,maxBytes:MAX_PDF_BYTES,maxPages:MAX_PAGES});
})(window);
