"use strict";
// Three text primaries (Gemini/Groq/OrcaRouter), one universal free text fallback.
// Capability-first: do not invent quality measurements without live benchmarks.
const PRIMARY=Object.freeze(["gemini","groq","orcarouter"]);
function decide({task="general",thinking="low",prefer="",hasTools=false,hasMedia=false,available=[],enabled=true}={}){
 const active=new Set(Array.isArray(available)?available:[]);
 const primaries=PRIMARY.filter(id=>active.has(id));
 const deep=thinking==="high"&&["technical","critique","hypothetical","research"].includes(task);
 const geminiFirst=hasTools||hasMedia||prefer==="gemini"||deep||
  (primaries.length===1&&primaries[0]==="gemini");
 return {enabled:!!enabled,primaries,backup:active.has("openrouter")?"openrouter":null,
  geminiFirst:enabled?geminiFirst:prefer==="gemini",reason:
   hasTools?"tool_capability":hasMedia?"media_capability":deep?"complex_reasoning":
   prefer==="gemini"?"user_preference":"adaptive_primary_pool"};
}
module.exports={PRIMARY,decide};
