/* Studio Antara: same-origin module Worker for web-txt2img 0.3.1.
 * The UI owns download consent; this Worker only handles GPU inference.
 * Imports may be cross-origin ESM; the Worker entry itself must be same-origin.
 */
"use strict";
let runtimePromise=null;
let activeModel=null;
let loading=false;
let generating=null;
const runtime=()=>runtimePromise||(runtimePromise=import("https://esm.sh/web-txt2img@0.3.1?bundle"));
const respond=(id,details)=>self.postMessage({id,type:"result",...details});
const fail=(id,error,reason="internal_error")=>respond(id,{
 ok:false,reason,message:String(error?.message||error).slice(0,300)
});
const progress=(id,event)=>self.postMessage({id,type:"progress",event});
self.addEventListener("message",event=>{
 const req=event.data;
 if(!req||typeof req!=="object"||typeof req.id!=="string"||typeof req.kind!=="string")return;
 handle(req).catch(error=>fail(req.id,error));
});
async function handle(req){
 const {id,kind}=req;
 if(kind==="abort"){
  if(generating)generating.abort();
  respond(id,{ok:true});
  return;
 }
 if(kind==="detect"){
  const sdk=await runtime();
  respond(id,{ok:true,data:await sdk.detectCapabilities()});
  return;
 }
 if(kind==="listModels"){
  const sdk=await runtime();
  respond(id,{ok:true,data:sdk.listSupportedModels()});
  return;
 }
 if(kind==="listBackends"){
  const sdk=await runtime();
  respond(id,{ok:true,data:sdk.listBackends()});
  return;
 }
 if(kind==="load"){
  if(loading||generating||activeModel){
   fail(id,"Model sedang atau telah dimuat. Nyahaktifkan sebelum cuba lagi.","busy");
   return;
  }
  loading=true;
  try{
   const sdk=await runtime();
   const result=await sdk.loadModel(req.model,{
    ...req.options,
    backendPreference:["webgpu"],
    onProgress:event=>progress(id,event)
   });
   if(!result?.ok){fail(id,result?.message||result?.reason||"Model gagal dimuat.",result?.reason||"internal_error");return;}
   activeModel=req.model;
   respond(id,{ok:true,data:result});
  }finally{loading=false;}
  return;
 }
 if(kind==="generate"){
  if(!activeModel){fail(id,"Model belum diaktifkan.","model_not_loaded");return;}
  if(loading||generating){fail(id,"Penjanaan lain masih berjalan.","busy");return;}
  if(req.params?.model&&req.params.model!==activeModel){
   fail(id,"Model tidak sepadan dengan model yang aktif.","model_not_loaded");return;
  }
  const aborter=new AbortController();
  generating=aborter;
  try{
   const sdk=await runtime();
   const result=await sdk.generateImage({
    ...req.params,model:activeModel,signal:aborter.signal,
    onProgress:event=>progress(id,event)
   });
   if(!result?.ok){fail(id,result?.message||result?.reason||"Penjanaan gagal.",result?.reason||"internal_error");return;}
   respond(id,{ok:true,blob:result.blob,timeMs:result.timeMs});
  }finally{generating=null;}
  return;
 }
 if(kind==="unload"){
  if(loading||generating){fail(id,"GPU masih sibuk.","busy");return;}
  if(activeModel){
   const sdk=await runtime();
   await sdk.unloadModel(activeModel);
   activeModel=null;
  }
  respond(id,{ok:true});
  return;
 }
 if(kind==="purge"||kind==="purgeAll"){
  if(loading||generating){fail(id,"GPU masih sibuk.","busy");return;}
  const sdk=await runtime();
  if(kind==="purgeAll")await sdk.purgeAllCaches();
  else await sdk.purgeModelCache(req.model||activeModel||"sd-turbo");
  respond(id,{ok:true});
  return;
 }
 fail(id,"Arahan Worker tidak dikenali.","unsupported_option");
}
self.postMessage({type:"state",value:"idle"});
