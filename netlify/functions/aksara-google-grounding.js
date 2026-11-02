"use strict";
/* AKSARA verified public research. Gemini 2.5 Flash-Lite has a documented
 * free-tier Google Search allowance; do not silently route this tool to 3.x.
 * No history, notes, attachments or account data leave through this path. */
const {requestControl}=require("./lib/aksara-transport");
const {sourceList,modelText}=require("./antara-intelligence");
const MODEL="gemini-2.5-flash-lite";
function eligible(intent={},env=process.env){
 const q=String(intent.question||"").trim();
 return env.AKSARA_GOOGLE_SEARCH_GROUNDING!=="false"&&env.AKSARA_DISABLE_TOOLS!=="true"&&
  intent.search===true&&!intent.hasLink&&!intent.sensitive&&!intent.privateContext&&
  !intent.attachment&&!intent.account&&q.length>=4&&q.length<=800&&
  !/https?:|@|(?:\\+?\\d[\\s().-]*){8,}|(?:api.?key|token|password|kata laluan|rahsia|private|peribadi|alamat rumah)/i.test(q);
}
function verified(data){
 const candidate=data?.candidates?.[0]||{};
 const queries=candidate.groundingMetadata?.webSearchQueries;
 const sources=sourceList(candidate).filter(x=>{
  try{const u=new URL(x.url);return u.protocol==="https:"&&!u.username&&!u.password;}catch(_){return false;}
 }).slice(0,6);
 const reply=modelText(candidate).slice(0,12000);
 return Array.isArray(queries)&&queries.some(x=>typeof x==="string"&&x.trim())&&sources.length&&reply
  ?{reply,sources,queries:queries.length,model:MODEL}:null;
}
function classifyHttp(status){
 if(status===400||status===422)return "invalid_request";
 if(status===401||status===403)return "access_denied";
 if(status===402)return "billing_required";
 if(status===404)return "model_unavailable";
 if(status===429)return "quota_exceeded";
 return status>=500?"upstream_unavailable":"upstream_http";
}
async function search({question,apiKey,signal,deadline=Date.now()+8000,fetchImpl=fetch}={}){
 if(!apiKey)return {status:"not_configured"};
 const budget=Math.min(9000,Math.max(1,deadline-Date.now()));
 if(budget<700)return {status:"deadline"};
 const control=requestControl(budget,signal);
 try{
  const response=await fetchImpl("https://generativelanguage.googleapis.com/v1beta/models/"+MODEL+":generateContent",{
   method:"POST",signal:control.signal,
   headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
   body:JSON.stringify({
    systemInstruction:{parts:[{text:"Kau AKSARA A.I. Jawab dalam Bahasa Melayu Malaysia santai, berdasarkan Google Search yang benar-benar digunakan. Ringkaskan dapatan yang boleh disahkan. Jangan cipta sumber, tarikh atau tajuk; gunakan URL sebenar dalam metadata grounding. Jika alat tidak mencari, akui hadnya."}]},
    contents:[{role:"user",parts:[{text:String(question).slice(0,800)}]}],
    tools:[{google_search:{}}],
    generationConfig:{maxOutputTokens:1700,temperature:0.3}
   })
  });
  if(!response.ok)return {status:classifyHttp(response.status),http:response.status};
  const data=await response.json();
  const evidence=verified(data);
  if(!evidence){
   const meta=data?.candidates?.[0]?.groundingMetadata||{};
   const finish=String(data?.candidates?.[0]?.finishReason||"").slice(0,30);
   return {status:"no_grounding_evidence",hasSearchQueries:Array.isArray(meta.webSearchQueries)&&meta.webSearchQueries.length>0,
    hasSources:Array.isArray(meta.groundingChunks)&&meta.groundingChunks.length>0,
    ...( /^(STOP|MAX_TOKENS|SAFETY|RECITATION|OTHER)$/.test(finish)?{finishReason:finish}:{})};
  }
  return {status:"success",...evidence,usage:data.usageMetadata||null};
 }catch(e){
  return {status:e?.name==="AbortError"?"timeout":"upstream_error"};
 }finally{control.close();}
}
module.exports={MODEL,eligible,verified,search};
