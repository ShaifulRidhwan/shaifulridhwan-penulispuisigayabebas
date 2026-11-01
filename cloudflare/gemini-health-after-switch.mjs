// One-time Cloudflare Gemini health check. No secret, prompt, model text or personal data is printed.
const origin="https://aksara-apps.mshaifulridhwan.workers.dev";
const path="/.netlify/functions/bilik-antara";
let result=null;
for(let n=0;n<4;n++){
 if(n)await new Promise(resolve=>setTimeout(resolve,20000));
 try{
  const response=await fetch(origin+path,{method:"POST",
   headers:{"Origin":origin,"Content-Type":"application/json"},
   body:JSON.stringify({providerStatus:true}),signal:AbortSignal.timeout(12000)});
  const body=await response.json();
  const gemini=(body.providers||[]).find(x=>x.id==="gemini");
  const workersAI=(body.providers||[]).find(x=>x.id==="workers_ai");
  result={http:response.status,model:gemini?.model||null,gemini:gemini?.status||null,geminiHttp:gemini?.http||null,
   workersAI:workersAI?.status||null,workersAIReason:workersAI?.reason||null,workersAIHttp:workersAI?.http||null};
  console.log("CHECK",n+1,JSON.stringify(result));
  if(result.model==="gemini-3.5-flash-lite")break;
 }catch(error){console.log("CHECK",n+1,"network",error?.name||"error")}
}
if(!result||result.model!=="gemini-3.5-flash-lite")process.exitCode=1;
