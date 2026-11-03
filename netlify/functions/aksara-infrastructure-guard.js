"use strict";
/* Warm-instance guard only. Cross-instance atomic rate limiting needs a shared
 * transactional store or provider-native throttling; Netlify Blobs is not a lock. */
function throttle(store,key,limit=12,now=Date.now(),windowMs=60000){
 if(!(store instanceof Map))return true;
 if(store.size>750){
  for(const [id,v] of store)if(!v||now-v.start>windowMs)store.delete(id);
  if(store.size>1200){
   const oldest=[...store.entries()].sort((a,b)=>a[1].start-b[1].start);
   for(let i=0;i<oldest.length-700;i++)store.delete(oldest[i][0]);
  }
 }
 const entry=store.get(key);
 if(!entry||now-entry.start>=windowMs){store.set(key,{count:1,start:now});return false;}
 entry.count++;
 return entry.count>Math.max(1,Math.min(100,limit));
}
function budget({bodyBytes=0,mediaBytes=0,maxBody=5500000,maxMedia=5200000}={}){
 const body=Number(bodyBytes),media=Number(mediaBytes);
 return {ok:Number.isFinite(body)&&Number.isFinite(media)&&body>=0&&media>=0&&
  body<=maxBody&&media<=maxMedia,bodyBytes:body,mediaBytes:media,scope:"local_payload_guard"};
}
module.exports={throttle,budget};
