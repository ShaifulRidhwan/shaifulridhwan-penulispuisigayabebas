"use strict";
/* P1: Each router owns its instance-local breaker. No provider API calls,
 * private data, paid bypass or stream retry. create() prevents state leakage
 * across independent router lifecycles and deterministic test fixtures. */
const PROVIDERS=new Set(["groq","openrouter","workers_ai"]);
const RESET_MS=30*60*1000;
function transient(status,reason=""){
 const code=Number(status)||0;
 return [0,408,500,502,503,504].includes(code)||
  /^(?:timeout|upstream|AbortError|ECONNRESET|ETIMEDOUT)$/.test(String(reason));
}
function create(){
 const states=new Map();
 function failure(provider,{status=0,reason="",now=Date.now()}={}){
  if(!PROVIDERS.has(provider)||!transient(status,reason))
   return {retryMs:0,consecutive:0,open:false};
  const prior=states.get(provider);
  const count=prior&&now-prior.lastAt<RESET_MS?prior.consecutive+1:1;
  const retryMs=count>=2?Math.min(120000,15000*Math.pow(2,Math.min(count-2,3))):0;
  states.set(provider,{consecutive:count,lastAt:now,until:now+retryMs});
  return {retryMs,consecutive:count,open:retryMs>0};
 }
 function canAttempt(provider,now=Date.now()){
  if(!PROVIDERS.has(provider))return true;
  const row=states.get(provider);
  if(!row)return true;
  if(now-row.lastAt>=RESET_MS){states.delete(provider);return true;}
  return now>=row.until;
 }
 function success(provider){states.delete(provider);}
 function diagnostics(now=Date.now()){
  return [...states].map(([provider,row])=>({provider,consecutive:row.consecutive,
   retryAfterSeconds:Math.ceil(Math.max(0,row.until-now)/1000)}));
 }
 return {failure,canAttempt,success,diagnostics,transient};
}
module.exports={...create(),create,transient};
