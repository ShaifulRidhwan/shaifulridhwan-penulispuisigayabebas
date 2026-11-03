"use strict";
/* Only verified, manually graded live samples. No HTTP-success proxy quality. */
const PROVIDERS=new Set(["groq","workers_ai","openrouter"]);
const TASKS=new Set(["general","conversation","creative","explain","technical","critique","research","hypothetical"]);
function validItem(row){
 return row&&PROVIDERS.has(row.provider)&&TASKS.has(row.task)&&
  typeof row.model==="string"&&row.model.length>=2&&row.model.length<=120&&
  typeof row.id==="string"&&/^[\w.-]{3,90}$/.test(row.id)&&
  row.humanReviewed===true&&row.evidenceReviewed===true&&
  Number.isFinite(row.grade)&&row.grade>=0&&row.grade<=1;
}
function summarize(rows,minimum=10){
 const groups=new Map();
 for(const x of Array.isArray(rows)?rows:[]){
  if(!validItem(x))continue;
  const key=x.provider+"|"+x.model+"|"+x.task;
  if(!groups.has(key))groups.set(key,new Map());
  // A repeated example must not manufacture sufficient samples.
  const g=groups.get(key);if(!g.has(x.id))g.set(x.id,x.grade);
 }
 return [...groups].map(([key,items])=>{
  const [provider,model,task]=key.split("|");
  const values=[...items.values()],n=values.length;
  const mean=n?values.reduce((a,b)=>a+b,0)/n:0;
  return {provider,model,task,n,mean:Number(mean.toFixed(4)),eligible:n>=minimum,
    source:"manually_reviewed_live_samples"};
 });
}
function compile(rows,{minimum=10,approved=false}={}){
 const stats=summarize(rows,minimum);
 return {version:1,approved:approved===true,kind:"verified_live_human_grades",
  scores:stats.filter(x=>x.eligible),excluded:stats.filter(x=>!x.eligible).map(({provider,model,task,n})=>({provider,model,task,n}))};
}
function delta(provider,model,task,{env=process.env}={}){
 if(env.AKSARA_V6_QUALITY_ROUTER!=="true"||!PROVIDERS.has(provider))return 0;
 let profile;try{profile=JSON.parse(env.AKSARA_V6_QUALITY_PROFILE_JSON||"{}");}catch(_){return 0;}
 if(profile?.version!==1||profile.approved!==true||profile.kind!=="verified_live_human_grades"||
   !Array.isArray(profile.scores))return 0;
 const item=profile.scores.find(x=>x.provider===provider&&x.model===model&&x.task===task&&
  x.source==="manually_reviewed_live_samples"&&Number.isInteger(x.n)&&x.n>=10&&
  Number.isFinite(x.mean)&&x.mean>=0&&x.mean<=1);
 return item?Math.max(-8,Math.min(8,Math.round((item.mean-0.5)*16))):0;
}
module.exports={validItem,summarize,compile,delta};
