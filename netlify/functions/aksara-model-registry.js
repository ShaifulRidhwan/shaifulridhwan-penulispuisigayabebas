"use strict";
/* Adaptive Model Registry 3.0. Availability/reliability observations are NOT
 * answer-quality scores. No persistent user data, external telemetry or paid calls. */
const CAPS=Object.freeze({
 groq:Object.freeze({reasoning:"high",text:true,vision:false,cost:"verified-free-only"}),
 openrouter:Object.freeze({reasoning:"variable",text:true,vision:true,cost:"free-pool"}),
 workers_ai:Object.freeze({reasoning:"high",text:true,vision:false,cost:"shared-neurons-allocation"})
});
const WINDOW_MS=30*60*1000;
const samples=new Map();
function current(id,now=Date.now()){
 const entry=samples.get(id);
 return entry&&now-entry.lastAt<WINDOW_MS?entry:{success:0,failure:0,avgMs:0,lastAt:0};
}
function observe(id,{ok,latencyMs}={}){
 if(!Object.hasOwn(CAPS,id)||typeof ok!=="boolean")return;
 const now=Date.now(),old=current(id,now);
 // Decay rather than letting a long-lived process hold stale failures forever.
 const decay=old.success+old.failure>=60?0.5:1;
 const sample={success:Math.floor(old.success*decay)+(ok?1:0),
  failure:Math.floor(old.failure*decay)+(ok?0:1),avgMs:old.avgMs,lastAt:now};
 if(ok&&Number.isFinite(latencyMs)&&latencyMs>0){
  const ms=Math.min(latencyMs,30000);
  sample.avgMs=Math.round(old.avgMs?old.avgMs*0.8+ms*0.2:ms);
 }
 samples.set(id,sample);
}
function select(providers,{task="general",thinking="low",prefer="",last="",images=false}={}){
 const list=Array.isArray(providers)?providers.filter(x=>x&&Object.hasOwn(CAPS,x.id)&&(!images||CAPS[x.id].vision)):[];
 const heavy=thinking==="high";
 const score=p=>{
  const c=CAPS[p.id],m=current(p.id),total=m.success+m.failure;
  let n=0;
  if(heavy)n+=c.reasoning==="high"?30:5;
  if(p.id===prefer)n+=heavy?9:22;
  if(!heavy&&p.id===last)n+=8;
  if(task==="technical"&&p.id==="groq")n+=7;
  if(["critique","hypothetical"].includes(task)&&p.id==="workers_ai")n+=5;
  if(task==="conversation"&&p.id==="groq")n+=3;
  // Penalize demonstrated failures, never mistake successful HTTP responses
  // for correctness, and avoid trusting fewer than three observations.
  if(total>=3)n+=12*(m.success/total)-22*(m.failure/total);
  if(!heavy&&m.avgMs)n-=Math.min(8,m.avgMs/3000);
  return n;
 };
 return [...list].sort((a,b)=>score(b)-score(a));
}
function diagnostics(){
 return [...samples.keys()].map(provider=>({provider,...current(provider)}));
}
module.exports={CAPS,select,observe,diagnostics};
