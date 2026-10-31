// Single live complex prompt. No API secrets or model text logged.
const base="https://aksara-apps.mshaifulridhwan.workers.dev";
const payload={question:"Analisis secara kritis dua kelemahan dakwaan bahawa korelasi sentiasa bermakna sebab-akibat. Berikan kesimpulan ringkas.",preferredProvider:"gemini",thoughtMode:"gelap",history:[]};
let response;
try{
 response=await fetch(base+"/.netlify/functions/bilik-antara",{
  method:"POST",headers:{"Origin":base,"Content-Type":"application/json"},
  body:JSON.stringify(payload),signal:AbortSignal.timeout(52000)
 });
 const j=await response.json().catch(()=>({}));
 const summary={http:response.status,provider:j.provider||"unknown",model:j.model||"unknown",
  replyPresent:typeof j.reply==="string"&&j.reply.trim().length>20,
  code:j.code||null,
  failures:(j.routing?.failedAttempts||[]).map(x=>({provider:x.provider,status:x.status,reason:x.reason}))};
 console.log("GEMINI_COMPLEX_LIVE",JSON.stringify(summary));
 if(summary.http!==200||!summary.replyPresent)process.exitCode=1;
 else if(summary.provider!=="gemini")console.log("FALLBACK_SUCCEEDED_GEMINI_UNHEALTHY");
 else console.log("GEMINI_COMPLEX_CONFIRMED");
}catch(e){console.log("LIVE_NETWORK_ERROR",e.name||"unavailable");process.exitCode=1;}
