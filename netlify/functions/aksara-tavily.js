"use strict";
/* AKSARA Web Intelligence: server-side Tavily adapter.
 * Only the explicit current user question / public URL is sent to Tavily.
 * Never forward chat history, memory, attachments or credentials.
 * All remote content is untrusted data, never instructions.
 */
const BASE="https://api.tavily.com";
const CACHE_MS=10*60*1000,MAX_CACHE=60;
const cache=new Map();
const pending=new Map();
let windowStart=Date.now(),calls=0;
function key(env=process.env){
 const value=env.TAVILY_API_KEY||env.TAVILY_KEY||env.TAVILY||"";
 return env.AKSARA_TAVILY_ENABLED==="false"?"":String(value||"").trim();
}
function privateQuery(value){
 return /(?:api.?key|bearer\s+|password|kata laluan|rahsia|private|peribadi|secret|access.?token|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?:\+?\d[\s().-]*){8,})/i.test(value);
}
function safeUrl(value){
 if(typeof value!=="string"||value.length>1800)return null;
 try{
  const u=new URL(value);
  const host=u.hostname.toLowerCase().replace(/\.$/,"");
  if(u.protocol!=="https:"||u.username||u.password||u.port||
     !host.includes(".")||host.length>253||
     /^(?:localhost|\d+\.\d+\.\d+\.\d+|\[|0x|0\d)/i.test(host)||
     /\.(?:local|internal|localhost|lan|test|invalid|example|onion|home|arpa)$/i.test(host)||
     /^(?:metadata\.google\.internal|169\.254\.|127\.|10\.|192\.168\.|172\.)/i.test(host))
    return null;
  // Avoid relaying signed or credential-bearing URLs to a third party.
  if([...u.searchParams.keys()].some(p=>/^(?:token|api_?key|access_?key|auth|authorization|signature|sig|secret|password|code|session|jwt)$/i.test(p)))return null;
  u.hash="";
  return u.href;
 }catch(_){return null;}
}
function publicUrl(question){
 const matches=String(question||"").match(/https:\/\/[^\s<>\\"'\x60]+/gi)||[];
 for(const match of matches.slice(0,3)){
  const clean=match.replace(/[),.!?;]+$/,"");
  const url=safeUrl(clean);
  if(url)return url;
 }
 return null;
}
function clean(value,max){
 return String(value||"").replace(/\u0000/g,"").replace(/<[^>]*>/g," ").replace(/[ \t]{3,}/g," ").trim().slice(0,max);
}
function extractable(question,{attachment=false,privateContext=false,sensitive=false,account=false}={}){
 return !attachment&&!privateContext&&!sensitive&&!account&&!privateQuery(String(question||""))&&!!publicUrl(question);
}
function searchable(question,{attachment=false,privateContext=false,sensitive=false,account=false}={}){
 const q=String(question||"").trim();
 return !attachment&&!privateContext&&!sensitive&&!account&&!privateQuery(q)&&
  q.length>=4&&q.length<=220&&!/https?:\/\//i.test(q);
}
function cached(token,work){
 const now=Date.now(),old=cache.get(token);
 if(old&&old.at+CACHE_MS>now)return Promise.resolve(old.result);
 if(pending.has(token))return pending.get(token);
 const p=Promise.resolve().then(work).then(result=>{
  if(result?.sources?.length){
   cache.set(token,{at:Date.now(),result});
   if(cache.size>MAX_CACHE)cache.delete(cache.keys().next().value);
  }
  return result;
 }).finally(()=>pending.delete(token));
 pending.set(token,p);return p;
}
async function post(kind,body,{env=process.env,fetchImpl=fetch,signal}={}){
 const apiKey=key(env);if(!apiKey)return {status:"not-configured",data:null};
 if(Date.now()-windowStart>60*60*1000){windowStart=Date.now();calls=0;}
 // Per-instance burst guard only. Tavily's free-plan quota remains the hard cap.
 if(calls>=50)return {status:"rate-limited",data:null};
 calls++;
 const control=new AbortController();
 const timer=setTimeout(()=>control.abort(),kind==="extract"?5500:4700);
 const onAbort=()=>control.abort();
 signal?.addEventListener?.("abort",onAbort,{once:true});
 try{
  const res=await fetchImpl(BASE+"/"+kind,{
   method:"POST",redirect:"manual",signal:control.signal,
   headers:{"Content-Type":"application/json","Accept":"application/json","Authorization":"Bearer "+apiKey},
   body:JSON.stringify(body)
  });
  if(!res.ok)return {status:res.status===429?"rate-limited":"unavailable",data:null};
  const raw=await res.text();
  if(raw.length>300000)return {status:"response-too-large",data:null};
  return {status:"ok",data:JSON.parse(raw)};
 }catch(_){return {status:"unavailable",data:null};}
 finally{clearTimeout(timer);signal?.removeEventListener?.("abort",onAbort);}
}
async function search(question,options={}){
 if(!key(options.env)||!searchable(question,options))return {status:"not-configured-or-ineligible",sources:[]};
 const q=String(question).trim();
 return cached("s:"+q.toLowerCase(),async()=>{
  const response=await post("search",{query:q,search_depth:"basic",max_results:4,topic:"general",include_answer:false,include_raw_content:false},options);
  if(response.status!=="ok")return {status:response.status,sources:[]};
  const seen=new Set(),sources=[];
  for(const item of Array.isArray(response.data?.results)?response.data.results:[]){
   const url=safeUrl(item?.url),title=clean(item?.title,130),extract=clean(item?.content,850);
   if(!url||!title||!extract||seen.has(url))continue;
   seen.add(url);sources.push({id:"TAVILY-S"+sources.length,title,url,extract,kind:"search-snippet",verifiedLive:false});
   if(sources.length===4)break;
  }
  return {status:sources.length?"search-snippets":"no-results",sources};
 });
}
async function extract(question,options={}){
 if(!key(options.env)||!extractable(question,options))return {status:"not-configured-or-ineligible",sources:[]};
 const url=publicUrl(question);
 return cached("e:"+url,async()=>{
  const response=await post("extract",{urls:[url],extract_depth:"basic",format:"markdown",include_images:false},options);
  if(response.status!=="ok")return {status:response.status,sources:[]};
  const match=(Array.isArray(response.data?.results)?response.data.results:[]).find(r=>safeUrl(r?.url)===url);
  const extract=clean(match?.raw_content,12500);
  if(!extract)return {status:"page-unreadable",sources:[]};
  return {status:"page-read",sources:[{id:"TAVILY-E1",title:(new URL(url)).hostname,url,extract,kind:"page-content",verifiedLive:false,retrieved:true}]};
 });
}
module.exports={key,safeUrl,publicUrl,searchable,extractable,search,extract};
