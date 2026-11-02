"use strict";
/* Only Workers AI-native models, never third-party Unified Billing. */
const RERANK_MODEL="@cf/baai/bge-reranker-base";
function gatewayOptions(env=process.env){
 if(env.AKSARA_WORKERS_GATEWAY_ENABLED!=="true")return null;
 const id=String(env.AKSARA_WORKERS_GATEWAY_ID||"default").trim();
 if(!/^[a-z0-9][a-z0-9_-]{0,62}$/i.test(id))return null;
 // No prompt/response logging and no caching of user conversations.
 return {gateway:{id,collectLog:false,skipCache:true}};
}
async function rerankPublic({ai,question,results,env=process.env}={}){
 const list=Array.isArray(results)?results.slice(0,4):[];
 if(env.AKSARA_WORKERS_RERANK_ENABLED!=="true"||env.AKSARA_DISABLE_TOOLS==="true"||
  !ai||typeof ai.run!=="function"||!list.length||!list.every(x=>x.kind==="public"))
  return {status:"skipped",results:list};
 const query=String(question||"").slice(0,300);
 if(!query)return {status:"skipped",results:list};
 try{
  const contexts=list.map(x=>({text:String(x.excerpt||"").slice(0,600)}));
  // No memory, uploaded documents, notes or user histories enter the reranker.
  const opts=gatewayOptions(env);
  const response=await ai.run(RERANK_MODEL,{query,contexts,top_k:list.length},...(opts?[opts]:[]));
  const scores=Array.isArray(response?.response)?response.response:[];
  const ranked=[];
  for(const item of scores){
   const index=Number(item?.id??item?.index);
   if(!Number.isInteger(index)||index<0||index>=list.length||ranked.some(x=>x.index===index))continue;
   ranked.push({index,score:Number(item.score)||0});
  }
  if(!ranked.length)return {status:"no_scores",results:list};
  const ordered=[...ranked.sort((a,b)=>b.score-a.score).map(x=>list[x.index]),
    ...list.filter((_,i)=>!ranked.some(x=>x.index===i))];
  return {status:"verified_rerank",results:ordered};
 }catch(_){return {status:"unavailable",results:list};}
}
module.exports={RERANK_MODEL,gatewayOptions,rerankPublic};