"use strict";
// Durable monthly guardrail. Count attempted basic calls conservatively; no
// prompts, URLs, IPs, account identifiers or secrets are saved in the store.
const DEFAULT_LIMIT=700;
async function reserve({store,cap=DEFAULT_LIMIT,now=Date.now()}={}){
 if(!store||typeof store.getWithMetadata!=="function"||typeof store.setJSON!=="function")
  throw Error("Tavily budget store unavailable");
 const requested=Number(cap);
 const limit=Number.isFinite(requested)?Math.max(0,Math.min(700,Math.floor(requested))):DEFAULT_LIMIT;
 const month=new Date(now).toISOString().slice(0,7),key="tavily/month/"+month;
 for(let attempt=0;attempt<10;attempt++){
  let current;
  try{current=await store.getWithMetadata(key,{type:"json",consistency:"strong"});}
  catch(_){throw Error("Tavily budget store read failed");}
  const used=Number(current?.data?.used)||0;
  if(used>=limit)throw Error("Tavily monthly budget exhausted");
  let saved;
  try{saved=await store.setJSON(key,{used:used+1},
    current?{onlyIfMatch:current.etag}:{onlyIfNew:true});}
  catch(_){throw Error("Tavily budget store write failed");}
  if(saved?.modified)return {used:used+1,limit};
 }
 throw Error("Tavily monthly budget busy");
}
module.exports={reserve};
