"use strict";
/* Token estimates are coarse. Never truncate source, system identity or private history. */
const SAFE_TASKS=new Set(["conversation","general","explain"]);
function estimateChars(value){return Math.ceil(String(value||"").length/4);}
function decide({system="",history=[],question="",intent={},plan={},maxTokens=3000,
  hasMedia=false,hasPrivate=false,hasJson=false,dualPerspective=false,env=process.env}={}){
 const systemEstimatedTokens=estimateChars(system);
 const historyEstimatedTokens=(Array.isArray(history)?history:[]).reduce((n,x)=>n+estimateChars(x?.content),0);
 const questionEstimatedTokens=estimateChars(question);
 const original=Number.isFinite(Number(maxTokens))?Math.max(100,Math.floor(Number(maxTokens))):3000;
 const enabled=env.AKSARA_V6_RESPONSE_EFFICIENCY==="true";
 // Genuine task complexity and privacy are never optimized by an unverified cap.
 const eligible=enabled&&!hasMedia&&!hasPrivate&&!hasJson&&!dualPerspective&&!intent.sensitive&&!intent.hasLink&&!intent.search&&
  !intent.calculate&&!intent.review&&!intent.attachment&&!intent.reaction&&
  plan.thinkingLevel==="low"&&SAFE_TASKS.has(intent.task)&&
  questionEstimatedTokens<=55&&historyEstimatedTokens<=4000;
 const budget=eligible?Math.min(original,1800):original;
 return Object.freeze({maxTokens:budget,eligible,reduced:budget<original,
  scope:"output_budget_only_no_prompt_truncation",
  estimate:{systemTokens:systemEstimatedTokens,historyTokens:historyEstimatedTokens,
   questionTokens:questionEstimatedTokens,approximate:true}});
}
module.exports={estimateChars,decide};
