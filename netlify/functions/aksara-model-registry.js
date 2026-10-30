"use strict";
/* Intelligence Router 2.0 capability map. Costs, modality and evidence outrank
 * a model name; the dynamic free OpenRouter pool is not assumed to reason. */
const CAPS=Object.freeze({
 groq:Object.freeze({reasoning:"high",text:true,vision:false,cost:"verified-free-only"}),
 openrouter:Object.freeze({reasoning:"variable",text:true,vision:true,cost:"free-pool"}),
 requesty:Object.freeze({reasoning:"unknown",text:true,vision:false,cost:"verified-free-only"})
});
const Global=require("./aksara-global-performance");
const samples=new Map();
let globalRows=[],lastGlobalRead=0,globalPending=null;
async function refreshGlobal({force=false,env=process.env,timeout=650}={}){
 if(!Global.config(env))return false;
 if(!force&&Date.now()-lastGlobalRead<90000)return globalRows.length>0;
 if(globalPending)return globalPending;
 globalPending=(async()=>{
  try{const rows=await Global.snapshot({env,timeout});globalRows=rows;lastGlobalRead=Date.now();return true;}
  catch{lastGlobalRead=Date.now();return false;}
  finally{globalPending=null;}
 })();
 return globalPending;
}
function globalScore(provider,task){
 const t=Global.normalTask(task);
 const exact=globalRows.find(x=>x.provider===provider&&x.task===t);
 const fallback=globalRows.find(x=>x.provider===provider&&x.task==="general");
 const row=exact||fallback;
 if(!row)return 0;
 const observations=row.success+row.failure;
 const reliability=observations>=20?(row.success/observations-.75)*15:0;
 // Explicit quality ratings from controlled evaluation have much more weight
 // than provider uptime or speed. At least five independent observations.
 const quality=row.qualityCount>=5?(row.qualityTotal/row.qualityCount-3)*12:0;
 const average=observations>=20?row.latencyTotalMs/observations:0;
 const latency=average?Math.min(4,average/6000):0;
 return Math.max(-30,Math.min(30,quality+reliability-latency));
}
async function recordGlobal(provider,task,detail,{env=process.env,timeout=450}={}){
 if(!Global.config(env)||env.AKSARA_D1_TRACK_USAGE!=="true")return false;
 return Global.record(provider,task,detail,{env,timeout});
}
function observe(id,{ok,latencyMs}={}){
 if(!Object.hasOwn(CAPS,id))return;
 const old=samples.get(id)||{success:0,failure:0,avgMs:0};
 const next={success:old.success+(ok?1:0),failure:old.failure+(ok?0:1),
 avgMs:typeof latencyMs==="number"&&latencyMs>0?Math.round(old.avgMs?old.avgMs*0.8+Math.min(latencyMs,30000)*0.2:Math.min(latencyMs,30000)):old.avgMs};
 samples.set(id,next);
}
function select(providers,{task="general",thinking="low",prefer="",last="",images=false}={}){
 const list=Array.isArray(providers)?providers.filter(x=>x&&Object.hasOwn(CAPS,x.id)):[],heavy=thinking==="high";
 const score=p=>{
  const c=CAPS[p.id],m=samples.get(p.id)||{success:0,failure:0,avgMs:0};
  if(images&&!c.vision)return -1000;
  let n=0;
  if(heavy&&c.reasoning==="high")n+=35;
  if(heavy&&c.reasoning==="variable")n+=5;
  if(!heavy&&p.id===prefer)n+=24;
  if(!heavy&&p.id===last)n+=10;
  if(task==="technical"&&p.id==="groq")n+=5;
  n+=globalScore(p.id,task);
  if(m.success+m.failure>=3)n+=12*(m.success/(m.success+m.failure))-8*(m.failure/(m.success+m.failure));
  if(m.avgMs)n-=Math.min(7,m.avgMs/3500);
  return n;
 };
 return [...list].sort((a,b)=>score(b)-score(a));
}
function diagnostics(){return [...samples].map(([provider,s])=>({provider,success:s.success,failure:s.failure,averageLatencyMs:s.avgMs}));}
module.exports={CAPS,select,observe,diagnostics,refreshGlobal,recordGlobal,globalScore};
