/* Studio Antara BETA: browser-managed Background Fetch only. No fetch interception. */
importScripts("./studio-imej-config.js");
const C=self.StudioImejConfig;
async function notify(type,message){
 const pages=await self.clients.matchAll({type:"window",includeUncontrolled:true});
 for(const client of pages)client.postMessage({source:"studio-imej-beta",type,message});
}
async function saveCompleted(registration){
 const records=await registration.matchAll();
 const cache=await caches.open(C.cacheName);
 let saved=0;
 for(const record of records){
  if(!C.isModelFile(record.request.url))continue;
  try{
   const response=await record.responseReady;
   if(response&&response.ok&&response.type!=="opaque"){
    await cache.put(record.request,response);
    saved++;
   }
  }catch(_){/* Failed file is not marked cached; later retry may fetch again. */}
 }
 return saved;
}
self.addEventListener("backgroundfetchsuccess",event=>{
 if(event.registration.id!==C.backgroundId)return;
 event.waitUntil((async()=>{
  try{
   const count=await saveCompleted(event.registration);
   const msg=count===C.files.length?
    "Model selesai dimuat ke cache. Kembali ke halaman BETA untuk semak.":
    "Sebahagian model sudah disimpan. Semak cache dan cuba sambung.";
   await notify("complete",msg);
   if(event.updateUI)await event.updateUI({title:"Studio Antara: muat turun model tamat"}).catch(()=>{});
  }catch(e){await notify("error","Penyimpanan cache gagal: "+String(e.message||e).slice(0,130));}
 })());
});
self.addEventListener("backgroundfetchfail",event=>{
 if(event.registration.id!==C.backgroundId)return;
 event.waitUntil((async()=>{
  const count=await saveCompleted(event.registration).catch(()=>0);
  await notify("error","Muat turun latar terganggu. "+count+" fail lengkap disimpan, fail lain boleh dicuba semula.");
 })());
});
self.addEventListener("backgroundfetchabort",event=>{
 if(event.registration.id!==C.backgroundId)return;
 event.waitUntil(notify("error","Muat turun latar dibatalkan. Fail lengkap yang telah disimpan mungkin masih tersedia."));
});