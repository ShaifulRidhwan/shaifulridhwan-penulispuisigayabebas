"use strict";
/* Private ops report, never exposed by a public Netlify endpoint.
 * Approximate latency buckets, not precise p50/p95 measurements.
 */
const Telemetry=require("../netlify/functions/aksara-telemetry-v6");
function decode(reply){
 if(!reply||!Array.isArray(reply.result))return null;
 const x={};for(let i=0;i<reply.result.length-1;i+=2){
  const key=reply.result[i],value=Number(reply.result[i+1]);
  if(typeof key==="string"&&/^(?:request|http:(?:2xx|4xx|5xx|429)|provider:[a-z_]+|latency:(?:le1s|le3s|le8s|le16s|gt16s)|mode:[a-z-]+)$/.test(key)&&
    Number.isFinite(value)&&value>=0)x[key]=value;
 }
 return x;
}
function percentileBand(x,p){
 const bands=["le1s","le3s","le8s","le16s","gt16s"];
 const total=bands.reduce((n,k)=>n+(x?.["latency:"+k]||0),0);
 if(!total)return null;
 let seen=0;for(const k of bands){seen+=x["latency:"+k]||0;if(seen/total>=p)return k;}
 return "gt16s";
}
function render(x){
 if(!x)return {available:false};
 const n=x.request||0;
 return {available:true,scope:"cross_instance_aggregate_if_redis_configured",requests:n,
  success2xx:x["http:2xx"]||0,errors4xx:x["http:4xx"]||0,errors429:x["http:429"]||0,
  errors5xx:x["http:5xx"]||0,providers:Object.fromEntries(["gemini","groq","workers_ai","openrouter","local"].map(k=>[k,x["provider:"+k]||0])),
  fallback:x["mode:fallback"]||0,latencyP50Band:percentileBand(x,0.5),latencyP95Band:percentileBand(x,0.95),
  percentilesExact:false,comment:"Bins approximate; do not use as exact measured percentile."};
}
async function fetchReport({date=new Date().toISOString().slice(0,10),env=process.env,fetchImpl=fetch}={}){
 const config=Telemetry.config(env);
 if(!config.enabled)throw Error("Telemetry disabled or Redis credentials unavailable");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+"T00:00:00Z").toISOString().slice(0,10)!==date)throw Error("Invalid ISO date");
 const key="aksara:ops:v6:"+date.replaceAll("-","");
 const r=await fetchImpl(config.url,{method:"POST",headers:{"content-type":"application/json",Authorization:"Bearer "+config.token},
   body:JSON.stringify(["HGETALL",key])});
 if(!r.ok)throw Error("Aggregate store unavailable");
 return {date,...render(decode(await r.json()))};
}
if(require.main===module){
 const a=process.argv.find(x=>x.startsWith("--date="))?.slice(7);
 fetchReport({...(a?{date:a}:{})}).then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
}
module.exports={decode,percentileBand,render,fetchReport};
