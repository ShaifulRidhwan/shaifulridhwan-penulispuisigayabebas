"use strict";
const crypto=require("node:crypto");
const Policy=require("./policy");
const Owner=require("./owner-auth");
const Budget=require("./budget");
function status(env=process.env){
  const enabled=env.AKSARA_AGENT_ENABLED==="true";
  const ownerReady=Owner.configured(env);
  const configured=Policy.providers(env);
  // Public status reveals no API keys, bearer secret or private user data.
  return {
    name:"AKSARA AGENTIC ABSOLUTE CORE V1",platform:"android-native",
    enabled,ownerAuthRequired:true,ownerAuthConfigured:ownerReady,
    readyForOwnerMission:enabled&&ownerReady&&configured.length>0,
    engines:["vercel-ai-sdk","deepagents-js"],
    configuredProviders:configured.map(x=>x.id),
    privacy:{personalMemory:false,filesystem:"virtual-only",githubWrites:false,
      linuxShell:false,novelLibraryAccess:false},
    quotas:{dailyCap:Budget.cap(env),backingStore:"Netlify Blobs (strong read, last-writer-wins)",
      hardDistributedAtomic:false,perInstanceMinute:3},
    note:"Preview restricted to owner bearer secret. Use free-only provider quotas; do not enable paid fallback."
  };
}
const error=(status,message,category)=>Object.assign(new Error(message),{status,category});
async function execute(body,{env=process.env,headers={},budgetStore=null}={}){
  if(env.AKSARA_AGENT_ENABLED!=="true")throw error(503,"Agentic Core belum diaktifkan pada backend.","disabled");
  // Authorize BEFORE parsing mission, burning quota or invoking a provider.
  const ownerId=Owner.authenticate(headers,env);
  const input=Policy.validate(body);
  const configs=Policy.providers(env);
  if(!configs.length)throw error(503,"Tiada model Agentic percuma yang disahkan tersedia.","provider_unavailable");
  const admission=Policy.admit(headers);
  if(!admission.ok)throw Object.assign(error(429,"Had misi sementara dicapai. Cuba lagi kemudian.","rate_limited"),
    {retryAfter:admission.retryAfter});
  // Netlify Blobs strongly-consistent reads + writes, fail closed if unavailable.
  // Blobs lacks compare-and-swap. Owner-only beta and provider free quotas remain
  // necessary; this is not a mathematically strict distributed quota guarantee.
  const budget=await Budget.reserve(ownerId,{env,store:budgetStore});
  const selected=configs[0],controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(new Error("Had masa misi telah dicapai.")),input.limits.ms);
  const started=Date.now();
  try{
    const mod=await import("./engines.mjs");
    const runtime=input.mode==="deep"?mod.runDeep:mod.runSdk;
    const outcome=await runtime({mission:input.mission,limits:input.limits,
      provider:selected,signal:controller.signal});
    const validTools=outcome.state.trace.filter(e=>e.ok).length;
    const text=String(outcome.text||"").slice(0,18000),complete=Boolean(text.trim());
    return {id:crypto.randomUUID(),
      status:complete?(validTools?"completed":"answered_without_tools"):"partial",
      mode:input.mode,engine:outcome.engine,provider:outcome.provider,model:outcome.model,
      response:complete?text:"Model tidak memberikan jawapan akhir yang dapat disahkan.",
      steps:outcome.state.trace.slice(0,input.limits.toolCalls),
      sources:outcome.state.sources.slice(0,8),usage:outcome.state.statistics(),
      elapsedMs:Date.now()-started,verifiedToolActions:validTools,
      quota:{usedToday:budget.spent,dailyCap:budget.dailyCap},
      privacy:{memoryStored:false,writesExecuted:false}};
  }catch(failure){
    const timeout=controller.signal.aborted;
    const msg=String(failure?.message||"");
    const category=timeout?"timeout":/429|rate.limit|quota/i.test(msg)?"quota":
      /tool.?call|function.?call|unsupported|model/i.test(msg)?"provider_incompatible":"runtime";
    const err=error(timeout?504:category==="quota"?429:502,
      timeout?"Misi tamat masa dengan selamat.":"Agent gagal: "+category+". Semak provider dan log backend.",category);
    // No raw upstream exception, bearer, private prompt, or API credentials in public response.
    throw err;
  }finally{clearTimeout(timer);}
}
module.exports={status,execute};
