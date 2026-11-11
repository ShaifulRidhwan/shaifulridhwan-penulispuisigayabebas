"use strict";
/* P1: Instance-local transient-failure breaker. No key rotation, new API
 * requests, cross-user state, paid bypass, private content or retry of streams. */
const STATES=new Map();
const PROVIDERS=new Set(["groq","openrouter","workers_ai"]);
const RESET_MS=30*60*1000;
function transient(status,reason=""){
 const code=Number(status)||0;
 return [0,408,500,502,503,504].includes(code)||
  /^(?:timeout|upstream|AbortError|ECONNRESET|ETIMEDOUT)$/.test(String(reason));
}
function failure(provider,{status=0,reason="",now=Date.now()}={}){
 if(!PROVIDERS.has(provider)||!transient(status,reason))
  return {retryMs:0,consecutive:0,open:false};
 const prior=STATES.get(provider);
 const count=prior&&now-prior.lastAt<RESET_MS?prior.consecutive+1:1;
 // The original router already waits after the first failure.
 const retryMs=count>=2?Math.min(120000,15000*Math.pow(2,Math.min(count-2,3))):0;
 const row={consecutive:count,lastAt:now,until:now+retryMs};
 STATES.set(provider,row);
 return {retryMs,consecutive:count,open:retryMs>0};
}
function canAttempt(provider,now=Date.now()){
 if(!PROVIDERS.has(provider))return true;
 const row=STATES.get(provider);
 if(!row)return true;
 if(now-row.lastAt>=RESET_MS){STATES.delete(provider);return true;}
 return now>=row.until;
}
function success(provider){STATES.delete(provider);}
function diagnostics(now=Date.now()){
 return [...STATES].map(([provider,row])=>({provider,consecutive:row.consecutive,
  retryAfterSeconds:Math.ceil(Math.max(0,row.until-now)/1000)}));
}
module.exports={failure,canAttempt,success,diagnostics,transient};
