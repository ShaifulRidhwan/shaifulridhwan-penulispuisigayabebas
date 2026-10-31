// One-time, no-secrets live verification on the existing Cloudflare Worker.
// Do not log API keys, prompt bodies, generated text, or any user data.
const base="https://aksara-apps.mshaifulridhwan.workers.dev";
const post=async(path,obj,ms=35000)=>{
 const r=await fetch(base+path,{method:"POST",headers:{"Origin":base,"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(obj),signal:AbortSignal.timeout(ms)});
 const text=await r.text();let body={};try{body=JSON.parse(text)}catch(_){}
 return {http:r.status,body};
};
let failures=0;
const assert=(condition,message)=>{console.log((condition?"PASS":"FAIL")+" "+message);if(!condition)failures++;};
console.log("AKSARA CLOUDFLARE LIVE CHECK (safe summary only)");
try{
 const response=await fetch(base+"/api/aksara-health",{signal:AbortSignal.timeout(12000)});
 const health=await response.json();
 console.log("Health: HTTP",response.status,"configured providers",health.configuredProviders,
  "chat/voice/studio/control",JSON.stringify(health.services),health.controlConfigured);
 assert(response.ok&&health.configuredProviders===4&&health.controlConfigured===true,"all 4 configured and shared control bound");
}catch(e){console.log("FAIL health network",e.name);failures++;}
try{
 const {http,body}=await post("/.netlify/functions/bilik-antara",{providerStatus:true},50000);
 const statuses=Array.isArray(body.providers)?body.providers.map(p=>({id:p.id,status:p.status,
  reason:p.reason||null,http:p.http||null,quotaKind:p.quotaKind||null})):null;
 console.log("Provider status: HTTP",http,JSON.stringify(statuses));
 assert(http===200&&statuses&&statuses.length===4,"all 4 providers included in live status");
 for(const provider of statuses||[]){
  if(provider.id==="orcarouter"){
   console.log("OrcaRouter status interpretation: ready means key configured but NO live inference was sent");
  }
  if(provider.id==="openrouter"){
   console.log("OpenRouter status interpretation: ready means key validated but NOT free text inference");
  }
 }
}catch(e){console.log("FAIL provider status network",e.name);failures++;}
try{
 const {http,body}=await post("/.netlify/functions/studio-enhance",
  {prompt:"Seekor kucing hitam di tepi tingkap pada waktu pagi, tiada tulisan."},25000);
 console.log("Perkemas A.I.: HTTP",http,"ok",body.ok===true,"method",body.method||"none",
  "promptReturned",typeof body.prompt==="string"&&body.prompt.length>=4);
 assert(http===200&&body.ok===true&&typeof body.prompt==="string"&&body.prompt.length>=4,
  "Perkemas returns valid prompt");
 assert(body.method==="ai","Perkemas Groq inference used (not light fallback)");
}catch(e){console.log("FAIL Perkemas network",e.name);failures++;}
console.log("RESULT",failures===0?"ALL LIVE SMOKES PASSED":failures+" live check(s) failed");
process.exitCode=failures?1:0;
