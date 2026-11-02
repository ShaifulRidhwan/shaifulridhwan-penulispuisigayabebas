"use strict";
/* Capability and time-budget planning; no external probes or secrets. */
const CAPABILITIES=Object.freeze({
 gemini:["chat","url_context","pdf_inline","image_understanding","code_execution","json"],
 groq:["chat","browser_search","code_interpreter"],
 openrouter:["chat","public_url_fetch"],
 workers_ai:["chat","public_rerank_opt_in","ai_gateway_opt_in"],
 local:["calculator","csv_json_analysis","publisher_rss","public_poetry"]
});
function publicNewsEligible(intent){return !!intent?.search&&!intent?.hasLink&&!intent?.sensitive&&!intent?.privateContext&&!intent?.attachment&&!intent?.account;}
function budget({remainingMs=0,groqCooldownSeconds=0,hasGroq=false,hasGoogle=false,hasRss=false}={}){
 const left=Math.max(0,Number(remainingMs)||0),ready=!!hasGroq&&!(groqCooldownSeconds>0);
 // Reserve at least 6.5s for independent Google/RSS and the final response.
 const reserve=(hasGoogle?3200:0)+(hasRss?3000:0)+1200;
 const groqMs=ready?Math.min(7500,Math.max(0,left-reserve)):0;
 return {groqMs,tryGroq:groqMs>=1800,tryGoogle:!!hasGoogle,tryRss:!!hasRss,
   reason:!ready&&hasGroq?"groq_cooldown":ready&&groqMs<1800?"reserve_fallback_time":"normal"};
}
function snapshot({env=process.env,ai=null,manifest={},providers=[]}={}){
 const hasAI=!!ai&&typeof ai.run==="function";
 const allowTools=env.AKSARA_DISABLE_TOOLS!=="true";
 const present=new Set(providers.map(x=>x.id).filter(Boolean));
 return {
  revision:"free-potential-v1",scope:"configuration_not_execution",
  routing:{configured:true,policy:"tool_proof_and_deadline_reservation"},
  multiUrl:{enabled:manifest.gemini?.urlContext===true,maxUrls:5,requiresPerUrlProof:true},
  documents:{inlinePdf:allowTools,maxInlineBytes:3600000,filesApiLargeUpload:"not_integrated"},
  semantic:{lexical:true,workersRerankReady:hasAI,
    workersRerankEnabled:hasAI&&env.AKSARA_WORKERS_RERANK_ENABLED==="true"},
  data:{localCsvJson:true,median:true,missingValues:true,groupSummary:true},
  gateway:{supported:hasAI,enabled:hasAI&&env.AKSARA_WORKERS_GATEWAY_ENABLED==="true",scope:"workers_ai_only",logs:"disabled"},
  diagnostics:{configuredProviders:[...present],confidence:"configured_not_verified"}
 };
}
module.exports={CAPABILITIES,publicNewsEligible,budget,snapshot};