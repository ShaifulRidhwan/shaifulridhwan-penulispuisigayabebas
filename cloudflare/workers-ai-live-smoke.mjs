// One-time live smoke. Only two synthetic, non-personal requests.
// Shows checked facts rather than raw generated text, secrets or chat history.
const base="https://aksara-apps.mshaifulridhwan.workers.dev";
const model="@cf/zai-org/glm-4.7-flash";
const origin=base;
let failures=0;
const check=(good,name)=>{console.log((good?"PASS ":"FAIL ")+name);if(!good)failures++;};
async function request(path,payload,ms=44000){
 const started=Date.now();
 const response=await fetch(base+path,{method:"POST",headers:{origin,"content-type":"application/json","accept":"application/json"},
  body:JSON.stringify(payload),signal:AbortSignal.timeout(ms)});
 const body=await response.text();
 return {status:response.status,text:body,elapsedMs:Date.now()-started};
}
console.log("Workers AI GLM real inference smoke: 2 synthetic prompts; no user data; no raw answers printed");
try{
 const checkStatus=await fetch(base+"/api/aksara-health",{signal:AbortSignal.timeout(12000)});
 const health=await checkStatus.json();
 console.log("Health",checkStatus.status,"chat",health.services?.chat===true,"AI count",health.configuredProviders);
 check(checkStatus.status===200&&health.services?.chat===true,"Cloudflare Worker health");
}catch(e){console.log("HEALTH_ERROR",e.name);failures++;}
try{
 const result=await request("/.netlify/functions/bilik-antara",{
  question:"Apa maksud aporia? Terangkan dalam satu ayat Bahasa Melayu Malaysia santai.",
  preferredProvider:"workers_ai",thoughtMode:"cahaya"});
 let json={};try{json=JSON.parse(result.text);}catch(_){}
 const output=typeof json.reply==="string"?json.reply:"";
 console.log("Text inference",{http:result.status,provider:json.provider||"none",model:json.model||"none",
  milliseconds:result.elapsedMs,replyChars:output.length,attempts:json.routing?.failedAttempts?.map(x=>({provider:x.provider,status:x.status}))||[]});
 check(result.status===200&&json.provider==="workers_ai"&&json.model===model,"GLM actually answered, not simply Ready");
 check(output.length>=12&&/aporia|kebuntuan|persoalan|pengetahuan|tahu/i.test(output),"GLM returned relevant Malay text");
 if(output)check(!/\b(?:nggak|gimana|makasih|banget|gue)\b/i.test(output),"No obvious Indonesian colloquial substitutions");
}catch(e){console.log("TEXT_INFERENCE_ERROR",e.name);failures++;}
try{
 const result=await request("/.netlify/functions/bilik-antara-stream",{
  question:"Dalam perbincangan tadi, apa pilihan kedua? Jawab ringkas.",
  history:[{role:"user",content:"Pilihan pertama ialah simpan rekod ke pelayan. Pilihan kedua ialah IndexedDB pada peranti."},
   {role:"assistant",content:"Kita boleh kekalkan pilihan kedua sebagai penyimpanan tempatan."}],
  preferredProvider:"workers_ai",thoughtMode:"cahaya"});
 const chunks=result.text.trim().split("\n").filter(Boolean);
 let parsed=[];for(const line of chunks){try{parsed.push(JSON.parse(line));}catch(_){}}
 const done=parsed.find(x=>x.type==="done"),error=parsed.find(x=>x.type==="error");
 const content=(done?.reply||parsed.filter(x=>x.type==="delta").map(x=>x.text||"").join(""));
 console.log("Stream inference",{http:result.status,model:done?.model||"none",provider:done?.provider||"none",
  milliseconds:result.elapsedMs,deltaEvents:parsed.filter(x=>x.type==="delta").length,
  contentChars:content.length,errorCode:error?.code||null});
 check(result.status===200&&done?.provider==="workers_ai"&&done.model===model,"GLM streaming completed with actual model provenance");
 check(/IndexedDB/i.test(content),"Multi-turn remembers the synthetic second choice");
 check(!/reasoning_content|internal planning/i.test(content),"No hidden reasoning leaked into stream");
}catch(e){console.log("STREAM_INFERENCE_ERROR",e.name);failures++;}
console.log("RESULT",failures===0?"LIVE MODEL TEST PASSED":failures+" checks failed or unverified");
process.exitCode=failures?1:0;
