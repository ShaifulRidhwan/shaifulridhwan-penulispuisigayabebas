"use strict";
const {publicReferences}=require("./antara-free-research");
const Security=require("./aksara-security-shield");
const PublicWeb=require("./aksara-web-search");
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
async function research(question,intent,{enabled=true,attachment=false,account=false,privateContext=false,signal}={}){
 if(!enabled)return {sources:[],status:"disabled"};
 if(intent?.sensitive||attachment||account||privateContext)return {sources:[],status:"not-eligible"};
 if(intent?.search&&!intent?.hasLink){
  const web=await PublicWeb.search(question,{attachment,privateContext,sensitive:intent?.sensitive,hasLink:false,signal});
  if(web.sources.length)return {sources:web.sources,status:"search-snippets"};
  // No fabricated current information when the live search adapter is absent.
  return {sources:[],status:web.status};
 }
 const refs=await publicReferences(question,intent,attachment,account);
 const sources=curate(refs);
 return {sources,status:sources.length?"encyclopedia":"unverified"};
}
function guidance(out){
 if(out?.status==="search-snippets")
  return "Hasil carian masa nyata mengandungi tajuk, URL dan snippet. Ini BUKAN pembacaan halaman penuh atau pengesahan dakwaan. Nyatakan batas bukti dan pautkan sumber sebenar.";
 if(out?.status==="encyclopedia")
  return "Rujukan ensiklopedia bukan laporan berita langsung. Petik URL hanya jika sumber menyokong dakwaan. Nyatakan batas ketersediaan sumber.";
 return "Tiada sumber luaran yang disahkan. Carian web umum mungkin belum dikonfigurasi, tiada hasil atau gagal. Jangan mereka URL, fakta semasa, atau sumber; akui batas semakan live.";
}
module.exports={curate,research,guidance};
