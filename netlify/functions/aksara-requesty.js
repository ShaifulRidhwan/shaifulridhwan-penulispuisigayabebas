"use strict";
/*
 * Requesty free-text adapter. This is an optional, fail-closed integration.
 * Requesty accounts require an eligible adult account holder. The website
 * must not send visitor content until an operator has reviewed the data terms.
 * Free-model availability/prices are verified against Requesty's API before use.
 * Pin exact zero-cost provider endpoints instead of managed IDs that might
 * silently route to a paid upstream on failure.
 * Never use a paid model, policy/ route, media, or user data without opt-in.
 */
const API="https://router.requesty.ai/v1";
const FREE_IDS=Object.freeze([
 "google/gemma-4-31b-it",
 "nvidia/nemotron-3.5-lightning-30b-a3b",
 "nvidia/nemotron-3-super-120b-a12b",
 "nvidia/nemotron-3-ultra-550b-a55b",
 "nvidia/nemotron-3-nano-30b-a3b",
 "mistral/leanstral-1-5"
]);
const PREFERENCES=Object.freeze({
 conversation:["google/gemma-4-31b-it","nvidia/nemotron-3.5-lightning-30b-a3b","nvidia/nemotron-3-nano-30b-a3b"],
 creative:["google/gemma-4-31b-it","nvidia/nemotron-3-super-120b-a12b"],
 explain:["google/gemma-4-31b-it","nvidia/nemotron-3.5-lightning-30b-a3b"],
 technical:["nvidia/nemotron-3-super-120b-a12b","mistral/leanstral-1-5","google/gemma-4-31b-it"],
 critique:["nvidia/nemotron-3-super-120b-a12b","google/gemma-4-31b-it"],
 hypothetical:["nvidia/nemotron-3-super-120b-a12b","google/gemma-4-31b-it"],
 general:["google/gemma-4-31b-it","nvidia/nemotron-3.5-lightning-30b-a3b"]
});
const cache={until:0,models:[],pending:null};
function configured(){
 // All safeguards default OFF; no API request is allowed when not configured.
 return process.env.AKSARA_FREE_FALLBACKS==="true" &&
  process.env.REQUESTY_ACCOUNT_HOLDER_ELIGIBLE==="true" &&
  process.env.REQUESTY_DATA_POLICY_REVIEWED==="true" &&
  process.env.REQUESTY_END_USER_ELIGIBILITY_VERIFIED==="true" &&
  typeof process.env.REQUESTY_API_KEY==="string" &&
  process.env.REQUESTY_API_KEY.length>8;
}
function priceNumber(raw){
 if(typeof raw==="number")return Number.isFinite(raw)?raw:NaN;
 if(typeof raw==="string"&&/^(?:0+(?:\.0+)?|\d+(?:\.\d+)?)$/.test(raw.trim()))return Number(raw.trim());
 return NaN;
}
function zeroCost(model){
 if(!model||typeof model!=="object"||!FREE_IDS.includes(model.id))return false;
 const p=model.pricing||{};
 // Unknown or changed pricing formats must never be treated as free.
 const input=priceNumber(model.input_price??p.prompt??p.input);
 const output=priceNumber(model.output_price??p.completion??p.output);
 // Missing, nonnumeric, and positive prices are unsafe. Fail closed.
 return input===0&&output===0 && model.type!=="embedding" && model.type!=="safety";
}
async function freeModels({signal}={}){
 if(!configured())return [];
 if(cache.until>Date.now())return cache.models;
 if(cache.pending)return cache.pending;
 cache.pending=(async()=>{
  const ctrl=new AbortController();
  const stop=()=>ctrl.abort();
  if(signal?.aborted)stop();else signal?.addEventListener("abort",stop,{once:true});
  const timer=setTimeout(stop,3500);
  try{
   const res=await fetch(API+"/models",{
    method:"GET",
    headers:{Authorization:"Bearer "+process.env.REQUESTY_API_KEY,Accept:"application/json"},
    signal:ctrl.signal
   });
   if(!res.ok)throw new Error("Catalog unavailable");
   const data=await res.json();
   if(!Array.isArray(data?.data))throw new Error("Invalid catalog");
   const models=data.data.filter(zeroCost).map(x=>x.id);
   // Never preserve an old green verdict when an upstream price may have changed.
   cache.models=[...new Set(models)].slice(0,FREE_IDS.length);
   cache.until=Date.now()+5*60*1000;
   return cache.models;
  }catch(_){
   cache.models=[];
   cache.until=Date.now()+10000;
   return [];
  }finally{
   clearTimeout(timer);
   signal?.removeEventListener?.("abort",stop);
  }
 })();
 try{return await cache.pending;}finally{cache.pending=null;}
}
function chooseModel(ids,task="general"){
 const available=new Set(ids);
 const choices=PREFERENCES[task]||PREFERENCES.general;
 return choices.find(id=>available.has(id))||FREE_IDS.find(id=>available.has(id))||null;
}
async function modelFor(task,signal){
 const ids=await freeModels({signal});
 return chooseModel(ids,task);
}
module.exports={API,FREE_IDS,configured,zeroCost,freeModels,chooseModel,modelFor};
