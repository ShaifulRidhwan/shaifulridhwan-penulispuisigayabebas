"use strict";
/* Zero-key, public encyclopedia references. Never query private user context or uploaded documents. */
const ALLOWED=new Set(["en.wikipedia.org","ms.wikipedia.org"]);
const UA="BilikAntara/1.0 (public education; https://shaifulridhwan-penulispuisigayabebas.netlify.app/)";
function eligible(question,intent,hasAttachment,hasAccount){
 const q=String(question||"");
 return !hasAttachment&&!hasAccount&&!intent.sensitive&&!intent.hasLink&&q.length<=120&&
  !/@|https?:|(?:\+?\d[\s().-]*){8,}/.test(q)&&
  /\b(?:rujukan|wikipedia|ensiklopedia|sumber ilmiah|research|kajian|selidik|penyelidikan)\b/i.test(q);
}
async function getJson(url,signal){
 const parsed=new URL(url);
 if(!ALLOWED.has(parsed.hostname)||parsed.protocol!=="https:")throw Error("host not allowed");
 const res=await fetch(parsed.href,{headers:{"User-Agent":UA,"Accept":"application/json"},signal});
 if(!res.ok)throw Error("HTTP "+res.status);
 return res.json();
}
async function publicReferences(question,intent,hasAttachment=false,hasAccount=false){
 if(!eligible(question,intent,hasAttachment,hasAccount)||process.env.ENABLE_FREE_WIKIMEDIA==="false")return [];
 const query=String(question).replace(/\b(?:rujukan|wikipedia|ensiklopedia|sumber ilmiah|research|kajian|selidik|penyelidikan|tentang|mengenai|tolong|berikan|cari|bagi)\b/gi," ").replace(/[!?.,:]/g," ").replace(/\s+/g," ").trim().slice(0,100);
 if(query.length<3)return [];
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3400);
 try{
  const languages=["ms","en"],found=[];
  const searches=await Promise.allSettled(languages.map(lang=>getJson(
   "https://"+lang+".wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=2&srsearch="+encodeURIComponent(query),controller.signal)));
  searches.forEach((out,index)=>{
   if(out.status!=="fulfilled")return;
   for(const hit of (out.value?.query?.search||[]).slice(0,2)){
    if(typeof hit.title!=="string"||hit.title.length>140)continue;
    found.push({lang:languages[index],title:hit.title});
   }
  });
  const unique=found.filter((item,i)=>found.findIndex(x=>x.lang===item.lang&&x.title===item.title)===i).slice(0,3);
  const detail=await Promise.allSettled(unique.map(item=>getJson(
   "https://"+item.lang+".wikipedia.org/api/rest_v1/page/summary/"+encodeURIComponent(item.title.replace(/ /g,"_")),controller.signal)));
  const sources=[];
  detail.forEach((out,index)=>{
   if(out.status!=="fulfilled")return;
   const data=out.value,item=unique[index],extract=data?.extract;
   const url=data?.content_urls?.desktop?.page;
   if(typeof extract!=="string"||extract.length<30||typeof url!=="string"||!/^https:\/\/(?:ms|en)\.wikipedia\.org\/wiki\//.test(url))return;
   if(data?.type==="disambiguation")return;
   sources.push({title:String(data.title||item.title).slice(0,130),url,extract:extract.slice(0,950),kind:"Wikipedia"});
  });
  return sources;
 }catch(_){return [];}finally{clearTimeout(timer);}
}
module.exports={eligible,publicReferences};
