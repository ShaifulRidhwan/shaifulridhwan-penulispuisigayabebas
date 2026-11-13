"use strict";
// Shared best-effort daily reservations using Netlify Blobs strongly-consistent
// reads. Netlify Blobs has last-writer-wins semantics (not atomic CAS), so
// concurrent cold instances may race; upstream free-tier limits remain essential.
const {getStore}=require("@netlify/blobs");
const inFlight=new Set();
const ERR=(status,message,category="budget")=>Object.assign(new Error(message),{status,category});
function cap(env=process.env){
  const raw=Number.parseInt(String(env.AKSARA_AGENT_DAILY_CAP||"8"),10);
  return Number.isFinite(raw)?Math.max(1,Math.min(12,raw)):8;
}
function dayKey(now=Date.now()){
  return "day/"+new Date(now).toISOString().slice(0,10);
}
async function reserve(ownerId,{env=process.env,store=null,now=Date.now()}={}){
  if(typeof ownerId!=="string"||!/^[a-f0-9]{24}$/.test(ownerId))throw ERR(403,"Identiti pemilik tidak sah.");
  const key=dayKey(now);
  const lock=ownerId+":"+key;
  if(inFlight.has(lock))throw ERR(429,"Satu misi sedang berjalan. Cuba selepas ia selesai.");
  inFlight.add(lock);
  try {
    const blob=store||getStore({name:"aksara-agentic-budget",consistency:"strong"});
    const record=await blob.get(key,{type:"json",consistency:"strong"});
    if(record!==null && (!record||typeof record!=="object"||
      !Number.isSafeInteger(record.count)||record.count<0))
      throw ERR(503,"Rekod kuota tidak sah; misi tidak dilaksanakan.","budget_unavailable");
    const used=record?.count||0;
    if(used>=cap(env))throw ERR(429,"Kuota harian Agentic pemilik sudah dicapai.");
    await blob.setJSON(key,{count:used+1,updatedAt:new Date(now).toISOString()});
    return {spent:used+1,dailyCap:cap(env),day:key};
  }catch(error){
    if(error?.status)throw error;
    throw ERR(503,"Simpanan kuota Netlify tidak tersedia; misi dihentikan.","budget_unavailable");
  }finally{inFlight.delete(lock);}
}
module.exports={reserve,cap,dayKey};
