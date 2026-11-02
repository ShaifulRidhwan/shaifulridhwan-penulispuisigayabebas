"use strict";
/* Strict, public HTTPS URLs only. No arbitrary server fetch, no credentials,
 * private networks or shortlinks; Gemini URL Context does the fetching. */
function allowed(value){
 try{
  const url=new URL(value);
  if(url.protocol!=="https:"||url.username||url.password||url.port)return null;
  const host=url.hostname.toLowerCase();
  if(!host.includes(".")||host==="localhost"||host.endsWith(".local")||
    host.endsWith(".internal")||host.endsWith(".test")||host.endsWith(".example")||
    host.endsWith(".invalid")||host.endsWith(".onion")||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)||host.startsWith("[")||
    /^(?:10|127|169\.254|172\.(?:1[6-9]|2\d|3[01])|192\.168)\./.test(host))return null;
  url.hash="";
  return url.href;
 }catch(_){return null;}
}
function extract(question,max=5){
 const q=String(question||"");
 if(q.length>8000)return [];
 const hits=q.match(/https:\/\/[^\s<>"'()[\]{}]+/gi)||[];
 const unique=[];
 for(const raw of hits){
  const url=allowed(raw.replace(/[.,;!?]+$/,""));
  if(url&&!unique.includes(url))unique.push(url);
  if(unique.length>=Math.max(1,Math.min(10,max)))break;
 }
 return unique;
}
function normalize(value){
 try{const u=new URL(value);return u.origin+u.pathname.replace(/\/$/,"")+(u.search||"");}catch(_){return "";}
}
function evidence(data,urls=[]){
 const metadata=data?.candidates?.[0]?.urlContextMetadata?.urlMetadata||[];
 const list=Array.isArray(metadata)?metadata:[];
 return urls.map(url=>{
  const statuses=list.filter(x=>normalize(x.retrievedUrl)===normalize(url))
   .map(x=>String(x.urlRetrievalStatus||"UNKNOWN"));
  return {url,status:statuses.includes("URL_RETRIEVAL_STATUS_SUCCESS")?"success":
    statuses.length?"failed":"not_reported"};
 });
}
function summary(rows){
 const ok=rows.filter(x=>x.status==="success").length;
 return {requested:rows.length,verified:ok,failed:rows.length-ok,
  status:ok===rows.length&&ok>0?"success":ok?"partial":"unverified",items:rows};
}
module.exports={allowed,extract,evidence,summary};