"use strict";
/*
 * Optional atomic per-client rate guard using a Redis-compatible REST EVAL endpoint.
 * Disabled by default. Unlike Netlify Blobs this is cross-instance atomic.
 * No raw IP, prompt, image or chat history is stored; only a salted HMAC key.
 */
const crypto=require("node:crypto");
const LUA="local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end;return n";
function fail(status,message,retryAfterSeconds=60){
 return Object.assign(new Error(message),{status,retryAfterSeconds});
}
function config(env=process.env){
 if(env.AKSARA_V5_GLOBAL_GUARD!=="true")return {enabled:false};
 const endpoint=String(env.AKSARA_V5_REDIS_REST_URL||"");
 let url;try{url=new URL(endpoint);}catch(_){throw fail(503,"Invalid shared guard URL");}
 // Guard must never become an arbitrary outbound proxy.
 if(url.protocol!=="https:"||!/^([a-z0-9-]+\.)*upstash\.io$/i.test(url.hostname)||url.username||url.password||url.search)
  throw fail(503,"Shared guard URL not allowed");
 const secret=String(env.AKSARA_V5_REDIS_REST_TOKEN||"");
 const salt=String(env.AKSARA_V5_RATE_SALT||"");
 if(secret.length<12||salt.length<24)throw fail(503,"Shared guard secrets missing");
 const n=Number(env.AKSARA_V5_PER_MINUTE||"12");
 return {enabled:true,url:url.origin,secret,salt,limit:Number.isFinite(n)?Math.max(1,Math.min(100,Math.floor(n))):12};
}
async function reserve({ip,env=process.env,fetchImpl=fetch,now=Date.now(),signal}={}){
 const cfg=config(env);
 if(!cfg.enabled)return {enabled:false};
 if(typeof ip!=="string"||!ip||ip==="unknown")throw fail(503,"Trusted client IP missing");
 const bucket=Math.floor(now/60000),ttl=125;
 const hash=crypto.createHmac("sha256",cfg.salt).update(ip).digest("hex").slice(0,40);
 const key="aksara:v5:minute:"+bucket+":"+hash;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2000);
 if(signal?.aborted){clearTimeout(timer);throw fail(499,"Aborted");}
 const onAbort=()=>controller.abort();signal?.addEventListener?.("abort",onAbort,{once:true});
 try{
  const response=await fetchImpl(cfg.url,{method:"POST",headers:{"Authorization":"Bearer "+cfg.secret,"Content-Type":"application/json"},
   body:JSON.stringify(["EVAL",LUA,"1",key,String(ttl)]),signal:controller.signal});
  if(!response.ok)throw fail(503,"Shared guard unavailable");
  const body=await response.json(),number=Number(body?.result);
  if(!Number.isFinite(number)||number<1)throw fail(503,"Invalid shared guard response");
  if(number>cfg.limit)throw fail(429,"Shared guard rate exceeded",Math.max(1,60-Math.floor((now%60000)/1000)));
  return {enabled:true,allowed:true,scope:"shared_redis_atomic",limit:cfg.limit};
 }catch(e){if(e.status)throw e;throw fail(503,"Shared guard timed out");}
 finally{clearTimeout(timer);signal?.removeEventListener?.("abort",onAbort);}
}
module.exports={config,reserve};
