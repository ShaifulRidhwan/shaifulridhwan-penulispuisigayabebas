/* AKSARA Smart Attachments v1. Lazy-loaded: private, in-tab media preparation only. */
(function(root){
"use strict";
function init({ui,MEDIA,attachmentDialog,attachmentTrigger,attachmentClose,attachmentInputs,getBusy,setFileState,update}){
 const el=id=>document.getElementById(id);
 const elem=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=String(value);return n;};
 let fileState=null;
 attachmentTrigger.addEventListener("click",()=>{if(!getBusy()){attachmentDialog.showModal();attachmentTrigger.setAttribute("aria-expanded","true");}});
attachmentClose.addEventListener("click",()=>attachmentDialog.close());
attachmentDialog.addEventListener("click",event=>{if(event.target===attachmentDialog)attachmentDialog.close();});
attachmentDialog.addEventListener("close",()=>{
 if(micRecorder?.state==="recording")stopMicrophone(true);
 attachmentTrigger.setAttribute("aria-expanded","false");
 attachmentTrigger.focus({preventScroll:true});
});
const recordStatus=el("attachmentRecordStatus"),recordButton=el("attachmentRecordAction"),recordStop=el("attachmentRecordStop");
let micRecorder=null,micStream=null,micTimer=0,micParts=[],micCancelled=false;
function stopMicrophone(discard=false){
 if(!micRecorder||micRecorder.state==="inactive")return;
 if(discard)micCancelled=true;
 clearTimeout(micTimer);micTimer=0;
 micRecorder.stop();
 recordStop.hidden=true;recordButton.disabled=false;
 recordStatus.textContent=discard?"Rakaman dibatalkan.":"Memproses rakaman setempat…";
}
recordButton.addEventListener("click",async()=>{
 if(getBusy()||micRecorder?.state==="recording")return;
 if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined"){
  recordStatus.textContent="Rakaman tidak tersedia dalam browser ini. Pilih fail Audio sebagai alternatif.";return;
 }
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
  if(!attachmentDialog.open||getBusy()){stream.getTracks().forEach(t=>t.stop());return;}
  micStream=stream;micParts=[];micCancelled=false;
  const formats=["audio/webm;codecs=opus","audio/webm","audio/mp4","audio/ogg"];
  const format=formats.find(t=>MediaRecorder.isTypeSupported(t));
  micRecorder=new MediaRecorder(stream,format?{mimeType:format}:{});
  micRecorder.ondataavailable=e=>{if(e.data?.size)micParts.push(e.data);};
  micRecorder.onerror=()=>{micCancelled=true;recordStatus.textContent="Rakaman gagal. Cuba muat naik fail Audio.";};
  micRecorder.onstop=async()=>{
   clearTimeout(micTimer);micTimer=0;
   micStream?.getTracks().forEach(t=>t.stop());micStream=null;
   recordStop.hidden=true;recordButton.disabled=false;
   const parts=micParts,cancelled=micCancelled,format=micRecorder?.mimeType||"audio/webm";
   micRecorder=null;micParts=[];
   if(cancelled)return;
   const type=format.split(";")[0];
   if(!MEDIA.has(type)){recordStatus.textContent="Format rakaman tidak disokong: "+type;return;}
   const blob=new Blob(parts,{type});
   if(!blob.size){recordStatus.textContent="Rakaman kosong.";return;}
   const ext=type==="audio/mp4"?"m4a":type==="audio/ogg"?"ogg":"webm";
   const file=new File([blob],"aksara-rakaman-"+Date.now()+"."+ext,{type});
   attachmentDialog.close();
   queueAttachmentFiles([file]);
  };
  micRecorder.start(500);
  recordButton.disabled=true;recordStop.hidden=false;
  recordStatus.textContent="Mikrofon aktif. Tekan Henti rakaman untuk lampirkan (maksimum 60 saat).";
  micTimer=setTimeout(()=>stopMicrophone(false),60000);
 }catch(error){
  micStream?.getTracks().forEach(t=>t.stop());micStream=null;
  recordButton.disabled=false;recordStop.hidden=true;
  recordStatus.textContent="Izin mikrofon ditolak atau browser tak menyokong rakaman.";
 }
});
recordStop.addEventListener("click",()=>stopMicrophone(false));
el("attachmentCameraAction").addEventListener("click",()=>{
 if(getBusy())return;
 attachmentDialog.close();attachmentInputs.camera.click();
});
for(const option of attachmentDialog.querySelectorAll("[data-attachment-type]")){
 option.addEventListener("click",()=>{
  if(getBusy())return;
  const kind=option.dataset.attachmentType,field=attachmentInputs[kind];
  if(!field)return;attachmentDialog.close();field.click();
 });
}
for(const [kind,field] of Object.entries(attachmentInputs)){
 field.addEventListener("change",async()=>{
  const files=Array.from(field.files||[]);field.value="";
  if(!files.length)return;
  if(kind==="code"){
   try{
    const workspace=window.AksaraCodeWorkspace;
    if(!workspace?.importFiles)throw Error("Code Workspace belum tersedia. Cuba segarkan halaman.");
    await workspace.importFiles(files);
    ui.docStatus.dataset.state="warning";
    ui.docStatus.textContent="Fail kod dibuka dalam Code Workspace; tidak dihantar kepada A.I.";
   }catch(e){ui.docStatus.dataset.state="warning";ui.docStatus.textContent="Import kod gagal: "+String(e.message||e).slice(0,160);}
  }else queueAttachmentFiles(files);
 });
}

 /* Attachment limits reflect Netlify's 6 MB platform request ceiling.
 * The 3.85 MB media budget permits Base64 + normal JSON overhead.
 * Files and media only exist in this tab, and nothing uploads before Send. */
const MAX_MEDIA_BYTES=3850000,MAX_TEXT_BYTES=2000000,MAX_TEXT_CHARS=1000000;
const MAX_ATTACHMENT_FILES=12;
let stagedFiles=[],attachmentEpoch=0,attachmentQueue=Promise.resolve();
function observeAttachment(phase,failed=0){
 // No file names, content, media, transcripts or bytes in this event.
 root.dispatchEvent(new CustomEvent("ba:attachment-stage",{detail:{
  phase,count:stagedFiles.length,failed,
  pdfPages:stagedFiles.reduce((sum,f)=>sum+(Number(f.pdfPages)||0),0)
 }}));
}
const attachmentTray=el("attachmentTray");
const bytesLabel=n=>n<1000000?Math.round(n/1000)+" KB":(n/1000000).toFixed(2)+" MB";
const validMediaExtensions={
 pdf:"application/pdf",mp3:"audio/mpeg",m4a:"audio/mp4",wav:"audio/wav",ogg:"audio/ogg",
 webm:"video/webm",mp4:"video/mp4",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",
 gif:"image/gif",webp:"image/webp"
};
const imageMime=new Set(["image/jpeg","image/png","image/webp"]);
async function imageDimensions(file){
 if(typeof createImageBitmap!=="function")return null;
 let bitmap=null;
 try{
  bitmap=await createImageBitmap(file);
  return {width:bitmap.width,height:bitmap.height};
 }catch(_){return null;}
 finally{bitmap?.close?.();}
}
function cleanupStaged(items){
 for(const item of items)if(item.previewURL)URL.revokeObjectURL(item.previewURL);
}
function renderAttachmentTray(){
 attachmentTray.replaceChildren();attachmentTray.hidden=!stagedFiles.length;
 for(const [index,item] of stagedFiles.entries()){
  const chip=elem("div","attachment-chip");
  const thumbnail=elem("div","attachment-chip-preview");
  if(item.previewURL&&(item.mimeType||"").startsWith("image/")){
   const image=document.createElement("img");
   image.src=item.previewURL;image.alt="Pratonton "+item.name;image.loading="lazy";thumbnail.append(image);
  }else if(item.previewURL&&(item.mimeType||"").startsWith("video/")){
   const video=document.createElement("video");
   video.src=item.previewURL;video.muted=true;video.preload="metadata";
   video.setAttribute("aria-label","Pratonton video "+item.name);thumbnail.append(video);
  }else thumbnail.textContent=item.kind==="text"?"DOC":
   (item.mimeType||"").startsWith("audio/")?"AUDIO":
   item.mimeType==="application/pdf"?"PDF":"FILE";
  const details=elem("div","attachment-chip-info");
  const name=elem("span","attachment-chip-name",item.name);
  name.title=item.name;
  details.append(name,elem("span","attachment-chip-size",bytesLabel(item.size)+
   (item.uploadSize&&item.uploadSize<item.size?" → "+bytesLabel(item.uploadSize):"")+
   (item.pdfPages?" · "+item.pdfPages+" hlm · teks":"")+
   (item.metadata?.width?" · "+item.metadata.width+"×"+item.metadata.height+" px":"")));
  const remove=document.createElement("button");remove.type="button";
  remove.className="attachment-chip-remove";remove.textContent="×";
  remove.setAttribute("aria-label","Buang "+item.name);remove.disabled=getBusy();
  remove.addEventListener("click",()=>{
   if(getBusy())return;
   const selected=stagedFiles[index];if(!selected)return;
   cleanupStaged([selected]);stagedFiles.splice(index,1);rebuildFileState();
  });
  chip.append(thumbnail,details,remove);attachmentTray.append(chip);
 }
}
function rebuildFileState(note=""){
 if(!stagedFiles.length)fileState=null;
 else{
  const texts=stagedFiles.filter(f=>f.kind==="text").map(f=>"[FAIL: "+f.name+"]\n"+f.text);
  fileState={name:stagedFiles.map(f=>f.name).join(", ").slice(0,240),
   text:texts.join("\n\n"),media:stagedFiles.filter(f=>f.kind==="media").map(f=>f.media),
   metadata:stagedFiles.map(f=>({...f.metadata}))};
 }
 // The chip already displays the file name and size; screen readers still get the status.
 ui.docStatus.dataset.state=note?"warning":"ready";
 ui.docStatus.textContent=note||(stagedFiles.length?
   stagedFiles.length+" fail sedia: "+stagedFiles.map(f=>f.name).join(", ").slice(0,160):"");
 ui.remove.hidden=stagedFiles.length<2;
 setFileState(fileState);
 renderAttachmentTray();update();
 observeAttachment(note?"separa":stagedFiles.length?"sedia":"kosong");
}
function discardFile(){
 attachmentEpoch++;
 cleanupStaged(stagedFiles);stagedFiles=[];fileState=null;setFileState(null);
 ui.upload.value="";
 for(const field of Object.values(attachmentInputs))field.value="";
 ui.docStatus.textContent="";ui.docStatus.dataset.state="ready";ui.remove.hidden=true;
 renderAttachmentTray();update();observeAttachment("kosong");
}
async function compressImageForChat(file,targetBytes){
 if(file.size<=targetBytes&&file.size<=1100000)return file;
 const bitmap=await createImageBitmap(file);
 try{
  let smallest=null;
  for(const maxSide of [2200,1700,1300,950]){
   const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
   const canvas=document.createElement("canvas");
   canvas.width=Math.max(1,Math.round(bitmap.width*scale));
   canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const ctx=canvas.getContext("2d");
   if(!ctx)throw Error("Browser tidak dapat sediakan canvas imej.");
   ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
   for(const quality of [0.85,0.7,0.55]){
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",quality));
    if(!blob)throw Error("Browser gagal memampatkan gambar.");
    if(!smallest||blob.size<smallest.size)smallest=blob;
    if(blob.size<=targetBytes)return blob;
   }
  }
  if(smallest&&smallest.size<=targetBytes)return smallest;
  throw Error("Imej terlalu besar walaupun sudah dimampatkan. Cuba gambar yang lebih kecil.");
 }finally{bitmap.close?.();}
}
async function blobToBase64(blob){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result||"").split(",")[1]||"");
  reader.onerror=()=>reject(Error("Gagal membaca media dalam browser."));
  reader.readAsDataURL(blob);
 });
}
function queueAttachmentFiles(files){
 const captured=Array.from(files||[]),epoch=attachmentEpoch;
 if(!captured.length)return;
 observeAttachment("dipilih");
 attachmentQueue=attachmentQueue.catch(()=>{}).then(()=>readFiles(captured,epoch));
}
async function readFiles(files,epoch=attachmentEpoch){
 if(getBusy()||epoch!==attachmentEpoch||!files?.length)return;
 observeAttachment("membaca");
 const added=[],errors=[];
 const knownNames=new Set(stagedFiles.map(f=>f.name.toLowerCase()));
 let mediaBytes=stagedFiles.filter(x=>x.kind==="media").reduce((sum,x)=>sum+x.uploadSize,0);
 let textChars=stagedFiles.filter(x=>x.kind==="text").reduce((sum,x)=>sum+("[FAIL: "+x.name+"]\n"+x.text).length+2,0);
 for(const file of files){
  let item=null,pdfWarning="";
  try{
   const name=String(file.name||"fail").slice(0,100);
   const ext=(name.split(".").pop()||"").toLowerCase();
   if(knownNames.has(name.toLowerCase()))throw Error("Fail dengan nama sama sudah dipilih.");
   if(stagedFiles.length+added.length>=MAX_ATTACHMENT_FILES)throw Error("Maksimum 12 lampiran bagi satu mesej.");
   if(!file.size)throw Error("Fail kosong tidak diterima.");
   if(ext==="pdf"){
    if(!window.AksaraPdfReader?.read)throw Error("Pembaca PDF belum tersedia. Segarkan halaman.");
    try{
     const parsed=await window.AksaraPdfReader.read(file);
     if(parsed.text){
      const newChars=("[FAIL: "+name+"]\n"+parsed.text).length;
      if(textChars+newChars>MAX_TEXT_CHARS)throw Error("Teks PDF melebihi 1 juta aksara bagi satu mesej. Bahagikan dokumen.");
      item={name,size:file.size,uploadSize:0,kind:"text",
       text:parsed.text,mimeType:"application/pdf",pdfPages:parsed.pages};
      textChars+=newChars+2;
      if(parsed.truncated)pdfWarning=name+": hanya sebahagian teks PDF dibaca. Fail asal tidak dihantar.";
     }else pdfWarning=name+": PDF ini tiada teks boleh dibaca (mungkin imbasan). Model multimodal diperlukan.";
    }catch(error){
     if(/melebihi|lebih 250|Bahagikan|kata laluan|password/i.test(String(error.message||"")))
      throw error;
     pdfWarning=name+": teks PDF tak dapat diekstrak. Fail asal memerlukan model multimodal.";
    }
    if(!item&&file.size>MAX_MEDIA_BYTES)
     throw Error("PDF tanpa teks yang boleh diekstrak melebihi had media 3.85 MB.");
   }
   if(item){
    // PDF text travels in documentText, never as a binary multimodal upload.
   }else if(["txt","md","csv","json","docx"].includes(ext)){
    if(file.size>MAX_TEXT_BYTES)throw Error("Had setiap fail dokumen ialah 2 MB. Pecahkan teks besar kepada beberapa fail.");
    if(ext==="docx"&&!window.AksaraDocx)throw Error("Pembaca DOCX belum tersedia.");
    const content=ext==="docx"?await window.AksaraDocx.read(file):await file.text();
    const newChars=("[FAIL: "+name+"]\n"+content).length;
    if(textChars+newChars>MAX_TEXT_CHARS)throw Error("Jumlah kandungan teks melebihi 1 juta aksara untuk satu mesej.");
    item={name,size:file.size,uploadSize:file.size,kind:"text",text:content,mimeType:"text/plain"};
    textChars+=newChars+2;
   }else{
    const aliases={"audio/x-wav":"audio/wav","audio/wave":"audio/wav","audio/x-m4a":"audio/mp4"};
    let mime=aliases[file.type]||file.type||validMediaExtensions[ext]||"";
    if(ext==="pdf")mime="application/pdf";
    if(ext==="m4a")mime="audio/mp4";
    if(ext==="mp3")mime="audio/mpeg";
    if(ext==="wav")mime="audio/wav";
    if(ext==="ogg")mime="audio/ogg";
    if(!MEDIA.has(mime))throw Error("Format media belum disokong. Pilih PDF, gambar, audio atau video yang sah.");
    // Source photos up to 32 MB can be resized locally, without paying an API.
    if(file.size>MAX_MEDIA_BYTES&&(!imageMime.has(mime)||file.size>32000000))
     throw Error("Media ini melebihi had penghantaran terus. Gambar sehingga 32 MB boleh cuba dimampatkan.");
    let blob=file;
    if(imageMime.has(mime)&&(file.size>1100000||mediaBytes+file.size>MAX_MEDIA_BYTES)){
     const remaining=Math.min(1650000,MAX_MEDIA_BYTES-mediaBytes);
     if(remaining<30000)throw Error("Ruang media hampir penuh. Buang fail lain dahulu.");
     blob=await compressImageForChat(file,remaining);
     mime=blob.type||"image/webp";
    }
    if(mediaBytes+blob.size>MAX_MEDIA_BYTES)throw Error("Jumlah media melebihi 3.85 MB selepas pemampatan; ini had Netlify untuk request terus.");
    const data=await blobToBase64(blob);
    if(!data)throw Error("Gagal mengekod media.");
    item={name,size:file.size,uploadSize:blob.size,kind:"media",mimeType:mime,pdfWarning,
     media:{name,mimeType:mime,data},
     previewURL:(mime.startsWith("image/")||mime.startsWith("video/"))?URL.createObjectURL(blob):null};
    mediaBytes+=blob.size;
   }
   if(pdfWarning&&!item.pdfWarning)item.pdfWarning=pdfWarning;
   // File name, MIME, original byte size and last-modified timestamp are browser File metadata.
   // Never extract EXIF GPS, device identifiers or camera serials, and never upload these
   // values merely because the user selected a file.
   const fileMeta={name,bytes:file.size,mimeType:file.type||item.mimeType||"application/octet-stream",
    lastModified:Number(file.lastModified)||0};
   if(item.pdfPages)fileMeta.pages=Number(item.pdfPages);
   if(item.kind==="media"&&/^image\//.test(item.mimeType)){
    const dimensions=await imageDimensions(file);
    if(dimensions)Object.assign(fileMeta,dimensions);
   }
   item.metadata=fileMeta;
   added.push(item);knownNames.add(name.toLowerCase());
  }catch(error){if(item?.previewURL)URL.revokeObjectURL(item.previewURL);
   errors.push(String(file.name||"Fail")+": "+String(error.message||error).slice(0,150));}
 }
 if(epoch!==attachmentEpoch){cleanupStaged(added);return;}
 if(added.length)stagedFiles.push(...added);
 const warning=added.find(f=>f.pdfWarning)?.pdfWarning||"";
 const report=errors.length?"Tidak dimuat: "+errors.slice(0,2).join(" · ")+(errors.length>2?" ("+errors.length+" ralat)":""):warning;
 rebuildFileState(report||"");
 observeAttachment(errors.length?"separa":warning?"separa":stagedFiles.length?"sedia":"gagal",errors.length);
}
ui.upload.addEventListener("change",()=>{
 const files=Array.from(ui.upload.files||[]);ui.upload.value="";queueAttachmentFiles(files);
});
ui.remove.addEventListener("click",discardFile);

 window.addEventListener("pagehide",()=>{stopMicrophone(true);cleanupStaged(stagedFiles);});
 return Object.freeze({clear:discardFile,count:()=>stagedFiles.length});
}
root.AksaraSmartAttachments=Object.freeze({init});
root.dispatchEvent(new Event("aksara:attachments-ready"));
})(window);
