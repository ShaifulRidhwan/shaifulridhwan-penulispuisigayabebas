"use strict";
/* Cloudflare D1 globally aggregated provider stats. No prompts, replies, IPs,
 * per-user identifiers, raw tokens or secrets are stored. Human quality ratings
 * are written ONLY by a developer CLI; never from public chat/API payloads. */
const PROVIDERS=new Set(["groq","openrouter","requesty"]);
const TASKS=new Set(["general","conversation","technical","research","creative","critique","explain","philosophy","decision"]);
function normalTask(task){return TASKS.has(task)?task:"general";}
function config(env=process.env){
 const account=String(env.CLOUDFLARE_ACCOUNT_ID||"");
 const database=String(env.AKSARA_CF_D1_DATABASE_ID||"");
 const token=String(env.AKSARA_CF_METRICS_TOKEN||"");
 return /^[a-f0-9]{32}$/i.test(account)&&/^[a-f0-9-]{36}$/i.test(database)&&token.length>=12?
  {account,database,token}:null;
}
async function query(sql,params=[],{env=process.env,timeout=1200}={}){
 const c=config(env);if(!c)throw Error("Global metrics database not configured");
 const response=await fetch("https://api.cloudflare.com/client/v4/accounts/"+c.account+
  "/d1/database/"+c.database+"/query",{
  method:"POST",headers:{"Authorization":"Bearer "+c.token,"Content-Type":"application/json"},
  body:JSON.stringify({sql,params:params.map(x=>String(x))}),signal:AbortSignal.timeout(timeout)
 });
 if(!response.ok)throw Error("Global D1 database unavailable");
 const payload=await response.json();
 if(!payload?.success||payload?.result?.[0]?.success!==true)throw Error("Global D1 query failed");
 return Array.isArray(payload.result[0].results)?payload.result[0].results:[];
}
const SCHEMA=[
 "CREATE TABLE IF NOT EXISTS aksara_provider_stats (",
 "provider TEXT NOT NULL,task TEXT NOT NULL,success INTEGER NOT NULL DEFAULT 0,",
 "failure INTEGER NOT NULL DEFAULT 0,latency_total_ms INTEGER NOT NULL DEFAULT 0,",
 "quality_count INTEGER NOT NULL DEFAULT 0,quality_total INTEGER NOT NULL DEFAULT 0,",
 "updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY (provider,task))"
].join(" ");
async function init(options){return query(SCHEMA,[],options);}
async function record(provider,task,{ok,latencyMs=0}={},options={}){
 if(!PROVIDERS.has(provider))return false;
 const t=normalTask(task),success=ok===true?1:0,failure=ok===true?0:1,latency=Number.isFinite(latencyMs)?Math.max(0,Math.min(30000,Math.round(latencyMs))):0;
 try{
  await query("INSERT INTO aksara_provider_stats(provider,task,success,failure,latency_total_ms,updated_at) "+
  "VALUES(?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(provider,task) DO UPDATE SET "+
  "success=success+excluded.success,failure=failure+excluded.failure,"+
  "latency_total_ms=latency_total_ms+excluded.latency_total_ms,updated_at=CURRENT_TIMESTAMP",
  [provider,t,success,failure,latency],options);
  return true;
 }catch{return false;}
}
async function rateByDeveloper(provider,task,rating,options={}){
 if(!PROVIDERS.has(provider)||!Number.isInteger(rating)||rating<1||rating>5)throw Error("Invalid human evaluation; rating 1–5");
 const t=normalTask(task);
 await query("INSERT INTO aksara_provider_stats(provider,task,quality_count,quality_total,updated_at) "+
 "VALUES(?,?,1,?,CURRENT_TIMESTAMP) ON CONFLICT(provider,task) DO UPDATE SET "+
 "quality_count=quality_count+1,quality_total=quality_total+excluded.quality_total,updated_at=CURRENT_TIMESTAMP",
 [provider,t,rating],options);
 return true;
}
function normalizeRows(rows){
 return (Array.isArray(rows)?rows:[]).filter(x=>PROVIDERS.has(x.provider)&&TASKS.has(x.task))
  .map(x=>({provider:x.provider,task:x.task,success:Math.max(0,Number(x.success)||0),
   failure:Math.max(0,Number(x.failure)||0),latencyTotalMs:Math.max(0,Number(x.latency_total_ms)||0),
   qualityCount:Math.max(0,Number(x.quality_count)||0),qualityTotal:Math.max(0,Number(x.quality_total)||0),
   updatedAt:String(x.updated_at||"")}));
}
async function snapshot(options={}){
 const rows=await query("SELECT provider,task,success,failure,latency_total_ms,quality_count,quality_total,updated_at FROM aksara_provider_stats",[],options);
 return normalizeRows(rows);
}
module.exports={PROVIDERS,TASKS,SCHEMA,config,query,init,record,rateByDeveloper,normalizeRows,normalTask,snapshot};
