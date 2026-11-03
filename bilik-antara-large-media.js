/* AKSARA large-media preparation: source files stay in the browser.
 * Only sampled visual frames (not the full video or its audio) can go to the AI.
 */
(function(root){
"use strict";
const MAX_IMAGE_SOURCE_BYTES=64000000;
const MAX_VIDEO_SOURCE_BYTES=128000000;
const MAX_FRAME_COUNT=4;
const MAX_FRAME_BUDGET=1650000;
const TIMEOUT_MS=15000;
function acceptedSource(type,bytes){
 const size=Number(bytes);
 if(!Number.isFinite(size)||size<=0)return false;
 if(/^image\/(?:jpeg|png|webp|gif)$/.test(type))return size<=MAX_IMAGE_SOURCE_BYTES;
 if(/^video\/(?:mp4|webm)$/.test(type))return size<=MAX_VIDEO_SOURCE_BYTES;
 return false;
}
function framePositions(duration){
 if(!Number.isFinite(duration)||duration<=0)return [];
 const ratios=duration<2?[0.25,0.75]:[0.1,0.38,0.66,0.9];
 return ratios.map(x=>Math.min(Math.max(0.01,duration*x),Math.max(0.01,duration-.02)));
}
function within(n,min,max){return Math.max(min,Math.min(max,n));}
function waitEvent(target,event,run,timeoutMs=TIMEOUT_MS){
 return new Promise((resolve,reject)=>{
  let done=false;
  const finish=(err)=>{if(done)return;done=true;clearTimeout(timer);
   target.removeEventListener(event,onReady);target.removeEventListener("error",onError);
   err?reject(err):resolve();};
  const onReady=()=>finish(),onError=()=>finish(Error("Browser tidak dapat membaca video ini."));
  const timer=setTimeout(()=>finish(Error("Penyahkodan video terlalu lama atau format tidak disokong.")),timeoutMs);
  target.addEventListener(event,onReady,{once:true});
  target.addEventListener("error",onError,{once:true});
  try{run?.();}catch(e){finish(e);}
 });
}
async function frameBlob(video,limitBytes){
 const canvas=document.createElement("canvas");
 const w=video.videoWidth,h=video.videoHeight;
 if(!w||!h)throw Error("Saiz bingkai video tidak dapat dibaca.");
 let smallest=null;
 for(const side of [960,720,560,400]){
  const scale=Math.min(1,side/Math.max(w,h));
  canvas.width=Math.max(1,Math.round(w*scale));
  canvas.height=Math.max(1,Math.round(h*scale));
  const ctx=canvas.getContext("2d");
  if(!ctx)throw Error("Canvas tidak tersedia untuk analisis video.");
  ctx.drawImage(video,0,0,canvas.width,canvas.height);
  for(const quality of [0.75,0.58,0.42]){
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));
   if(!blob)throw Error("Browser gagal menyediakan bingkai video.");
   if(!smallest||blob.size<smallest.size)smallest=blob;
   if(blob.size<=limitBytes)return blob;
  }
 }
 if(smallest&&smallest.size<=limitBytes)return smallest;
 throw Error("Bingkai video tidak dapat dimampatkan dalam had mesej.");
}
async function sampleVideo(file,{mimeType=file?.type,budget=MAX_FRAME_BUDGET,onProgress=()=>{},cancelled=()=>false}={}){
 if(!file||!acceptedSource(mimeType,file.size)||!mimeType.startsWith("video/"))
  throw Error("Video mesti MP4/WebM dan tidak melebihi 128 MB.");
 if(typeof document==="undefined"||typeof URL?.createObjectURL!=="function")
  throw Error("Penyediaan video memerlukan browser yang menyokong video dan canvas.");
 const maxBytes=within(Math.floor(Number(budget)||0),160000,MAX_FRAME_BUDGET);
 const localURL=URL.createObjectURL(file);
 const video=document.createElement("video");
 video.preload="auto";video.muted=true;video.playsInline=true;
 try{
  video.src=localURL;
  if(video.readyState<1)await waitEvent(video,"loadedmetadata",()=>video.load?.());
  if(cancelled())throw Error("Pemprosesan video dibatalkan.");
  const duration=video.duration,at=framePositions(duration);
  if(!at.length||!video.videoWidth||!video.videoHeight)
   throw Error("Tempoh atau resolusi video tidak disokong untuk analisis bingkai.");
  const frames=[];
  let totalBytes=0;
  for(const [index,second] of at.entries()){
   if(cancelled())throw Error("Pemprosesan video dibatalkan.");
   if(Math.abs(video.currentTime-second)>.06||video.readyState<2)
    await waitEvent(video,"seeked",()=>{video.currentTime=second;});
   const budgetLeft=maxBytes-totalBytes;
   const perFrame=Math.max(36000,Math.floor(budgetLeft/(at.length-index)));
   const blob=await frameBlob(video,perFrame);
   frames.push({blob,atSeconds:Math.round(second*10)/10,index:index+1});
   totalBytes+=blob.size;
   onProgress(Math.round(((index+1)/at.length)*100));
  }
  return {frames,durationSeconds:Math.round(duration*10)/10,
   visualOnly:true,audioAnalyzed:false,rawUploaded:false,totalBytes};
 }finally{
  video.pause?.();
  video.removeAttribute("src");
  video.load?.();
  URL.revokeObjectURL(localURL);
 }
}
const api=Object.freeze({MAX_IMAGE_SOURCE_BYTES,MAX_VIDEO_SOURCE_BYTES,
 MAX_FRAME_COUNT,MAX_FRAME_BUDGET,acceptedSource,framePositions,sampleVideo});
root.AksaraLargeMedia=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);