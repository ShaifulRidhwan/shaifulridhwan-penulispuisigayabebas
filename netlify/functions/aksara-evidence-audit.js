"use strict";
/* Evidence levels describe tool evidence, NOT objective truth or a confidence score. */
const PAGE_TOOLS=new Set(["owned_page_html","tavily_extract"]);
const SEARCH_TOOLS=new Set(["google_search","browser_search","groq_browser_search","tavily_search","publisher_rss","wikipedia_summary"]);
function safeUrl(value){
 try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password?u.href:"";}
 catch(_){return "";}
}
function summarize(data={}){
 const sources=Array.isArray(data.sources)?data.sources:[];
 const valid=[...new Set(sources.map(s=>safeUrl(s?.url)).filter(Boolean))];
 const tools=new Set(Array.isArray(data.toolsUsed)?data.toolsUsed.filter(x=>typeof x==="string"):[]);
 const pageRead=[...PAGE_TOOLS].some(t=>tools.has(t))||
  (tools.has("url_context")&&data.urlTrace?.status==="success");
 const grounded=tools.has("google_search")&&valid.length>0;
 const search=[...SEARCH_TOOLS].some(t=>tools.has(t));
 const level=pageRead&&valid.length?"page_text":grounded?"grounded_search":
  search&&valid.length?"search_excerpt":valid.length?"links_only":"no_external_evidence";
 return Object.freeze({level,sourceCount:valid.length,pageReadConfirmed:level==="page_text",
  claimAccuracyVerified:false,scope:"tool_metadata_not_fact_verification"});
}
module.exports={safeUrl,summarize};
