(function(){
"use strict";
/* Studio Antara cloud image experience. No GPU model or heavy runtime in browser. */
const $=id=>document.getElementById(id);
const form=$("imageForm");
if(!form)return;
const ui={
 prompt:$("imagePrompt"),count:$("promptCount"),steps:$("qualitySteps"),seed:$("imageSeed"),
 go:$("generateImage"),stop:$("stopImage"),status:$("generationStatus"),
 result:$("generatedImage"),empty:$("resultEmpty"),loading:$("stageLoading"),
 indicator:$("resultIndicator"),meta:$("imageMetadata"),download:$("downloadImage"),
 imageTab:$("tabImage"),videoTab:$("tabVideo"),imagePane:$("imageStudio"),videoPane:$("videoStudio")
};
const originalButton=ui.go.innerHTML;
let style="cinematic",busy=false,controller=null,imageUrl=null;
function announce(message,error=false){
 ui.status.textContent=message;
 ui.status.classList.toggle("is-error",error);
}
function switchMode(mode){
 const image=mode==="image";
 ui.imagePane.hidden=!image;ui.videoPane.hidden=image;
 ui.imageTab.classList.toggle("is-active",image);
 ui.videoTab.classList.toggle("is-active",!image);
 ui.imageTab.setAttribute("aria-selected",String(image));
 ui.videoTab.setAttribute("aria-selected",String(!image));
}
ui.imageTab.addEventListener("click",()=>switchMode("image"));
ui.videoTab.addEventListener("click",()=>switchMode("video"));
document.querySelectorAll("[data-style]").forEach(button=>{
 button.addEventListener("click",()=>{
  if(busy)return;
  style=button.dataset.style;
  document.querySelectorAll("[data-style]").forEach(item=>{
    const selected=item===button;
    item.classList.toggle("is-selected",selected);
    item.setAttribute("aria-pressed",String(selected));
  });
 });
});
document.querySelectorAll("[data-prompt]").forEach(button=>{
 button.addEventListener("click",()=>{
  if(busy)return;
  ui.prompt.value=button.dataset.prompt.slice(0,1200);
  ui.prompt.dispatchEvent(new Event("input",{bubbles:true}));
  ui.prompt.focus();
 });
});
ui.prompt.addEventListener("input",()=>{
 ui.count.textContent=ui.prompt.value.length+" / 1200";
});
ui.prompt.addEventListener("keydown",event=>{
 if((event.ctrlKey||event.metaKey)&&event.key==="Enter"){
  event.preventDefault();form.requestSubmit();
 }
});
ui.stop.addEventListener("click",()=>{
 if(controller)controller.abort();
});
function imageBlob(encoded,mime){
 if(typeof encoded!=="string"||encoded.length>4_700_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
   throw new Error("Data imej daripada pelayan tidak sah.");
 const segments=[];
 for(let i=0;i<encoded.length;i+=32768){
   const binary=atob(encoded.slice(i,i+32768));
   const buffer=new Uint8Array(binary.length);
   for(let j=0;j<binary.length;j++)buffer[j]=binary.charCodeAt(j);
   segments.push(buffer);
 }
 const blob=new Blob(segments,{type:mime==="image/png"?"image/png":"image/jpeg"});
 if(blob.size<100||blob.size>3_500_000)throw new Error("Imej melebihi saiz yang disokong.");
 return blob;
}
function setBusy(value){
 busy=value;
 ui.go.disabled=value;
 ui.go.innerHTML=value?"<span aria-hidden='true'>✦</span> Sedang menjana...":originalButton;
 ui.stop.hidden=!value;
 ui.prompt.disabled=value;
 document.querySelectorAll("[data-style], [data-prompt]").forEach(button=>{button.disabled=value;});
 ui.loading.hidden=!value;
 ui.indicator.textContent=value?"MENJANA":(imageUrl?"SIAP":"MENUNGGU");
}
async function preview(blob,prompt,steps){
 const url=URL.createObjectURL(blob);
 const image=new Image();
 image.decoding="async";
 image.src=url;
 try{await image.decode();}catch(error){URL.revokeObjectURL(url);throw new Error("Pelayar gagal memaparkan imej yang dijana.");}
 if(imageUrl)URL.revokeObjectURL(imageUrl);
 imageUrl=url;
 ui.result.src=url;
 ui.result.alt="Imej AI hasil arahan: "+prompt.slice(0,160);
 ui.result.hidden=false;
 ui.empty.hidden=true;
 ui.meta.textContent="FLUX.1 SCHNELL · "+steps+" LANGKAH · "+(blob.type==="image/png"?"PNG":"JPEG");
 ui.download.href=url;
 ui.download.download="studio-antara-"+Date.now()+"."+(blob.type==="image/png"?"png":"jpg");
 ui.download.hidden=false;
}
form.addEventListener("submit",async event=>{
 event.preventDefault();
 if(busy)return;
 const prompt=ui.prompt.value.trim();
 if(prompt.length<4||prompt.length>1200){
  announce("Tulis arahan imej antara 4 hingga 1200 aksara.",true);
  ui.prompt.focus();return;
 }
 const seedText=ui.seed.value.trim();
 const seed=seedText===""?null:Number(seedText);
 if(seed!==null&&(!Number.isSafeInteger(seed)||seed<0||seed>2147483647)){
  announce("Seed perlu nombor bulat antara 0 hingga 2147483647.",true);return;
 }
 const steps=Number(ui.steps.value);
 if(steps!==4&&steps!==8){announce("Kualiti imej tidak sah.",true);return;}
 controller=new AbortController();
 setBusy(true);
 announce("Sedang meminta imej sebenar daripada Cloudflare. Permintaan ini menggunakan kuota Workers AI.");
 const started=Date.now();
 try{
  const response=await fetch("/.netlify/functions/studio-image",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({prompt,style,steps,seed}),
    signal:controller.signal
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||"Penjanaan imej gagal. Cuba semula.");
  if(!data.ok||!data.image)throw new Error("Cloudflare tidak memulangkan imej.");
  const blob=imageBlob(data.image,data.mime);
  await preview(blob,prompt,steps);
  announce("Imej sebenar berjaya dijana dalam "+Math.max(1,Math.round((Date.now()-started)/1000))+" saat. Kau boleh simpan hasilnya.");
 }catch(error){
  if(error?.name==="AbortError"){
   announce("Permintaan dihentikan. Cloudflare mungkin masih menggunakan kuota untuk permintaan yang sudah dihantar.",true);
  }else{
   announce(String(error?.message||"Penjanaan gagal.").slice(0,260),true);
  }
 }finally{
  controller=null;
  setBusy(false);
 }
});
window.addEventListener("pagehide",()=>{if(imageUrl)URL.revokeObjectURL(imageUrl);});
})();
