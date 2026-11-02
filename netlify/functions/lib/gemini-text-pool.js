"use strict";
// Text-chat-only Gemini credential pool. Voice Live keeps GEMINI_API_KEY and
// its existing handler/configuration unchanged. Never expose raw credentials.
const SECRET_NAMES=Object.freeze([
  "GEMINI_API_KEY","GEMINI_API_KEY_2","GEMINI_API_KEY_3","GEMINI_API_KEY_4"
]);
function createPool(){
  let cursor=0;
  const health=new Map();
  function configured(env=process.env){
    const seen=new Set();
    return SECRET_NAMES.map((name,index)=>({slot:index+1,apiKey:typeof env[name]==="string"?env[name].trim():""}))
      .filter(entry=>{
        if(!entry.apiKey||seen.has(entry.apiKey))return false;
        seen.add(entry.apiKey);
        return true;
      });
  }
  function pick(env=process.env){
    const entries=configured(env);
    if(!entries.length)return null;
    const start=cursor++%entries.length;
    for(let i=0;i<entries.length;i++){
      const entry=entries[(start+i)%entries.length];
      if((health.get(entry.slot)?.blockedUntil||0)<=Date.now())return entry;
    }
    return null;
  }
  function success(slot){
    if(Number.isInteger(slot))health.set(slot,{status:"online",blockedUntil:0});
  }
  function failure(slot,error={}){
    if(!Number.isInteger(slot))return;
    const auth=[401,403].includes(error.status)||error.googleCategory==="credential_or_access";
    // Only credential/access problems quarantine a slot. A 429 is never used
    // to move this request to another key; Google's quota remains authoritative.
    health.set(slot,{status:auth?"access_error":"degraded",
      blockedUntil:auth?Date.now()+300000:0});
  }
  function snapshot(env=process.env){
    return configured(env).map(({slot})=>{
      const state=health.get(slot);
      const blocked=!!state&&state.blockedUntil>Date.now();
      return {slot,status:blocked?"access_error":state?.status==="online"?"online":state?.status==="degraded"?"degraded":"ready"};
    });
  }
  return {configured,pick,success,failure,snapshot};
}
module.exports=createPool();
module.exports.createPool=createPool;
