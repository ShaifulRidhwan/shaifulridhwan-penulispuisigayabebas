// Live network test. GitHub Actions runner uses REAL DNS and HTTPS.
// Never persist or print ephemeral tokens, raw model output, IP addresses, secrets.
import dns from "node:dns/promises";
import {mkdirSync,writeFileSync} from "node:fs";
const production="https://shaifulridhwan-penulispuisigayabebas.netlify.app";
const worker="https://aksara-apps.mshaifulridhwan.workers.dev";
const report={commit:process.env.GITHUB_SHA||"local",time:new Date().toISOString(),
 primaryHost:new URL(production).host,experimentalHost:new URL(worker).host,checks:[]};
function add(name,pass,metadata={},required=true){
 report.checks.push({name,pass,required,...metadata});
 console.log(name+" "+(pass?"PASS":"FAIL")+" "+JSON.stringify(metadata));
}
const info=e=>({kind:String(e?.code||e?.name||"NETWORK"),reason:String(e?.message||"").slice(0,200)});
async function resolve(url,key,required){
 const host=new URL(url).hostname;
 try{
  const addresses=await dns.lookup(host,{all:true});
  add(key,addresses.length>0,{hostname:host,recordCount:addresses.length,families:[...new Set(addresses.map(x=>x.family))]},required);
 }catch(e){add(key,false,{hostname:host,...info(e)},required);}
}
async function send(path,payload,timeout=35000){
 const response=await fetch(production+path,{method:"POST",
 headers:{"Origin":production,"Content-Type":"application/json","Accept":"application/json, application/x-ndjson"},
 body:JSON.stringify(payload),signal:AbortSignal.timeout(timeout)});
 const data=await response.text();
 if(data.length>1000000)throw Error("Response exceeds contract inspection limit");
 return {status:response.status,type:response.headers.get("content-type")||"",data};
}
await resolve(production,"netlify_dns",true);
await resolve(worker,"experimental_cloudflare_dns",false);
try{
 const response=await fetch(production+"/bilik-antara.html",{signal:AbortSignal.timeout(16000)});
 add("production_web",response.ok,{http:response.status,mime:response.headers.get("content-type")});
 await response.body?.cancel();
}catch(e){add("production_web",false,info(e));}
try{
 const r=await send("/.netlify/functions/bilik-antara",{providerStatus:true},55000);
 const j=JSON.parse(r.data),rows=Array.isArray(j.providers)?j.providers:[];
 add("provider_health",r.status===200&&j.ok===true&&rows.length>0,
 {http:r.status,mime:r.type,rows:rows.map(x=>({id:String(x.id).slice(0,35),status:String(x.status).slice(0,30)}))});
}catch(e){add("provider_health",false,info(e));}
try{
 const r=await send("/.netlify/functions/bilik-antara-stream",{
 question:"Ujian sambungan ringkas. Balas satu ayat tentang Aksara A.I.",
 history:[],thoughtMode:"cahaya",contextFallback:true,mediaFallback:false},48000);
 const frames=r.data.split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
 const done=frames.find(x=>x.type==="done"&&typeof x.reply==="string"&&x.reply.trim().length>0);
 const error=frames.find(x=>x.type==="error");
 add("live_chat_stream",r.status===200&&r.type.includes("ndjson")&&!!done&&!error,
 {http:r.status,mime:r.type,frames:frames.slice(0,30).map(x=>x.type),
  provider:done?String(done.provider||"").slice(0,50):null,
  errorCode:error?String(error.code||error.status||"UPSTREAM").slice(0,55):null});
}catch(e){add("live_chat_stream",false,info(e));}
try{
 const r=await send("/.netlify/functions/bilik-antara-live-token",{},38000);
 const j=JSON.parse(r.data);
 const valid=r.status===200&&typeof j.token==="string"&&j.token.startsWith("auth_tokens/")&&String(j.model||"").startsWith("gemini-");
 add("gemini_live_broker",valid,{http:r.status,model:String(j.model||"").slice(0,65),
 reason:String(j.reason||j.diagnostic||"").slice(0,65),tokenShapeValid:valid});
}catch(e){add("gemini_live_broker",false,info(e));}
mkdirSync("docs/android-rebuild/backend-contract",{recursive:true});
writeFileSync("docs/android-rebuild/backend-contract/live-check.json",JSON.stringify(report,null,2)+"\n");
if(report.checks.some(x=>x.required&&!x.pass))process.exitCode=1;
