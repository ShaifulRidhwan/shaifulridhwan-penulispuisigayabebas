"use strict";
/* Optional aggregated cross-instance operational counters. No prompt, IP, URL,
 * image, history, transcript, model name or token is written to Redis.
 * Disabled by default. Fail-open: observability must not break chat.
 */
const LUA="for i=1,tonumber(ARGV[1]) do redis.call('HINCRBY',KEYS[1],ARGV[i+1],1) end;redis.call('EXPIRE',KEYS[1],172800);return 1";
const PROVIDERS=new Set(["gemini","groq","openrouter","workers_ai","local","local_knowledge"]);
const MODES=new Set(["live","fallback","local-limitation","grounded-search","public-rss","grounded-poetry"]);
function config(env=process.env){
 if(env.AKSARA_V6_TELEMETRY!=="true")return {enabled:false};
 let uri;
 try{uri=new URL(env.AKSARA_V5_REDIS_REST_URL||"");}catch(_){return {enabled:false,reason:"missing_url"};}
 if(uri.protocol!=="https:"||uri.username||uri.password||uri.search||!/(^|\.)upstash\.io$/i.test(uri.hostname))
  return {enabled:false,reason:"unapproved_url"};
 const token=String(env.AKSARA_V5_REDIS_REST_TOKEN||"");
 if(token.length<12)return {enabled:false,reason:"missing_secret"};
 return {enabled:true,url:uri.origin,token};
}
function bucket({response,elapsedMs=0,now=Date.now()}={}){
 const code=Number(response?.statusCode)||0;
 let data={};try{data=JSON.parse(String(response?.body||"{}"));}catch(_){}
 // Health/probe and non-chat calls excluded. Never inspect the request body.
 if(!(typeof data.reply==="string"||code>=400))return null;
 const provider=PROVIDERS.has(data.provider)?data.provider:"other";
 const kind=code>=500?"5xx":code===429?"429":code>=400?"4xx":"2xx";
 const latency=Math.max(0,Math.min(120000,Number(elapsedMs)||0));
 const latencyBucket=latency<=1000?"le1s":latency<=3000?"le3s":latency<=8000?"le8s":latency<=16000?"le16s":"gt16s";
 const mode=MODES.has(data.mode)?data.mode:"other";
 const day=new Date(now).toISOString().slice(0,10).replaceAll("-","");
 return {key:"aksara:ops:v6:"+day,fields:["request","http:"+kind,"provider:"+provider,"latency:"+latencyBucket,
  "mode:"+mode],expiresInSeconds:172800,scope:"anonymized_global_bucket"};
}
async function record({response,elapsedMs=0,env=process.env,fetchImpl=fetch,now=Date.now()}={}){
 const cfg=config(env);if(!cfg.enabled)return {recorded:false,reason:cfg.reason||"off"};
 const sample=bucket({response,elapsedMs,now});if(!sample)return {recorded:false,reason:"excluded"};
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),650);
 try{
  const res=await fetchImpl(cfg.url,{method:"POST",
   headers:{"Content-Type":"application/json",Authorization:"Bearer "+cfg.token},
   body:JSON.stringify(["EVAL",LUA,"1",sample.key,String(sample.fields.length),...sample.fields]),
   signal:controller.signal});
  if(!res.ok)return {recorded:false,reason:"upstream_unavailable"};
  const body=await res.json();
  return {recorded:body?.result===1,scope:"global_aggregate_only"};
 }catch(_){return {recorded:false,reason:"request_failed"};}
 finally{clearTimeout(timer);}
}
module.exports={config,bucket,record};
