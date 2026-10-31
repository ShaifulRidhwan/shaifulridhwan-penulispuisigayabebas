"use strict";
// Optional shared daily upstream request cap (UTC boundary = 08:00 MYT).
// Counter only; no prompts, IPs, identity, histories or user data stored.
// Conditional writes are not a transactional billing ledger.
function failure(status,retryAfterSeconds,message){
 return Object.assign(new Error(message),{status,retryAfterSeconds});
}
async function reserve({store,cap=800,now=Date.now()}={}){
 if(!store||typeof store.getWithMetadata!=="function"||typeof store.setJSON!=="function")
  throw failure(503,60,"Shared counter unavailable");
 const raw=Number(cap),limit=Number.isFinite(raw)?Math.max(0,Math.min(100000,Math.floor(raw))):800;
 const day=new Date(now).toISOString().slice(0,10),key="chat/day/"+day;
 const reset=Math.max(1,Math.ceil((Date.parse(day+"T00:00:00Z")+86400000-now)/1000));
 for(let attempt=0;attempt<10;attempt++){
  let entry;
  try{entry=await store.getWithMetadata(key,{type:"json",consistency:"strong"});}
  catch(_){throw failure(503,60,"Shared counter read unavailable");}
  const used=Number(entry?.data?.used)||0;
  if(used>=limit)throw failure(429,reset,"Shared chat daily cap reached");
  let saved;
  try{saved=await store.setJSON(key,{used:used+1},entry?{onlyIfMatch:entry.etag}:{onlyIfNew:true});}
  catch(_){throw failure(503,60,"Shared counter write unavailable");}
  if(saved?.modified)return {used:used+1,limit,resetSeconds:reset};
 }
 throw failure(429,5,"Shared chat budget busy");
}
module.exports={reserve};
