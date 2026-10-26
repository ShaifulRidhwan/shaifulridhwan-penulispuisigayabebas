(function(root){
"use strict";
/*
 * A transparent, privacy-conscious client capability report.
 * No network calls, no server submission, no device fingerprint.
 * Browser-reported details can be masked, rounded, or unsupported.
 */
const UNKNOWN="Tidak didedahkan oleh pelayar";
const GiB=1024**3;
const limit=(value,max=100)=>String(value||"").trim().slice(0,max);
const numeric=value=>typeof value==="number"&&Number.isFinite(value)&&value>=0?value:null;
function parseBrowser(ua,brands,brave){
 const brandNames=Array.isArray(brands)?brands.map(b=>String(b?.brand||"").toLowerCase()):[];
 let name=brave?"Brave":brandNames.includes("microsoft edge")?"Microsoft Edge":
  /\bEdg(?:A|iOS)?\//.test(ua)?"Microsoft Edge":/\bFirefox\//.test(ua)?"Firefox":
  /\bSamsungBrowser\//.test(ua)?"Samsung Internet":/\bOPR\//.test(ua)?"Opera":
  /CriOS\//.test(ua)?"Chrome (iOS)":/\bChrome\//.test(ua)||brandNames.includes("google chrome")?"Chrome/Chromium":
  /\bSafari\//.test(ua)?"Safari":UNKNOWN;
 // Chromium browsers can hide their brand in the User Agent.
 if(name==="Chrome/Chromium")name="Chromium (jenama tepat tidak disahkan)";
 return name;
}
function inferPlatform(nav, high){
 const ua=String(nav.userAgent||"");
 const reported=limit(high.platform||nav.userAgentData?.platform||nav.platform||"",75);
 const os=/Android/i.test(reported)||/Android/i.test(ua)?"Android":
  /iPhone|iPad|iPod|iOS/i.test(reported+" "+ua)?"iOS/iPadOS":
  /Windows/i.test(reported+" "+ua)?"Windows":
  /Mac/i.test(reported+" "+ua)?"macOS":
  /Linux/i.test(reported+" "+ua)?"Linux":reported||UNKNOWN;
 const platformVersion=limit(high.platformVersion||"",35);
 const model=limit(high.model||"",70)||UNKNOWN;
 const platformMobile=nav.userAgentData&&typeof nav.userAgentData.mobile==="boolean"?nav.userAgentData.mobile:null;
 const mobile=os==="Android"||os==="iOS/iPadOS"||(platformMobile!==null?platformMobile:/Android|iPhone|iPad|iPod|Mobile/i.test(ua));
 const classification=(os==="Android"||os==="iOS/iPadOS")?"Sistem operasi yang dilaporkan pelayar":platformMobile!==null?"Client Hints pelayar":"Petunjuk User-Agent (boleh diubah)";
 return {os,platformVersion,model,mobile,classification,modelSource:model===UNKNOWN?"tidak tersedia":"Client Hints pelayar (mungkin dilindungi)"};
}
async function withTimeout(promise,ms,fallback){
 if(!promise||typeof promise.then!=="function")return fallback;
 let timer;
 try{return await Promise.race([promise,new Promise((resolve)=>{timer=setTimeout(()=>resolve(fallback),ms);})]);}
 catch(_){return fallback;}
 finally{clearTimeout(timer);}
}
async function inspect(nav,ctx={}){
 const secure=ctx.secure===true;
 const report={
  secure,platform:{},browser:UNKNOWN,memory:null,cpu:null,storage:{state:"unknown",remaining:null,quota:null,usage:null,persistent:null},
  gpu:{api:false,accessible:false,shaderF16:null,name:UNKNOWN,architecture:UNKNOWN,maxBufferSize:null,maxStorageBufferBindingSize:null,reason:""},
  notes:[],mobile:false,knownDownloadCapacity:false
 };
 const userAgent=String(nav.userAgent||"");
 let hints={};
 if(nav.userAgentData&&typeof nav.userAgentData.getHighEntropyValues==="function"){
  hints=await withTimeout(nav.userAgentData.getHighEntropyValues(["platform","platformVersion","model","architecture","bitness","fullVersionList"]),1800,{})||{};
 }
 const brands=hints.fullVersionList||nav.userAgentData?.brands||[];
 const brave=Boolean(await withTimeout(typeof nav.brave?.isBrave==="function"?nav.brave.isBrave():null,800,false));
 report.browser=parseBrowser(userAgent,brands,brave);
 report.platform=inferPlatform(nav,hints);
 report.mobile=report.platform.mobile;
 report.memory=numeric(nav.deviceMemory);
 report.cpu=numeric(nav.hardwareConcurrency);
 report.notes.push("RAM pelayar dibundarkan/dihadkan demi privasi; bukan bacaan RAM fizikal sebenar.");
 report.notes.push("Teras CPU ialah bilangan pemproses logik yang didedahkan pelayar, bukan pengesahan cip sebenar.");
 let estimate=null;
 try{estimate=await withTimeout(nav.storage?.estimate?.(),1800,null);}catch(_){}
 const quota=numeric(estimate?.quota),usage=numeric(estimate?.usage);
 report.storage.quota=quota;report.storage.usage=usage;
 if(quota!==null&&usage!==null&&quota>=usage){
  report.storage.remaining=quota-usage;
  report.storage.state="estimated";
 }else report.storage.state="unknown";
 try{
  const persisted=await withTimeout(nav.storage?.persisted?.(),900,null);
  report.storage.persistent=typeof persisted==="boolean"?persisted:null;
 }catch(_){}
 report.notes.push("Kuota storan ialah anggaran kapasiti untuk laman ini, BUKAN ruang fizikal telefon/PC.");
 const needed=Number(ctx.minimumStorageBytes)||0;
 report.knownDownloadCapacity=report.storage.remaining!==null&&report.storage.remaining>=needed;
 if(report.storage.remaining!==null&&needed>0&&report.storage.remaining<needed)report.storage.state="insufficient-estimate";
 if(!secure){
  report.gpu.reason="Memerlukan HTTPS atau localhost.";
 }else if(!nav.gpu||typeof nav.gpu.requestAdapter!=="function"){
  report.gpu.reason="WebGPU API tidak tersedia.";
 }else{
  report.gpu.api=true;
  try{
   const adapter=await withTimeout(nav.gpu.requestAdapter({powerPreference:"high-performance"}),2500,null);
   if(!adapter)report.gpu.reason="GPU adapter tidak dapat diperoleh atau disekat pelayar.";
   else{
    report.gpu.accessible=true;
    let info=adapter.info||null;
    if(!info&&typeof adapter.requestAdapterInfo==="function")
     info=await withTimeout(adapter.requestAdapterInfo(),700,null);
    const name=limit(info?.description||info?.device||"",100);
    report.gpu.name=name||UNKNOWN;
    report.gpu.architecture=limit(info?.architecture||"",60)||UNKNOWN;
    report.gpu.shaderF16=typeof adapter.features?.has==="function"?adapter.features.has("shader-f16"):null;
    report.gpu.maxBufferSize=numeric(adapter.limits?.maxBufferSize);
    report.gpu.maxStorageBufferBindingSize=numeric(adapter.limits?.maxStorageBufferBindingSize);
    report.gpu.reason="Adapter WebGPU boleh dicapai; kemampuan menjana imej besar belum dibuktikan.";
   }
  }catch(_){report.gpu.reason="Semakan adapter WebGPU gagal atau disekat.";}
 }
 report.notes.push("Nama GPU dan had WebGPU mungkin disembunyikan atau dibundarkan oleh pelayar; had WebGPU tidak sama dengan VRAM.");
 report.notes.push("Pemeriksaan ringan ini tidak memuat model atau menjalankan inferens, jadi tidak boleh menjamin penjanaan imej berjaya.");
 return report;
}
const api={inspect,inferPlatform,parseBrowser,UNKNOWN,GiB};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(root)root.StudioDeviceDiagnostics=api;
})(typeof window!=="undefined"?window:undefined);