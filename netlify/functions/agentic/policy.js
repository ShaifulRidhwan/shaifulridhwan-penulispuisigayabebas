"use strict";
const crypto=require("node:crypto");
const LIMITS=Object.freeze({
  light:Object.freeze({steps:3,toolCalls:4,ms:24000}),
  balanced:Object.freeze({steps:6,toolCalls:8,ms:41000}),
  deep:Object.freeze({steps:9,toolCalls:14,ms:52000})
});
const visitors=new Map();
const MODEL_RE=/^[a-zA-Z0-9][a-zA-Z0-9._/-]{1,90}$/;
function validate(body){
  if(!body||typeof body!=="object"||Array.isArray(body))throw Object.assign(Error("Format misi tidak sah."),{status:400});
  const mission=typeof body.mission==="string"?body.mission.trim():"";
  if(mission.length<10||mission.length>3000)throw Object.assign(Error("Misi mesti antara 10 dan 3000 aksara."),{status:400});
  if(body.consent!==true)throw Object.assign(Error("Kebenaran penggunaan model AI diperlukan."),{status:403});
  const mode=String(body.mode||"balanced").toLowerCase();
  if(!Object.hasOwn(LIMITS,mode))throw Object.assign(Error("Mod agent tidak disokong."),{status:400});
  return {mission,mode,limits:LIMITS[mode]};
}
function providers(env=process.env){
  const all=[];
  const selected=(x,fallback)=>MODEL_RE.test(String(x||""))?String(x):fallback;
  if(env.GROQ_API_KEY&&env.GROQ_FREE_CONFIRMED==="true")all.push({id:"groq",apiKey:env.GROQ_API_KEY,baseURL:"https://api.groq.com/openai/v1",model:selected(env.AKSARA_AGENT_GROQ_MODEL,"openai/gpt-oss-120b")});
  if(env.OPENROUTER_API_KEY)all.push({id:"openrouter",apiKey:env.OPENROUTER_API_KEY,baseURL:"https://openrouter.ai/api/v1",model:"openrouter/free"});
  if((env.GEMINI_API_KEY||env.GOOGLE_API_KEY)&&env.AKSARA_AGENT_GEMINI_FREE_CONFIRMED==="true")all.push({id:"gemini",apiKey:env.GEMINI_API_KEY||env.GOOGLE_API_KEY,baseURL:"https://generativelanguage.googleapis.com/v1beta/openai",model:selected(env.AKSARA_AGENT_GEMINI_MODEL,"gemini-2.5-flash-lite")});
  const pref=String(env.AKSARA_AGENT_PROVIDER||"").trim();
  return all.sort((a,b)=>Number(b.id===pref)-Number(a.id===pref));
}
function admit(headers={},now=Date.now()){
  const ip=String(headers["x-nf-client-connection-ip"]||headers["client-ip"]||headers["x-forwarded-for"]||"unknown").split(",")[0].trim().slice(0,80);
  const id=crypto.createHash("sha256").update(ip).digest("hex").slice(0,24);
  const slot=Math.floor(now/86400000);
  if(visitors.size>2000)for(const [k,v] of visitors)if(v.slot!==slot)visitors.delete(k);
  const old=visitors.get(id);
  const record=old&&old.slot===slot?old:{slot,count:0,minute:0,minuteCount:0};
  const minute=Math.floor(now/60000);
  if(record.minute!==minute){record.minute=minute;record.minuteCount=0;}
  if(record.count>=12||record.minuteCount>=3)return {ok:false,retryAfter:record.minuteCount>=3?60:Math.ceil((slot+1)*86400-now/1000)};
  record.count++;record.minuteCount++;visitors.set(id,record);
  return {ok:true};
}
module.exports={LIMITS,validate,providers,admit};
