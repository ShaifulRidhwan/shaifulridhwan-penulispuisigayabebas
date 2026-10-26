(function(){
"use strict";
/*
 * STUDIO ANTARA: penjana imej AI percubaan berasaskan WebGPU.
 * Prompt diproses oleh worker model setempat. HANYA memuat pustaka/model
 * daripada CDN selepas pengguna beri persetujuan dan klik "Muat model".
 * Tiada panggilan kepada Gemini, model imej berbayar atau Netlify Function.
 * Browser/CDN/GPU compatibility cannot be guaranteed: display BETA TEST.
 */
const $=id=>document.getElementById(id);
if(!$("imagePrompt")||!$("loadImageModel"))return;
const status=$("gpuStatus"),progress=$("imageProgress"),note=$("imageProgressNote");
const check=$("checkGPU"),loadBtn=$("loadImageModel"),genBtn=$("generateImage");
const stop=$("stopImage"),download=$("downloadImage"),output=$("studioImageOutput"),img=$("generatedImage");
let client=null,ready=false,loading=false,generating=false,cancel=null,generatedBlob=null,objectUrl=null;
const set=(message)=>{status.textContent=String(message||"").slice(0,380);};
const failed=(detail)=>{
 const message=String(detail||"Tidak diketahui").slice(0,180);
 set("BETA TEST: Fungsi imej belum boleh digunakan pada peranti atau rangkaian ini. "+message);
};
const stages=p=>{
 if(!p||typeof p!=="object")return;
 let pct=Number(p.pct);
 if(Number.isFinite(pct)){if(pct>0&&pct<=1)pct*=100;pct=Math.max(0,Math.min(100,pct));progress.value=pct;progress.hidden=false;}
 const bytes=Number(p.bytesDownloaded),max=Number(p.totalBytesExpected);
 let size="";
 if(Number.isFinite(bytes)&&bytes>0){size=" · "+(bytes/1048576).toFixed(0)+" MB";if(Number.isFinite(max)&&max>bytes)size+="/"+(max/1048576).toFixed(0)+" MB";}
 note.textContent="BETA TEST · "+String(p.message||p.phase||"Proses berjalan").slice(0,125)+(Number.isFinite(pct)&&pct>0?" · "+Math.round(pct)+"%":"")+size;
};
const consent=()=>$("imageConsent").checked;
async function gpuSupport(){
 if(!window.isSecureContext){failed("Memerlukan HTTPS atau localhost.");return false;}
 if(!("gpu" in navigator)){failed("WebGPU tidak disokong dalam pelayar ini. Cuba Chrome/Edge moden dengan GPU bersesuaian.");return false;}
 if(typeof Worker==="undefined"){failed("Web Worker diperlukan untuk mengekalkan responsiviti.");return false;}
 try{
  const adapter=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});
  if(!adapter){failed("Pelayar tidak dapat mendapatkan WebGPU adapter. GPU/driver mungkin tidak sesuai.");return false;}
  const f16=adapter.features?.has("shader-f16");
  set("WebGPU dikesan. Shader f16: "+(f16?"tersedia":"tidak disahkan")+". Ini bukan jaminan model boleh berjalan. BETA TEST.");
  return true;
 }catch(e){failed("Gagal menyemak WebGPU: "+String(e.message||e).slice(0,100));return false;}
}
check.addEventListener("click",gpuSupport);
$("imageConsent").addEventListener("change",()=>{if(!consent()&&!ready)set("Persetujuan diperlukan sebelum muat turun model.");});
loadBtn.addEventListener("click",async()=>{
 if(loading||generating)return;
 if(!consent()){set("Tandakan persetujuan untuk muat turun model bersaiz besar terlebih dahulu.");return;}
 if(ready){set("Model sudah dimuat. Masukkan prompt dan tekan Jana imej (BETA TEST).");return;}
 if(!await gpuSupport())return;
 loading=true;loadBtn.disabled=true;check.disabled=true;
 set("BETA TEST: Membaca pustaka WebGPU. Model boleh menggunakan beberapa gigabait storan dan RAM.");
 note.textContent="Tiada bayaran API; muat turun bergantung pada rangkaian/CDN pengguna.";
 try{
  // External runtime fetched only after affirmative user action; pinned to known package version.
  const sdk=await import("https://esm.sh/web-txt2img@0.3.1?bundle");
  if(!sdk?.Txt2ImgWorkerClient?.createDefault)throw Error("Modul penjanaan tidak serasi dengan pelayar ini.");
  client=sdk.Txt2ImgWorkerClient.createDefault();
  const caps=await client.detect();
  if(!caps||!caps.webgpu)throw Error("Runtime tidak mengesan WebGPU yang boleh digunakan.");
  progress.hidden=false;progress.removeAttribute("value");
  set("BETA TEST: Memuat model SD-Turbo. Jangan tutup tab ketika muat turun.");
  const result=await client.load("sd-turbo",{backendPreference:["webgpu"]},stages);
  if(!result?.ok)throw Error(result?.message||result?.reason||"Model gagal dimuat.");
  ready=true;genBtn.disabled=false;
  progress.hidden=true;note.textContent="Model siap dimuat pada peranti. Hasil ialah percubaan dan berbeza mengikut GPU.";
  set("Model SD-Turbo tersedia dalam pelayar ini. BETA TEST: Jana imej apabila bersedia.");
 }catch(err){
  ready=false;genBtn.disabled=true;progress.hidden=true;
  failed(String(err?.message||err)+". Jika mahu, cuba demo sumber terbuka yang dipautkan di bawah.");
  try{await client?.unload();}catch(_){}
  client=null;
 }finally{loading=false;loadBtn.disabled=false;check.disabled=false;}
});
genBtn.addEventListener("click",async()=>{
 if(!ready||!client||generating){if(!ready)set("Muat model BETA TEST terlebih dahulu.");return;}
 if(!consent()){set("Persetujuan telah ditarik balik. Penjanaan dihentikan.");return;}
 const prompt=$("imagePrompt").value.trim();
 if(!prompt){set("Tulis penerangan imej terlebih dahulu.");return;}
 const n=Number($("imageSeed").value),seed=Number.isFinite(n)?Math.max(0,Math.min(2147483647,Math.floor(n))):42;
 generating=true;genBtn.disabled=true;stop.disabled=false;download.disabled=true;
 generatedBlob=null;
 if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}
 img.removeAttribute("src");output.hidden=true;
 progress.hidden=false;progress.removeAttribute("value");
 set("BETA TEST: SD-Turbo sedang menjana imej pada peranti. Tiada API berbayar.");
 try{
  const task=client.generate({prompt,seed,width:512,height:512},stages,{busyPolicy:"queue",debounceMs:0});
  if(!task||typeof task.promise?.then!=="function")throw Error("Runtime tidak memberikan tugasan penjanaan.");
  cancel=typeof task.abort==="function"?task.abort:null;
  const result=await task.promise;
  if(!result?.ok||!(result.blob instanceof Blob)||!result.blob.size)
   throw Error(result?.message||result?.reason||"Tiada fail imej berjaya dijana.");
  generatedBlob=result.blob;
  objectUrl=URL.createObjectURL(generatedBlob);
  img.src=objectUrl;output.hidden=false;
  note.textContent="Imej sebenar dijana oleh model pada peranti. "+(Number.isFinite(result.timeMs)?"Masa: "+(result.timeMs/1000).toFixed(1)+"s. ":"")+"BETA TEST.";
  download.disabled=false;
  set("BETA TEST: Imej siap. Simpan PNG untuk disimpan pada peranti.");
 }catch(e){generatedBlob=null;download.disabled=true;output.hidden=true;failed("Janaan gagal atau dibatalkan: "+String(e.message||e));}
 finally{
  generating=false;cancel=null;genBtn.disabled=!ready;stop.disabled=true;progress.hidden=true;
 }
});
stop.addEventListener("click",()=>{if(typeof cancel==="function"){cancel();set("Permintaan henti dihantar. GPU mungkin mengambil masa untuk berhenti.");}});
download.addEventListener("click",()=>{
 if(!generatedBlob){set("Tiada imej berjaya dijana untuk disimpan.");return;}
 const url=URL.createObjectURL(generatedBlob),a=document.createElement("a");
 a.href=url;a.download="studio-antara-imej-beta-"+Date.now()+".png";document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),8000);
});
window.addEventListener("pagehide",()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);if(cancel)cancel();});
})();
