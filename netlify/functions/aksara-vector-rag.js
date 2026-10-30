"use strict";
/* Real public-only vector retrieval: Cloudflare Workers AI bge-m3 (1024 dims)
 * + Vectorize. No conversation, document upload or private note is embedded.
 * Explicit server credentials only. Optional and fail-open to lexical retrieval. */
const MODEL="@cf/baai/bge-m3",DIM=1024;
function config(env=process.env){
 const account=String(env.CLOUDFLARE_ACCOUNT_ID||"");
 const token=String(env.AKSARA_CF_RAG_TOKEN||"");
 const index=String(env.AKSARA_VECTORIZE_INDEX||"aksara-public-knowledge");
 return /^[a-f0-9]{32}$/i.test(account)&&token.length>=12&&/^[a-z0-9][a-z0-9-_]{0,62}$/.test(index)
  ?{account,token,index}:null;
}
async function cloudRequest(config,path,body,{timeout=2000,ndjson=false}={}){
 const response=await fetch("https://api.cloudflare.com/client/v4/accounts/"+config.account+path,{
  method:"POST",headers:{"Authorization":"Bearer "+config.token,
   "Content-Type":ndjson?"application/x-ndjson":"application/json"},
  body:ndjson?body:JSON.stringify(body),signal:AbortSignal.timeout(timeout)
 });
 if(!response.ok)throw Error("Cloudflare request failed ("+response.status+")");
 const parsed=await response.json();
 if(parsed?.success!==true)throw Error("Cloudflare returned an unsuccessful result");
 return parsed.result;
}
function parseEmbeddings(result){
 const data=Array.isArray(result?.data)?result.data:Array.isArray(result?.embeddings)?result.embeddings:[];
 return data.map(item=>Array.isArray(item)?item:item?.embedding||item?.values).map(vector=>{
  if(!Array.isArray(vector)||vector.length!==DIM||vector.some(v=>!Number.isFinite(v)))throw Error("Unexpected bge-m3 vector dimensions");
  return vector;
 });
}
async function embed(texts,env=process.env,opts={}){
 const cfg=config(env);if(!cfg)throw Error("Vector RAG not configured");
 if(!Array.isArray(texts)||texts.length<1||texts.length>16||texts.some(t=>typeof t!=="string"||!t.trim()||t.length>2500))throw Error("Invalid public embedding inputs");
 const result=await cloudRequest(cfg,"/ai/run/"+MODEL,{text:texts},{timeout:opts.timeout||5000});
 const vectors=parseEmbeddings(result);
 if(vectors.length!==texts.length)throw Error("Embedding count mismatch");
 return vectors;
}
function validateMatch(match){
 const m=match?.metadata||{},score=Number(match?.score);
 if(!(score>=0.5&&score<=1)||m.kind!=="public-work"||typeof m.excerpt!=="string"||typeof m.title!=="string")return null;
 return {id:String(match.id||"").slice(0,64),title:m.title.slice(0,150),excerpt:m.excerpt.slice(0,850),
  kind:"public",score:Number(score.toFixed(3)),source:"cloudflare-vectorize"};
}
async function retrieve(question,{env=process.env,timeout=2400,topK=4}={}){
 const cfg=config(env);if(!cfg||typeof question!=="string"||question.length<3)return [];
 try{
  const [vector]=await embed([question.slice(0,900)],env,{timeout:Math.max(350,Math.floor(timeout*.6))});
  const result=await cloudRequest(cfg,"/vectorize/v2/indexes/"+encodeURIComponent(cfg.index)+"/query",
   {vector,topK:Math.max(1,Math.min(7,topK)),returnMetadata:"all",returnValues:false},
   {timeout:Math.max(350,Math.floor(timeout*.4))});
  return (Array.isArray(result?.matches)?result.matches:[]).map(validateMatch).filter(Boolean);
 }catch{return [];} // Deliberately allow lexical RAG, never expose tokens or raw errors.
}
async function upsertPublic(docs,{env=process.env,timeout=12000}={}){
 const cfg=config(env);if(!cfg)throw Error("Cloudflare RAG environment variables missing");
 if(!Array.isArray(docs)||docs.length<1||docs.length>16)throw Error("Index upsert batch must contain 1–16 public documents");
 const safe=docs.map(d=>{
  if(typeof d?.id!=="string"||!/^[a-f0-9]{32}$/i.test(d.id)||!d.title||!d.text||d.text.length>2500)throw Error("Invalid public document");
  return {id:d.id,title:String(d.title).slice(0,150),text:d.text};
 });
 const vectors=await embed(safe.map(d=>d.text),env,{timeout});
 const body=safe.map((d,i)=>JSON.stringify({id:d.id,values:vectors[i],
  metadata:{kind:"public-work",title:d.title,excerpt:d.text.slice(0,850)}})).join("\n")+"\n";
 return cloudRequest(cfg,"/vectorize/v2/indexes/"+encodeURIComponent(cfg.index)+"/upsert",body,{timeout,ndjson:true});
}
module.exports={MODEL,DIM,config,parseEmbeddings,validateMatch,retrieve,upsertPublic};
