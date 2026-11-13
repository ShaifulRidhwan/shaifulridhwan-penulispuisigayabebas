"use strict";
const crypto=require("node:crypto");
const Policy=require("./policy");
function status(env=process.env){
  const configured=Policy.providers(env);
  return {name:"AKSARA AGENTIC ABSOLUTE CORE V1",platform:"android-native",enabled:env.AKSARA_AGENT_ENABLED==="true",
    engines:["vercel-ai-sdk","deepagents-js"],configuredProviders:configured.map(x=>x.id),
    privacy:{personalMemory:false,filesystem:"virtual-only",githubWrites:false,linuxShell:false,novelLibraryAccess:false},
    quotas:{perInstanceDay:12,perInstanceMinute:3,persistentDistributedQuota:false},
    note:"Backend authorization and distributed rate limiting are required before public rollout."};
}
async function execute(body,{env=process.env,headers={}}={}){
  const input=Policy.validate(body);
  if(env.AKSARA_AGENT_ENABLED!=="true")throw Object.assign(Error("Agentic Core belum diaktifkan pada backend."),{status:503});
  const admission=Policy.admit(headers);
  if(!admission.ok)throw Object.assign(Error("Had misi sementara dicapai. Cuba lagi kemudian."),{status:429,retryAfter:admission.retryAfter});
  const configs=Policy.providers(env);
  if(!configs.length)throw Object.assign(Error("Tiada model Agentic percuma yang disahkan tersedia."),{status:503});
  const selected=configs[0],controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(new Error("Had masa misi telah dicapai.")),input.limits.ms);
  const started=Date.now();
  try{
    const mod=await import("./engines.mjs");
    const runtime=input.mode==="deep"?mod.runDeep:mod.runSdk;
    const outcome=await runtime({mission:input.mission,limits:input.limits,provider:selected,signal:controller.signal});
    const evidence=outcome.state.trace.filter(e=>e.ok).length;
    const text=String(outcome.text||"").slice(0,18000),complete=Boolean(text.trim());
    return {id:crypto.randomUUID(),status:complete?(evidence?"completed":"answered_without_tools"):"partial",
      mode:input.mode,engine:outcome.engine,provider:outcome.provider,model:outcome.model,
      response:complete?text:"Model tidak memberikan jawapan akhir yang dapat disahkan.",
      steps:outcome.state.trace.slice(0,input.limits.toolCalls),sources:outcome.state.sources.slice(0,8),
      usage:outcome.state.statistics(),elapsedMs:Date.now()-started,verifiedToolActions:evidence,
      privacy:{memoryStored:false,writesExecuted:false}};
  }catch(error){
    const timeout=controller.signal.aborted;
    const category=timeout?"timeout":/429|rate.limit|quota/i.test(String(error.message))?"quota":
      /tool.?call|function.?call|unsupported|model/i.test(String(error.message))?"provider_incompatible":"runtime";
    const err=Error(timeout?"Misi tamat masa dengan selamat.":("Agent gagal: "+category+". Semak provider dan log backend."));
    err.status=timeout?504:category==="quota"?429:502;
    err.category=category;
    throw err;
  }finally{clearTimeout(timer);}
}
module.exports={status,execute};