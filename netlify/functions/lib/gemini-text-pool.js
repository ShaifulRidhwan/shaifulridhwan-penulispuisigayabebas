"use strict";
// A chat-only Gemini credential pool. Never put API keys in public status.
const SECRET_NAMES=Object.freeze([
  "GEMINI_API_KEY","GEMINI_API_KEY_2","GEMINI_API_KEY_3","GEMINI_API_KEY_4"
]);
const safeReason=value=>/^[a-z][a-z0-9_]{0,63}$/.test(String(value||""))?String(value):"upstream_error";
const safeNumber=(value,max)=>Number.isFinite(value)&&value>=0?Math.min(Math.round(value),max):null;
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
  function success(slot,details={}){
    if(!Number.isInteger(slot))return;
    health.set(slot,{status:"online",blockedUntil:0,checkedAt:Date.now(),
      model:typeof details.model==="string"?details.model.slice(0,80):"",
      latencyMs:safeNumber(details.latencyMs,120000),http:200,reason:""});
  }
  function ready(slot,details={}){
    if(!Number.isInteger(slot))return;
    const old=health.get(slot);
    if(old?.status==="online"&&Date.now()-old.checkedAt<90000)return;
    health.set(slot,{status:"ready",blockedUntil:0,checkedAt:Date.now(),
      model:typeof details.model==="string"?details.model.slice(0,80):"",
      latencyMs:safeNumber(details.latencyMs,120000),
      http:safeNumber(details.http,599),reason:safeReason(details.reason||"empty_reply")});
  }
  function failure(slot,error={},details={}){
    if(!Number.isInteger(slot))return;
    const auth=[401,403].includes(error.status)||error.googleCategory==="credential_or_access";
    const permanent=[400,401,403,404].includes(error.status);
    const upstreamCode=/^[A-Z][A-Z0-9_]{2,63}$/.test(String(error.googleStatus||""))?error.googleStatus:null;
    const upstreamReason=/^[A-Z][A-Z0-9_]{2,63}$/.test(String(error.googleReason||""))?error.googleReason:null;
    const category=error.googleCategory?safeReason(error.googleCategory):null;
    // Never reattempt a quota 429 with a different key in the same request.
    const http=safeNumber(error.status,599);
    health.set(slot,{status:permanent?"offline":"degraded",
      blockedUntil:auth?Date.now()+300000:http===429?Date.now()+Math.min(300000,Math.max(1000,Number(error.retryAfterSeconds||60)*1000)):0,checkedAt:Date.now(),
      model:typeof details.model==="string"?details.model.slice(0,80):"",
      latencyMs:safeNumber(details.latencyMs,120000),http,upstreamCode,upstreamReason,category,
      reason:safeReason(details.reason||(
        auth?"authentication_or_access":http===429?"health_probe_quota":http===503?"health_upstream_busy":
        error.name==="AbortError"?"health_timeout":"upstream_error"))});
  }
  function snapshot(env=process.env,model=""){
    const now=Date.now();
    return configured(env).map(({slot})=>{
      const data=health.get(slot),blocked=!!data&&data.blockedUntil>now;
      const state=blocked?"offline":data?.status==="online"&&now-data.checkedAt<90000?"online":
        data?.status==="offline"?(data?.blockedUntil&&now>=data.blockedUntil?"ready":"offline"):
        data?.status==="degraded"?"degraded":"ready";
      return {slot,status:state,model:data?.model||model||null,
        ...(data?.checkedAt?{checkedAt:data.checkedAt}:{}),
        ...(data?.latencyMs!==null&&data?.latencyMs!==undefined?{latencyMs:data.latencyMs}:{}),
        ...(data?.http?{http:data.http}:{}),
        ...(data?.reason?{reason:data.reason}:{}),
        ...(data?.upstreamCode?{upstreamCode:data.upstreamCode}:{}),
        ...(data?.upstreamReason?{upstreamReason:data.upstreamReason}:{}),
        ...(data?.category?{category:data.category}:{})};
    });
  }
  return {configured,pick,success,ready,failure,snapshot};
}
module.exports=createPool();
module.exports.createPool=createPool;
