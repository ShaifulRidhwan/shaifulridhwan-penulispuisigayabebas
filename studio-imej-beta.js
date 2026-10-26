(function(){
"use strict";
/* Studio Antara BETA: explicit consent allows cache-only download on mobile; GPU separately gated. */
const C=window.StudioImejConfig;
const $=id=>document.getElementById(id);
if(!C||!$("checkDevice"))return;
const ui={
 device:$("deviceStatus"),details:$("deviceDetails"),check:$("checkDevice"),copy:$("copyDiagnostic"),
 consent:$("modelConsent"),cache:$("cacheStatus"),checkCache:$("checkCache"),
 prefetch:$("prefetchModel"),background:$("backgroundModel"),cancel:$("cancelDownload"),
 clear:$("clearModel"),progress:$("modelProgress"),progressNote:$("modelProgressNote"),
 activate:$("activateModel"),gpu:$("gpuStatus"),gen:$("generateImage"),stop:$("stopImage"),
 img:$("generatedImage"),output:$("studioImageOutput"),placeholder:$("previewPlaceholder"),
 imgProgress:$("imageProgress"),imgNote:$("imageProgressNote"),download:$("downloadImage"),
 prompt:$("imagePrompt"),seed:$("imageSeed")
};
let mobile=false;
let diagnostic=null;
const D=window.StudioDeviceDiagnostics;
const storageNeeded=Math.ceil(C.modelBytes*1.4);
const cacheAvailable=Boolean(window.isSecureContext&&"caches" in window&&typeof caches.open==="function");
let checked=false,storageAllowed=false,gpuAllowed=false,completed=0,downloading=false,backgroundReg=null;
let controller=null,sdk=null,client=null,engine=null,ready=false,loading=false,generating=false,abortGenerate=null,blob=null,imageUrl=null;
const bytes=n=>Number.isFinite(n)?(n/(1024**3)).toFixed(2)+" GiB":"tidak diketahui";
function message(text){ui.device.textContent=String(text).slice(0,350);}
function cacheMsg(text){ui.cache.textContent=String(text).slice(0,350);}
function gpuMsg(text){ui.gpu.textContent=String(text).slice(0,350);}
function row(label,value){
 const node=document.createElement("div");node.className="device-row";
 const a=document.createElement("span"),b=document.createElement("strong");
 a.textContent=label;b.textContent=String(value);node.append(a,b);ui.details.appendChild(node);
}
function flags(){
 const consent=ui.consent.checked;
 ui.prefetch.disabled=!cacheAvailable||!consent||downloading||loading||generating||ready||completed===C.files.length;
 ui.background.disabled=!cacheAvailable||!consent||downloading||loading||ready||!backgroundSupported;
 ui.cancel.disabled=!downloading;
 ui.clear.disabled=downloading||loading||generating||ready||!completed;
 ui.activate.disabled=!gpuAllowed||!consent||completed!==C.files.length||downloading||loading||ready;
 ui.gen.disabled=!ready||loading||generating;
 ui.stop.disabled=!generating;
 ui.download.disabled=!blob;
}
let backgroundSupported=false,swRegistration=null;
async function cacheCounts(){
 if(!cacheAvailable){completed=0;cacheMsg("Cache Storage atau HTTPS tidak tersedia. Pelayar tidak boleh menyimpan model secara setempat.");flags();return 0;}
 try{
  const cache=await caches.open(C.cacheName);
  let n=0;
  for(const url of C.files){
   const response=await cache.match(url);
   if(response&&response.ok&&response.type!=="opaque")n++;
  }
  completed=n;
  cacheMsg(n+"/"+C.files.length+" fail besar model tersedia dalam cache peranti ini."+
   (n===C.files.length?" Fail lengkap boleh digunakan untuk percubaan GPU jika peranti sesuai.":" Tekan Muat turun / sambung untuk fail yang belum lengkap."));
  flags();return n;
 }catch(e){completed=0;cacheMsg("Tidak boleh membaca cache: "+String(e.message||e).slice(0,110));flags();return 0;}
}
async function missingUrls(){
 const cache=await caches.open(C.cacheName),missing=[];
 for(const url of C.files){
  const r=await cache.match(url);
  if(!r||!r.ok||r.type==="opaque")missing.push(url);
 }
 return missing;
}
async function deviceCheck(){
 checked=false;storageAllowed=false;gpuAllowed=false;
 backgroundSupported=false;
 diagnostic=null;
 ui.copy.disabled=true;
 ui.details.replaceChildren();
 if(!D?.inspect){
  message("Modul diagnostik tidak tersedia. Muat semula halaman.");return null;
 }
 message("Sedang membaca kemampuan sebenar yang didedahkan pelayar...");
 const report=await D.inspect(navigator,{
  secure:window.isSecureContext,
  minimumStorageBytes:storageNeeded
 });
 diagnostic=report;
 mobile=report.mobile;
 const v=x=>x===D.UNKNOWN?"Tidak didedahkan oleh pelayar":x;
 row("Sistem operasi",v(report.platform.os)+(report.platform.platformVersion?" · versi dilaporkan "+report.platform.platformVersion:""));
 row("Kategori peranti",mobile?"Mudah alih (menurut "+report.platform.classification+")":"Bukan mudah alih (menurut "+report.platform.classification+")");
 row("Model peranti (jika didedahkan)",v(report.platform.model));
 row("Pelayar",report.browser);
 row("RAM (anggaran pelayar)",report.memory!==null?report.memory+" GiB · bukan jumlah RAM sebenar":"Tidak didedahkan oleh pelayar");
 row("CPU (pemproses logik)",report.cpu!==null?report.cpu+" · bilangan yang pelayar laporkan":"Tidak didedahkan oleh pelayar");
 row("Kuota storan untuk laman",report.storage.quota!==null?bytes(report.storage.quota)+" · anggaran":"Tidak didedahkan oleh pelayar");
 row("Penggunaan storan laman",report.storage.usage!==null?bytes(report.storage.usage)+" · anggaran":"Tidak didedahkan oleh pelayar");
 row("Baki kuota laman (bukan storan telefon)",report.storage.remaining!==null?bytes(report.storage.remaining)+" · anggaran":"Tidak dapat diukur");
 row("Cache kekal",report.storage.persistent===true?"Diberikan pelayar":report.storage.persistent===false?"Tidak diberikan (boleh dipadam)":"Tidak dapat disahkan");
 row("Anggaran saiz model",bytes(C.modelBytes));
 storageAllowed=report.storage.remaining!==null&&report.storage.remaining>=storageNeeded; // Amaran anggaran sahaja, bukan had muat turun.
 if(report.storage.remaining===null)row("Kapasiti muat turun",
  "Kuota laman tidak diketahui; boleh cuba muat turun, tetapi pelayar mungkin menolaknya");
 else row("Kapasiti muat turun",storageAllowed?"Kuota laman dianggarkan mencukupi, tidak dijamin":"Anggaran kuota rendah: muat turun masih boleh dicuba, tetapi mungkin gagal");
 row("WebGPU API",report.gpu.api?"Ada":"Tiada/terhalang");
 row("WebGPU adapter",report.gpu.accessible?"Berjaya diperoleh":"Belum berjaya: "+report.gpu.reason);
 row("Nama GPU didedahkan",v(report.gpu.name));
 row("Seni bina GPU didedahkan",v(report.gpu.architecture));
 row("Shader f16",report.gpu.shaderF16===null?"Tidak dapat disahkan":report.gpu.shaderF16?"Disokong adapter":"Tidak ditawarkan adapter");
 row("Had buffer WebGPU",report.gpu.maxBufferSize!==null?bytes(report.gpu.maxBufferSize)+" (had API, bukan VRAM)":"Tidak didedahkan");
 row("Had binding WebGPU",report.gpu.maxStorageBufferBindingSize!==null?bytes(report.gpu.maxStorageBufferBindingSize)+" (had API)":"Tidak didedahkan");
 gpuAllowed=!mobile&&report.secure&&report.gpu.accessible;
 row("Penilaian WebGPU",report.gpu.accessible?"Adapter tersedia; belum bukti model 2.34 GiB mampu berjalan":"Adapter tidak boleh disahkan; model tidak akan diaktifkan");
 row("Dasar keselamatan BETA",mobile?
  "Inferens berat masih dimatikan pada mudah alih kerana risiko tab crash, BUKAN kerana GPU disahkan lemah":
  gpuAllowed?"Percubaan GPU dibenarkan selepas model lengkap, bukan jaminan berjaya":
  "Pengaktifan dihentikan kerana adapter/HTTPS tidak tersedia");
 report.notes.forEach((note,i)=>row("Had laporan "+(i+1),note));
 if(navigator.serviceWorker&&window.isSecureContext){
  try{
   swRegistration=await navigator.serviceWorker.register("./studio-imej-sw.js",{scope:"./"});
   backgroundSupported=Boolean(swRegistration.backgroundFetch);
   if(backgroundSupported){
    const prior=await swRegistration.backgroundFetch.get(C.backgroundId).catch(()=>null);
    if(prior)await attachBackground(prior);
   }
  }catch(_){backgroundSupported=false;}
 }
 row("Background Fetch",backgroundSupported?"API tersedia dalam pelayar (masih eksperimen)":"API tidak tersedia pada pelayar ini");
 checked=true;
 message("BETA TEST: Laporan berdasarkan maklumat pelayar yang boleh diperiksa. "+
   (report.gpu.accessible?"WebGPU adapter dikesan. ":"WebGPU belum dapat disahkan. ")+
   (mobile?"Muat turun boleh dicuba; inferens mudah alih masih dikawal. ":"")+
   "Tiada model atau inferens dimuat semasa semakan.");
 ui.copy.disabled=false;
 await cacheCounts();
 flags();
 return {mobile,storageAllowed,gpuAllowed,backgroundSupported,report};
}
ui.copy.addEventListener("click",async()=>{
 if(!diagnostic)return;
 const safe={
  os:diagnostic.platform.os,model:diagnostic.platform.model,browser:diagnostic.browser,
  mobile:diagnostic.mobile,mobileSource:diagnostic.platform.classification,
  ramBrowserApproxGiB:diagnostic.memory,logicalCpuReported:diagnostic.cpu,
  siteQuotaEstimatedGiB:diagnostic.storage.quota!==null?Number((diagnostic.storage.quota/(1024**3)).toFixed(2)):null,
  siteQuotaRemainingEstimatedGiB:diagnostic.storage.remaining!==null?Number((diagnostic.storage.remaining/(1024**3)).toFixed(2)):null,
  webgpuAdapter:diagnostic.gpu.accessible,gpuNameReported:diagnostic.gpu.name,
  gpuArchitectureReported:diagnostic.gpu.architecture,shaderF16:diagnostic.gpu.shaderF16,
  webgpuMaxBufferBytes:diagnostic.gpu.maxBufferSize,
  backgroundFetchAvailable:backgroundSupported,
  note:"Anggaran dan maklumat yang pelayar dedahkan sahaja; bukan pengukuran fizikal. Tidak termasuk User-Agent penuh atau ID peranti."
 };
 try{await navigator.clipboard.writeText(JSON.stringify(safe,null,2));message("Laporan diagnostik disalin. Tiada data dihantar ke pelayan.");}
 catch(_){message("Salinan disekat oleh pelayar. Rujuk baris laporan di atas.");}
});
ui.check.addEventListener("click",()=>deviceCheck().catch(e=>message("Semakan gagal: "+e.message)));
ui.checkCache.addEventListener("click",()=>cacheCounts());
ui.consent.addEventListener("change",()=>{
 if(!ui.consent.checked&&downloading){
  controller?.abort();
  if(backgroundReg&&backgroundReg.result==="")backgroundReg.abort().catch(()=>{});
  cacheMsg("Persetujuan ditarik balik. Muat turun diminta berhenti.");
 }
 flags();
});
function progress(value,note){
 ui.progress.hidden=false;
 if(Number.isFinite(value)){ui.progress.value=Math.min(100,Math.max(0,value));}
 else ui.progress.removeAttribute("value");
 ui.progressNote.textContent=String(note||"Muat turun sedang berjalan").slice(0,230);
}
async function persistCache(){
 try{if(navigator.storage?.persist)await navigator.storage.persist();}catch(_){}
}
async function foregroundDownload(){
 if(!ui.consent.checked){cacheMsg("Berikan persetujuan untuk muat turun besar terlebih dahulu.");return;}
 if(!cacheAvailable){cacheMsg("Cache Storage dan HTTPS diperlukan untuk menyimpan model.");return;}
 if(downloading||loading||generating||ready)return;
 if(!checked)deviceCheck().catch(()=>{});
 downloading=true;controller=new AbortController();flags();
 let downloadError="";
 progress(NaN,"BETA TEST: cache sahaja tanpa GPU. "+(mobile?"Pada telefon, muat turun besar masih berisiko. ":"")+"Kekalkan tab terbuka.");
 await persistCache();
 try{
  const cache=await caches.open(C.cacheName);
  const missing=await missingUrls();
  for(let i=0;i<missing.length;i++){
   if(controller.signal.aborted)throw new Error("Dibatalkan");
   const url=missing[i],name=url.split("/").slice(-2).join("/");
   progress(NaN,"Muat turun fail "+(i+1)+"/"+missing.length+": "+name+". Pelayar mungkin tidak memaparkan peratus semasa menyimpan fail.");
   const request=new Request(url,{mode:"cors",credentials:"omit",signal:controller.signal});
   const response=await fetch(request);
   if(!response.ok||response.type==="opaque")throw new Error("Pelayan model menolak permintaan ("+response.status+").");
   const type=(response.headers.get("content-type")||"").toLowerCase();
   if(type.includes("text/html"))throw new Error("Model memulangkan HTML dan bukannya fail ONNX.");
   const len=Number(response.headers.get("content-length")||0);
   if(len>0&&len<10*1024*1024)throw new Error("Fail kelihatan terlalu kecil untuk model ONNX.");
   // Cache.put streams the body into browser storage. No JS arrayBuffer() allocation.
   await cache.put(url,response);
   progress(((i+1)/missing.length)*100,"Fail "+(i+1)+"/"+missing.length+" selesai. Fail lengkap disimpan untuk percubaan berikutnya.");
  }
  cacheMsg("Muat turun cache selesai. Semak fail model sebelum mengaktifkan GPU.");
 }catch(e){
  downloadError="Muat turun gagal atau dibatalkan: "+String(e.message||e).slice(0,150);
 }finally{
  downloading=false;controller=null;ui.progress.hidden=true;
  await cacheCounts();
  if(downloadError)cacheMsg(downloadError+". "+completed+"/"+C.files.length+" fail lengkap telah disimpan. Cuba Muat turun / sambung semula.");
  flags();
 }
}
ui.prefetch.addEventListener("click",foregroundDownload);
async function attachBackground(reg){
 if(backgroundReg===reg)return;
 backgroundReg=reg;downloading=Boolean(reg&&reg.result==="");
 flags();
 if(!reg)return;
 const update=()=>{
  if(reg.result===""){
   downloading=true;
   const pct=reg.downloadTotal>0?Math.min(99,reg.downloaded/reg.downloadTotal*100):NaN;
   progress(pct,"BETA TEST: Pelayar memuat "+bytes(reg.downloaded)+". Jika sokongan Background Fetch berfungsi, tab boleh ditinggalkan.");
  }else{
   downloading=false;
   ui.progress.hidden=true;
   cacheMsg(reg.result==="success"?"Muat turun latar selesai; cache sedang disahkan.":"Muat turun latar gagal ("+(reg.failureReason||"ralat")+"). Cuba semak cache.");
   setTimeout(()=>cacheCounts().catch(()=>{}),800);
  }
  flags();
 };
 reg.addEventListener("progress",update);
 update();
}
async function beginBackground(){
 if(!checked)await deviceCheck();
 if(!ui.consent.checked){cacheMsg("Tandakan persetujuan model dahulu.");return;}
 if(!cacheAvailable||!backgroundSupported||!swRegistration?.backgroundFetch){
  cacheMsg("Background Fetch tiada pada pelayar ini. Gunakan Muat turun / sambung sambil tab kekal terbuka.");return;
 }
 if(downloading||loading)return;
 await persistCache();
 try{
  const existing=await swRegistration.backgroundFetch.get(C.backgroundId);
  if(existing){await attachBackground(existing);return;}
  const missing=await missingUrls();
  if(!missing.length){cacheMsg("Semua fail sudah berada dalam cache. Tidak perlu muat turun.");await cacheCounts();return;}
  // For downloads >2GiB the browser may reject; never activate GPU here.
  const reg=await swRegistration.backgroundFetch.fetch(C.backgroundId,missing,{
   title:"Studio Antara · Model imej AI (BETA TEST)"
  });
  cacheMsg("Background Fetch telah dimulakan oleh pelayar. Kemajuan bergantung pada sokongan pelayar.");
  await attachBackground(reg);
 }catch(e){cacheMsg("Background Fetch ditolak oleh pelayar: "+String(e.message||e).slice(0,170)+". "+
   "Gunakan butang Muat turun / sambung sambil mengekalkan tab terbuka.");}
}
ui.background.addEventListener("click",beginBackground);
ui.cancel.addEventListener("click",async()=>{
 if(controller)controller.abort();
 if(backgroundReg&&backgroundReg.result===""){
  try{await backgroundReg.abort();}catch(_){}
 }
 downloading=false;flags();cacheMsg("Pembatalan diminta. Fail yang sudah lengkap boleh dikekalkan.");
});
ui.clear.addEventListener("click",async()=>{
 if(downloading||loading||generating)return;
 if(!confirm("Padam hanya tiga fail model SD-Turbo daripada cache Studio Antara? Fail lain tidak disentuh."))return;
 try{
  const cache=await caches.open(C.cacheName);
  for(const url of C.files)await cache.delete(url);
  await cacheCounts();cacheMsg("Cache fail SD-Turbo dipadam. Tidak menyentuh cache laman atau fail lain.");
 }catch(e){cacheMsg("Tidak boleh padam cache: "+String(e.message||e).slice(0,140));}
});
if(navigator.serviceWorker){
 navigator.serviceWorker.addEventListener("message",event=>{
  if(event.data?.source==="studio-imej-beta"){
   cacheMsg(String(event.data.message||"Status muat turun berubah."));
   cacheCounts().catch(()=>{});
  }
 });
}
async function activate(){
 if(!checked)await deviceCheck();
 if(!gpuAllowed){gpuMsg("BETA TEST: Pengaktifan ditangguh oleh dasar keselamatan mudah alih atau adapter/HTTPS tidak tersedia. Ini bukan pengesahan GPU tidak mampu.");return;}
 if(!ui.consent.checked||completed!==C.files.length){gpuMsg("Selesaikan muat turun cache model dan persetujuan dahulu.");return;}
 if(loading||ready)return;
 loading=true;ui.activate.disabled=true;ui.imgProgress.hidden=false;ui.imgProgress.removeAttribute("value");
 gpuMsg("BETA TEST: Menyediakan runtime dan GPU desktop. Penggunaan memori masih tinggi.");
 try{
  sdk=await import("https://esm.sh/web-txt2img@0.3.1?bundle");
  if(typeof sdk?.loadModel!=="function"||typeof sdk?.generateImage!=="function")
   throw new Error("Runtime tidak lengkap.");
  engine="direct";client=null;
  if(typeof Worker!=="undefined"&&sdk.Txt2ImgWorkerClient?.createDefault){
   try{
    const candidate=sdk.Txt2ImgWorkerClient.createDefault();
    const caps=await Promise.race([
     candidate.detect(),new Promise((_,rej)=>setTimeout(()=>rej(new Error("Worker timeout")),6500))
    ]);
    if(caps?.webgpu){client=candidate;engine="worker";}
    else candidate.terminate();
   }catch(_){try{client?.terminate();}catch(_){}client=null;}
  }
  const onProgress=p=>{
   const pct=Number(p?.pct);
   if(Number.isFinite(pct)){ui.imgProgress.value=Math.max(0,Math.min(100,pct));}
   ui.imgNote.textContent="BETA TEST: "+String(p?.message||p?.phase||"Membina sesi GPU").slice(0,155);
  };
  const result=engine==="worker"?
   await client.load(C.model,{backendPreference:["webgpu"]},onProgress):
   await sdk.loadModel(C.model,{backendPreference:["webgpu"],onProgress});
  if(!result?.ok)throw new Error(result?.message||result?.reason||"Model tidak boleh diaktifkan.");
  ready=true;gpuMsg("Model diaktifkan pada GPU. BETA TEST: jana satu imej untuk menguji.");
 }catch(e){
  ready=false;gpuMsg("BETA TEST: Model gagal diaktifkan. "+String(e.message||e).slice(0,160));
  try{client?.terminate();}catch(_){}
  client=null;sdk=null;
 }finally{loading=false;ui.imgProgress.hidden=true;flags();}
}
ui.activate.addEventListener("click",activate);
ui.gen.addEventListener("click",async()=>{
 if(!ready||!sdk||generating)return;
 const prompt=ui.prompt.value.trim();
 if(!prompt){gpuMsg("Masukkan penerangan imej dahulu.");return;}
 generating=true;blob=null;
 if(imageUrl){URL.revokeObjectURL(imageUrl);imageUrl=null;}
 ui.img.removeAttribute("src");ui.output.hidden=true;ui.placeholder.hidden=false;
 ui.imgProgress.hidden=false;ui.imgProgress.removeAttribute("value");flags();
 const seed=Math.max(0,Math.min(2147483647,Math.trunc(Number(ui.seed.value)||42)));
 try{
  let result;const onProgress=p=>{ui.imgNote.textContent="BETA TEST: "+String(p?.message||p?.phase||"Jana imej").slice(0,155);};
  if(engine==="worker"){
   const task=client.generate({prompt,seed,width:512,height:512},onProgress,{busyPolicy:"queue",debounceMs:0});
   abortGenerate=()=>task.abort();result=await task.promise;
  }else{
   controller=new AbortController();abortGenerate=()=>controller.abort();
   result=await sdk.generateImage({model:C.model,prompt,seed,width:512,height:512,signal:controller.signal,onProgress});
  }
  if(!result?.ok||!(result.blob instanceof Blob)||!result.blob.size)throw new Error(result?.message||result?.reason||"Tiada imej sebenar.");
  blob=result.blob;imageUrl=URL.createObjectURL(blob);
  ui.img.src=imageUrl;ui.output.hidden=false;ui.placeholder.hidden=true;
  gpuMsg("Imej siap! BETA TEST. Simpan PNG untuk kegunaan seterusnya.");
 }catch(e){gpuMsg("BETA TEST: Penjanaan gagal/dibatalkan: "+String(e.message||e).slice(0,150));}
 finally{generating=false;abortGenerate=null;controller=null;ui.imgProgress.hidden=true;flags();}
});
ui.stop.addEventListener("click",()=>{if(abortGenerate)abortGenerate();});
ui.download.addEventListener("click",()=>{
 if(!blob)return;
 const a=document.createElement("a"),url=URL.createObjectURL(blob);
 a.href=url;a.download="studio-antara-beta-"+Date.now()+".png";document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),8000);
});
window.addEventListener("pagehide",()=>{
 if(imageUrl)URL.revokeObjectURL(imageUrl);
 if(abortGenerate)abortGenerate();
 // Do not cancel browser-managed Background Fetch: it may continue if supported.
});
flags(); // Proses diagnostik tidak boleh mengunci butang muat turun selepas persetujuan.
cacheCounts().catch(()=>{});
deviceCheck().catch(e=>message("Semakan permulaan gagal: "+String(e.message||e)+". Muat turun boleh dicuba selepas persetujuan."));
window.StudioImejBeta={deviceCheck,cacheCounts,missingUrls};
})();
