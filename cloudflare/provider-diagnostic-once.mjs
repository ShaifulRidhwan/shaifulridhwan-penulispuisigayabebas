// One-shot diagnostic through public production API. No keys, user sessions or answer text in logs.
const origin="https://aksara-apps.mshaifulridhwan.workers.dev";
const path="/.netlify/functions/bilik-antara";
async function call(body){
 const res=await fetch(origin+path,{method:"POST",headers:{"Origin":origin,"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(40000)});
 const json=await res.json().catch(()=>({}));
 return {http:res.status,body:json};
}
const initial=await call({providerStatus:true});
console.log("INITIAL",JSON.stringify({http:initial.http,providers:initial.body.providers?.map(p=>({id:p.id,state:p.status,model:p.model,reason:p.reason,http:p.http,retryAfterSeconds:p.retryAfterSeconds}))}));
const answer=await call({
 preferredProvider:"orcarouter",
 thoughtMode:"cahaya",
 question:"Satu soalan mudah: apa perbezaan metafora dengan simile? Jawab dalam satu ayat sahaja.",
 history:[]
});
console.log("CHAT",JSON.stringify({
 http:answer.http,provider:answer.body.provider,model:answer.body.model,
 hasAnswer:typeof answer.body.reply==="string"&&answer.body.reply.length>15,
 failedAttempts:(answer.body.routing?.failedAttempts||answer.body.providerFailures||[]).map(p=>({provider:p.provider,status:p.status,reason:p.reason,fieldIssue:p.fieldIssue,errorType:p.errorType,quotaKind:p.quotaKind,retryAfterSeconds:p.retryAfterSeconds})),
 errorCode:answer.body.code
}));
const after=await call({providerStatus:true});
console.log("AFTER",JSON.stringify({http:after.http,providers:after.body.providers?.map(p=>({id:p.id,state:p.status,reason:p.reason,http:p.http,retryAfterSeconds:p.retryAfterSeconds}))}));
if(initial.http!==200||answer.http!==200||after.http!==200)process.exitCode=1;
