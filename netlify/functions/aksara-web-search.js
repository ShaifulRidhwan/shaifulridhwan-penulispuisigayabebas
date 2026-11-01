"use strict";
/* Optional public-web search only. No arbitrary URL fetching, scraping, private
 * history, uploads or secrets forwarded. Disabled unless owner opts in. */
const SEARCH_ENDPOINT="https://api.search.brave.com/res/v1/web/search";
function eligible(q,{env=process.env,attachment=false,privateContext=false,sensitive=false,hasLink=false}={}){
 const query=String(q||"").trim();
 return env.AKSARA_WEB_SEARCH_ENABLED==="true"&&!!env.BRAVE_SEARCH_API_KEY&&
  !attachment&&!privateContext&&!sensitive&&!hasLink&&
  query.length>=4&&query.length<=180&&
  !/https?:|@|(?:\+?\d[\s().-]*){8,}|(?:api.?key|token|password|kata laluan|rahsia|private|peribadi|alamat rumah)/i.test(query);
}
function curate(payload){
 const seen=new Set();
 return (Array.isArray(payload?.web?.results)?payload.web.results:[]).flatMap(item=>{
  let uri;try{uri=new URL(item.url);}catch(_){return [];}
  if(uri.protocol!=="https:"||uri.username||uri.password||!uri.hostname.includes(".")||
    seen.has(uri.href))return [];
  seen.add(uri.href);
  const clean=s=>String(s||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
  const title=clean(item.title).slice(0,130);
  const extract=clean(item.description).slice(0,550);
  if(!title||!extract)return [];
  return [{id:"WEB-"+seen.size,title,url:uri.href,extract,kind:"search-snippet",verifiedLive:false}];
 }).slice(0,4);
}
async function search(query,options={}){
 const env=options.env||process.env,allowed=eligible(query,{...options,env});
 if(!allowed)return {status:"not-configured-or-ineligible",sources:[]};
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3300);
 if(options.signal?.aborted)controller.abort();
 const onAbort=()=>controller.abort();
 options.signal?.addEventListener?.("abort",onAbort,{once:true});
 try{
  const response=await (options.fetchImpl||fetch)(SEARCH_ENDPOINT+"?q="+encodeURIComponent(query)+"&count=4&search_lang=en",{
   method:"GET",redirect:"manual",signal:controller.signal,
   headers:{"Accept":"application/json","X-Subscription-Token":env.BRAVE_SEARCH_API_KEY}
  });
  if(!response.ok)return {status:"unavailable",sources:[]};
  const data=await response.json();
  const sources=curate(data);
  return {status:sources.length?"search-snippets":"no-results",sources};
 }catch(_){return {status:"unavailable",sources:[]};}
 finally{clearTimeout(timer);options.signal?.removeEventListener?.("abort",onAbort);}
}
module.exports={eligible,curate,search};
