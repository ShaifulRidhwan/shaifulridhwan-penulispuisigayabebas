// One controlled live probe of Gemini's complex-model routing. Logs metadata only.
const base="https://aksara-apps.mshaifulridhwan.workers.dev";
const res=await fetch(base+"/.netlify/functions/bilik-antara",{
 method:"POST",headers:{"Origin":base,"Content-Type":"application/json"},
 body:JSON.stringify({preferredProvider:"gemini",thoughtMode:"gelap",
 question:"Dalam falsafah, huraikan secara mendalam perbezaan antara pengetahuan dan keyakinan berdasarkan epistemologi. Berikan satu contoh ringkas dan satu bantahan.",history:[]}),
 signal:AbortSignal.timeout(50000)
});
const body=await res.json().catch(()=>({}));
const failed=(body.routing?.failedAttempts||body.providerFailures||[]).map(x=>({provider:x.provider,status:x.status,reason:x.reason,quotaKind:x.quotaKind}));
console.log("GEMINI_38",JSON.stringify({http:res.status,provider:body.provider||null,model:body.model||null,
 returnedReply:typeof body.reply==="string"&&body.reply.length>20,failures:failed,code:body.code||null}));
if(res.status!==200)process.exitCode=1;
if(body.provider!=="gemini"||body.model!=="gemini-3.8-flash")console.log("GEMINI_38 NOT VERIFIED: successful fallback is not a successful Gemini response.");
else console.log("GEMINI_38 VERIFIED: direct inference.");
