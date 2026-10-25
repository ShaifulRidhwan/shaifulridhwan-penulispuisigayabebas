"use strict";
/**
 * Evidence-only public TikTok account research.
 * Uses TikTok's approved Research API when credentials exist.
 * No scraping, bypassing restrictions, cross-platform identity matching,
 * geolocation, coordinate inference, or collection of private identifiers.
 */
const FIELDS="display_name,bio_description,avatar_url,is_verified,follower_count,following_count,likes_count,video_count,bio_url";
const TOKEN_URL="https://open.tiktokapis.com/v2/oauth/token/";
const PROFILE_URL="https://open.tiktokapis.com/v2/research/user/info/?fields="+FIELDS;
const cache=new Map();
let tokenCache=null;
function canonicalHandle(value){
  if(typeof value!=="string")return null;
  const v=value.trim().replace(/^@/,"");
  return /^[A-Za-z0-9._]{2,24}$/.test(v)&&!v.endsWith(".")?v:null;
}
function extractTikTokHandle(message){
  if(typeof message!=="string")return null;
  const direct=message.match(/https?:\/\/(?:www\.|m\.)?tiktok\.com\/@([A-Za-z0-9._]{2,24})/i);
  if(direct)return canonicalHandle(direct[1]);
  if(!/\btik[\s-]?tok\b/i.test(message))return null;
  const at=message.match(/@([A-Za-z0-9._]{2,24})/);
  if(at)return canonicalHandle(at[1]);
  const named=message.match(/\btik[\s-]?tok\b\s+(?:(?:username|user|akaun|account|profil|profile|handle)\s+)?([A-Za-z0-9._]{2,24})/i)
       || message.match(/\b(?:username|handle|akaun|profil)\s+tik[\s-]?tok\b\s+([A-Za-z0-9._]{2,24})/i);
  if(named&&!/^(akaun|profile|profil|username|user|account|siapa|orang|itu|dia|ini|yang|saya|kau)$/i.test(named[1]))return canonicalHandle(named[1]);
  return null;
}
function urlFor(handle){return "https://www.tiktok.com/@"+encodeURIComponent(handle);}
function safeUrl(value){
  if(typeof value!=="string"||value.length>1600)return null;
  try{const u=new URL(value);return ["https:","http:"].includes(u.protocol)?u.href:null;}catch(e){return null;}
}
function bioText(value){
  if(typeof value!=="string")return null;
  return value.slice(0,500)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,"[maklumat hubungan dikecualikan]")
    .replace(/(?:\+?\d[\s().-]*){10,15}/g,"[nombor hubungan dikecualikan]");
}
function count(value){return Number.isSafeInteger(value)&&value>=0?value:null;}
function normalizeProfile(handle,data){
  if(!data||typeof data!=="object"||Array.isArray(data))return null;
  return {
    platform:"TikTok",handle:"@"+handle,profileUrl:urlFor(handle),
    displayName:typeof data.display_name==="string"?data.display_name.slice(0,140):null,
    bio:bioText(data.bio_description),
    avatarUrl:safeUrl(data.avatar_url),
    verified:typeof data.is_verified==="boolean"?data.is_verified:null,
    followers:count(data.follower_count),following:count(data.following_count),
    likes:count(data.likes_count),videos:count(data.video_count),
    bioLink:safeUrl(data.bio_url),
    source:"TikTok Research API",
    retrievedAt:new Date().toISOString(),
    // TikTok's publicly documented account endpoint does not supply an exact location.
    // Do not add geolocation from media, IP, profile photos, or incidental metadata.
    location:"Tidak disahkan",coordinates:null,accountCreated:"Tidak disediakan"
  };
}
async function request(url,options,fetcher,timeout=6500){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await fetcher(url,{...options,signal:controller.signal});
    if(!response.ok)throw Error("TikTok upstream HTTP "+response.status);
    return await response.json();
  }finally{clearTimeout(timer);}
}
async function getToken(env,fetcher){
  if(env.TIKTOK_RESEARCH_TOKEN)return env.TIKTOK_RESEARCH_TOKEN;
  if(!env.TIKTOK_RESEARCH_CLIENT_KEY||!env.TIKTOK_RESEARCH_CLIENT_SECRET)return null;
  const now=Date.now();
  if(tokenCache&&tokenCache.exp>now)return tokenCache.value;
  const body=new URLSearchParams({client_key:env.TIKTOK_RESEARCH_CLIENT_KEY,
    client_secret:env.TIKTOK_RESEARCH_CLIENT_SECRET,grant_type:"client_credentials"}).toString();
  const data=await request(TOKEN_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body},fetcher);
  if(!data||typeof data.access_token!=="string")return null;
  const life=Number.isFinite(data.expires_in)?data.expires_in:7200;
  tokenCache={value:data.access_token,exp:now+Math.max(60,life-120)*1000};
  return tokenCache.value;
}
async function researchPublicAccount(handle,env=process.env,fetcher=fetch){
  const clean=canonicalHandle(handle);
  if(!clean)return {status:"invalid",handle:null};
  const result={status:"unverified",handle:"@"+clean,profileUrl:urlFor(clean),
    note:"Maklumat akaun belum dapat disahkan melalui API rasmi. Jangan anggap pautan ini bukti akaun wujud."};
  if(env.ENABLE_TIKTOK_PUBLIC_RESEARCH==="false")return result;
  const saved=cache.get(clean.toLowerCase());
  if(saved&&Date.now()-saved.at<300000)return saved.result;
  try{
    const token=await getToken(env,fetcher);
    if(!token)return result;
    const response=await request(PROFILE_URL,{method:"POST",headers:{
      "Authorization":"Bearer "+token,"Content-Type":"application/json"
    },body:JSON.stringify({username:clean})},fetcher);
    if(response&&response.error&&response.error.code&&response.error.code!=="ok")return result;
    const profile=normalizeProfile(clean,response&&response.data);
    if(!profile)return result;
    const verified={status:"verified",handle:"@"+clean,profileUrl:profile.profileUrl,profile};
    cache.set(clean.toLowerCase(),{at:Date.now(),result:verified});
    return verified;
  }catch(e){
    return result; // Never expose TikTok tokens, user identifiers, or upstream credentials.
  }
}
module.exports={canonicalHandle,extractTikTokHandle,urlFor,normalizeProfile,researchPublicAccount};
