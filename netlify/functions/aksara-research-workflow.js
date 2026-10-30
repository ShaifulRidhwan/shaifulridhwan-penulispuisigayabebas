"use strict";
const {publicReferences}=require("./antara-free-research");
const Security=require("./aksara-security-shield");
function curate(sources){
 const urls=new Set(),safe=[];
 for(const s of Array.isArray(sources)?sources:[]){
  if(typeof s?.url!=="string"||!/^https:\/\/(?:ms|en)\.wikipedia\.org\/wiki\//i.test(s.url)||urls.has(s.url))continue;
  const snippet=Security.allowed(s.extract,950);
  if(!snippet||!s.title)continue;
  urls.add(s.url);
  safe.push({id:"WIKI-"+(safe.length+1),title:Security.allowed(s.title,140),url:s.url,extract:snippet,kind:"encyclopedia",verifiedLive:false});
  if(safe.length===4)break;
 }
 return safe;
}
async function research(question,intent,{enabled=true,attachment=false,account=false}={}){
 if(!enabled)return {sources:[],status:"disabled"};
 if(intent?.sensitive||attachment||account)return {sources:[],status:"not-eligible"};
 const refs=await publicReferences(question,intent,attachment,account);
 const sources=curate(refs);
 return {sources,status:sources.length?"encyclopedia":"unverified"};
}
function guidance(out){
 if(out?.status==="encyclopedia")return "Rujukan ensiklopedia bukan laporan berita langsung. Petik URL hanya jika sumber menyokong dakwaan. Nyatakan batas ketersediaan sumber.";
 return "Tiada sumber luaran yang disahkan. Jangan mereka URL, fakta semasa, atau sumber; akui batas semakan live.";
}
module.exports={curate,research,guidance};
