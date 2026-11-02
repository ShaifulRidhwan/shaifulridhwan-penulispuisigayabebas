const base="https://aksara-apps.mshaifulridhwan.workers.dev";
const endpoint=base+"/.netlify/functions/bilik-antara";
async function probe(label,payload){
 try{
  const res=await fetch(endpoint,{method:"POST",headers:{"Origin":base,"Content-Type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(35000)});
  const data=await res.json().catch(()=>({}));
  const safe={label,http:res.status,provider:data.provider||null,model:data.model||null,hasReply:typeof data.reply==="string"&&data.reply.length>0,code:data.code||null,geminiDiagnosis:data.routing?.geminiDiagnosis||null,failedAttempts:(data.routing?.failedAttempts||[]).map(x=>({provider:x.provider,status:x.status,reason:x.reason,quotaKind:x.quotaKind})),providers:Array.isArray(data.providers)?data.providers.map(x=>({id:x.id,status:x.status,model:x.model,reason:x.reason,http:x.http,quotaKind:x.quotaKind})):undefined};
  console.log(JSON.stringify(safe));
 }catch(e){console.log(JSON.stringify({label,transport:e.name,message:String(e.message).slice(0,180)}));process.exitCode=1;}
}
await probe("status",{providerStatus:true});
await probe("forced-gemini",{question:"Terangkan maksud metafora dalam satu ayat.",preferredProvider:"gemini",thoughtMode:"cahaya",history:[]});
