"use strict";
/* AKSARA Web Intelligence: Tavily Search + Extract basic. No credentials, session
 * history, uploads or memory are ever passed to external web tools. */
const API="https://api.tavily.com";
const MAX_QUERY=180,MAX_EXTRACT=8500,CACHE_TTL=10*60*1000;
const cache=new Map();
const clean=s=>String(s||"").replace(/<[^>]*>/g," ").replace(/[\u0000-\u001F\u007F]/g," ").replace(/\s+/g," ").trim();
function safeUrl(value){
 if(typeof value!=="string"||value.length>1800)return null;
 let u;try{u=new URL(value);}catch(_){return null;}
 if(u.protocol!=="https:"||u.username||u.password||u.port&&u.port!=="443")return null;
 const host=u.hostname.toLowerCase().replace(/\.$/,"");
 if(host.length>253||!host.includes(".")||host==="localhost"||/\.(?:localhost|local|internal|test|invalid|example|onion)$/i.test(host)||
    /^(?:\d+\.){3}\d+$/.test(host)||host.includes(":")||!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(host))return null;
 if(/(?:^|[?&#])(?:api_?key|token|access_token|auth|secret|password|key)=/i.test(u.search+"#"+u.hash))return null;
 u.hash="";
 return u.href;
}
function extractUrl(question){
 const match=String(question||"").match(/https:\/\/[^\s<>"'\)\]]+/i);
 return match?safeUrl(match[0].replace(/[.,;!?]+$/,"")):null;
}
function eligible(question,{env=process.env,attachment=false,privateContext=false,sensitive=false,account=false,hasLink=false}={}){
 const q=String(question||"").trim();
 if(!env.TAVILY_API_KEY||attachment||privateContext||sensitive||account)return false;
 if(hasLink)return !!extractUrl(q);
 return q.length>=4&&q.length<=MAX_QUERY&&!/@|https?:|(?:\+?\d[\s().-]*){8,}|(?:api.?key|token|password|kata laluan|rahsia|peribadi|alamat rumah)/i.test(q);
}
function normalize(results,kind){
 const seen=new Set(),output=[];
 for(const r of Array.isArray(results)?results:[]){
  const url=safeUrl(r?.url);if(!url||seen.has(url))continue;
  const text=clean(kind==="page-extract"?(r.raw_content||r.content):r.content);
  if(!text)continue;
  seen.add(url);
  const title=clean(r.title)||new URL(url).hostname;
  output.push({id:(kind==="page-extract"?"URL-":"WEB-")+output.length,
   title:title.slice(0,140),url,extract:text.slice(0,kind==="page-extract"?MAX_EXTRACT:850),
   kind,verifiedLive:kind==="page-extract"});
  if(output.length>= (kind==="page-extract"?1:4))break;
 }
 return output;
}
function classifyHttpStatus(status){
 if(status===401||status===403)return "upstream-auth-failed";
 if(status===402||status===432)return "upstream-credits-exhausted";
 if(status===429)return "upstream-rate-limited";
 if(status===400||status===422)return "upstream-invalid-request";
 return "upstream-unavailable";
}
async function request(path,body,{env=process.env,fetchImpl=fetch,signal}={}){
 const key=String(env.TAVILY_API_KEY||"").trim();if(!key)return {status:"not-configured"};
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),5600);
 const onAbort=()=>ctrl.abort();
 signal?.addEventListener?.("abort",onAbort,{once:true});
 if(signal?.aborted)ctrl.abort();
 try{
  const r=await fetchImpl(API+path,{method:"POST",redirect:"manual",
   headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},
   body:JSON.stringify(body),signal:ctrl.signal});
  if(!r.ok)return {status:classifyHttpStatus(r.status)};
  return {data:await r.json()};
 }catch(e){return {status:e?.name==="AbortError"?"upstream-timeout":"upstream-network-error"};}
 finally{clearTimeout(timer);signal?.removeEventListener?.("abort",onAbort);}
}
async function lookup(question,options={}){
 const env=options.env||process.env,hasLink=!!options.hasLink;
 if(!eligible(question,{...options,env}))return {status:"not-configured-or-ineligible",sources:[]};
 const url=hasLink?extractUrl(question):null;
 const cacheKey=(hasLink?"url:":"search:")+(url||String(question).trim().toLowerCase());
 const hit=cache.get(cacheKey);
 if(hit&&Date.now()-hit.at<CACHE_TTL)return hit.value;
 // Tavily Free already has a provider-enforced credit limit. Do NOT
 // require an unrelated Netlify Blobs write for every newly created free key.
 // Owners can opt in to an additional durable cap via this explicit variable.
 const limitRaw=env.AKSARA_TAVILY_MONTHLY_CREDITS;
 const ownerCapEnabled=limitRaw!==undefined&&limitRaw!==null&&String(limitRaw).trim()!=="";
 if(ownerCapEnabled&&!/^\\d+$/.test(String(limitRaw).trim()))
  return {status:"local-cap-invalid",sources:[]};
 if(typeof options.reserveImpl==="function"||ownerCapEnabled){
  try{
   if(typeof options.reserveImpl==="function")await options.reserveImpl();
   else {
    const {getStore}=require("@netlify/blobs");
    const {reserve}=require("./lib/aksara-tavily-budget");
    await reserve({store:getStore({name:"aksara-tavily-monthly-v1",consistency:"strong"}),
     cap:Number(limitRaw)});
   }
  }catch(error){
   return {status:/monthly budget exhausted/.test(String(error?.message||""))?"local-cap-reached":"local-budget-store-unavailable",sources:[]};
  }
 }
 const response=hasLink?await request("/extract",{urls:[url],extract_depth:"basic",format:"markdown",include_images:false},options):
  await request("/search",{query:String(question).trim().slice(0,MAX_QUERY),search_depth:"basic",
   topic:"general",max_results:4,include_answer:false,include_raw_content:false,include_images:false},options);
 const data=response.data;
 const sources=normalize(data?.results,hasLink?"page-extract":"search-snippet");
 const status=sources.length?(hasLink?"page-read":"search-snippets"):
  response.status||(hasLink&&Array.isArray(data?.failed_results)&&data.failed_results.length?"page-extract-failed":"no-results");
 const value={status,sources};
 if(sources.length){cache.set(cacheKey,{at:Date.now(),value});if(cache.size>80)cache.delete(cache.keys().next().value);}
 return value;
}
module.exports={safeUrl,extractUrl,eligible,normalize,lookup};
