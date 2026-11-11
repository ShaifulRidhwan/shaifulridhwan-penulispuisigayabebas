"use strict";
/* P0: Bounded execution of existing Gemini public-knowledge function calls.
 * One model-response round only; no network, private-memory access, writes,
 * recursive planning, new providers or extra LLM requests. */
const SafeTools=require("./aksara-safe-tools");
const Capabilities=require("./aksara-capabilities");
function run(calls,{limit=2}={}){
 const valid=Array.isArray(calls)?calls:[];
 const cap=Math.max(1,Math.min(2,Number.isInteger(limit)?limit:2));
 const seen=new Set(),responses=[];
 for(const call of valid){
  if(responses.length>=cap)break;
  if(!call||call.name!==Capabilities.FUNCTION_NAME)continue;
  const args=call.args;
  if(!args||typeof args!=="object"||Array.isArray(args))continue;
  const query=typeof args.query==="string"?args.query.trim():"";
  if(!query||query.length>300)continue;
  const key=query.toLocaleLowerCase("ms-MY");
  if(seen.has(key))continue;
  seen.add(key);
  const outcome=SafeTools.execute({
   name:Capabilities.FUNCTION_NAME,arguments:{query}
  },{enabled:true,allowKnowledge:true,
    knowledgeOptions:{includePublic:true,allowPrivate:false,limit:3}});
  responses.push({name:Capabilities.FUNCTION_NAME,
   response:outcome.ok?{results:outcome.results}:{error:outcome.error},
   executed:outcome.ok});
 }
 return {responses,executedCount:responses.filter(r=>r.executed).length,
  bounded:true,privateMemoryAllowed:false,extraProviderRequests:0};
}
module.exports={run};
