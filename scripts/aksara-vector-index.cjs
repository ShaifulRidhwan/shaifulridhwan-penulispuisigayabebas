"use strict";
/* CLI only. Indexes ONLY the repository's public poetry corpus, never private
 * chat history, user memories, uploads or environment variable values. */
const crypto=require("node:crypto");
const fs=require("node:fs"),path=require("node:path");
const Vector=require("../netlify/functions/aksara-vector-rag");
function sourceDocuments(){
 const raw=JSON.parse(fs.readFileSync(path.join(__dirname,"../karya-index.json"),"utf8"));
 const out=[];
 for(const p of (Array.isArray(raw)?raw:[])){
  if(typeof p?.title!=="string"||!Array.isArray(p.lines))continue;
  const title=p.title.trim().slice(0,150),body=p.lines.filter(x=>typeof x==="string").join("\n");
  for(let i=0;i<body.length&&i<20000;i+=1700){
   const text=("TAJUK: "+title+"\n"+body.slice(i,i+1700)).slice(0,2200);
   const id=crypto.createHash("sha256").update(title+"|"+i+"|"+text).digest("hex").slice(0,32);
   out.push({id,title,text});
  }
 }
 return out;
}
async function initialize(){
 const cfg=Vector.config();if(!cfg)throw Error("Set CLOUDFLARE_ACCOUNT_ID, AKSARA_CF_RAG_TOKEN and AKSARA_VECTORIZE_INDEX in environment");
 const response=await fetch("https://api.cloudflare.com/client/v4/accounts/"+cfg.account+"/vectorize/v2/indexes",{
  method:"POST",headers:{"Authorization":"Bearer "+cfg.token,"Content-Type":"application/json"},
  body:JSON.stringify({name:cfg.index,config:{dimensions:Vector.DIM,metric:"cosine"},
   description:"Public Aksara literary knowledge only; no visitor conversations"}),
  signal:AbortSignal.timeout(10000)
 });
 const data=await response.json();
 if(!response.ok||!data.success)throw Error("Vectorize index creation failed. Check index permissions or whether the index already exists.");
 return {index:cfg.index,dimensions:Vector.DIM};
}
async function indexPublic({maxDocs=200}={}){
 if(process.env.AKSARA_RAG_INDEX_CONFIRM!=="YES_PUBLIC_ONLY")throw Error("Explicit confirmation AKSARA_RAG_INDEX_CONFIRM=YES_PUBLIC_ONLY required");
 const documents=sourceDocuments().slice(0,Math.max(1,Math.min(2000,maxDocs)));
 let batches=0;
 for(let i=0;i<documents.length;i+=8){
  await Vector.upsertPublic(documents.slice(i,i+8),{timeout:18000});
  batches++;
 }
 return {indexed:documents.length,batches,publicOnly:true,model:Vector.MODEL};
}
if(require.main===module)(async()=>{
 const command=process.argv[2];
 if(command==="count"){console.log(JSON.stringify({documents:sourceDocuments().length,privacy:"repository public works only"}));return;}
 if(command==="init"){console.log(JSON.stringify(await initialize()));return;}
 if(command==="index"){console.log(JSON.stringify(await indexPublic({maxDocs:Number(process.env.AKSARA_RAG_INDEX_LIMIT)||200})));return;}
 throw Error("Use: node scripts/aksara-vector-index.cjs count|init|index");
})().catch(e=>{console.error(String(e.message||e));process.exitCode=1;});
module.exports={sourceDocuments,indexPublic,initialize};
