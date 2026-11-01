// One-off Gemini 3.6/3.8 smoke against existing public Cloudflare Worker.
// No secrets, full prompts, provider replies, user data or transcripts are logged.
const base="https://aksara-apps.mshaifulridhwan.workers.dev";
async function check(body,timeout=35000){
 const res=await fetch(base+"/.netlify/functions/bilik-antara",{
  method:"POST",headers:{"Content-Type":"application/json","Origin":base},
  body:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});
 const data=await res.json().catch(()=>({}));
 return {http:res.status,data};
}
const health=await check({providerStatus:true},15000);
const gemini=(health.data.providers||[]).find(x=>x.id==="gemini");
console.log("GEMINI_FAST",JSON.stringify({http:health.http,model:gemini?.model||null,status:gemini?.status||null,upstream:gemini?.http||null}));
if(health.http!==200||gemini?.model!=="gemini-3.6-flash"||gemini?.status!=="online")process.exitCode=1;
const heavy=await check({thoughtMode:"gelap",question:"Bandingkan dua pendekatan teknikal untuk mengurus context window dalam sistem multi-model, jelaskan trade-off terpenting dengan jelas dan kritis."},40000);
console.log("GEMINI_COMPLEX",JSON.stringify({http:heavy.http,provider:heavy.data.provider||null,model:heavy.data.model||null,
 hasReply:typeof heavy.data.reply==="string"&&heavy.data.reply.length>25,
 failed:(heavy.data.providerFailures||[]).map(x=>({provider:x.provider,status:x.status,reason:x.reason}))}));
if(heavy.http!==200||typeof heavy.data.reply!=="string")process.exitCode=1;
// A fallback reply is NOT counted as proof that Gemini 3.8 succeeded.
if(heavy.data.provider==="gemini"&&heavy.data.model==="gemini-3.8-flash")console.log("GEMINI_COMPLEX confirmed direct 3.8 inference");
else console.log("GEMINI_COMPLEX actual Gemini 3.8 inference not proven; inspect routing/quotas.");
