// Non-invasive live deployment verification. HTTP GET only; no user messages, keys or inference.
const netlify="https://shaifulridhwan-penulispuisigayabebas.netlify.app";
const worker="https://aksara-apps.mshaifulridhwan.workers.dev";
const checks=[];
async function get(url){
 const started=Date.now();
 const response=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(14000),headers:{Accept:"text/html,application/json"}});
 const body=await response.text();
 return {status:response.status,body,elapsedMs:Date.now()-started,finalUrl:response.url};
}
function record(name,ok,details={}){checks.push({name,ok,...details});console.log((ok?"PASS":"FAIL")+" "+name,JSON.stringify(details));}
try{
 const result=await get(netlify+"/");
 const urls=[...result.body.matchAll(/href="https:\/\/aksara-apps\.mshaifulridhwan\.workers\.dev\/bilik-antara\.html"/g)].length;
 record("Netlify homepage forwards both Bilik Antara entries to Cloudflare",result.status===200&&urls===2,{http:result.status,links:urls});
}catch(e){record("Netlify homepage reachable",false,{error:e.name});}
try{
 const result=await get(worker+"/api/aksara-health");
 const status=JSON.parse(result.body);
 record("Cloudflare live Worker healthy",result.status===200&&status.platform==="cloudflare-workers"&&status.services?.chat===true,
  {http:result.status,chat:status.services?.chat===true,providers:status.configuredProviders||0});
}catch(e){record("Cloudflare health reachable",false,{error:e.name});}
try{
 const result=await get(worker+"/bilik-antara.html");
 const versions={
  sessionUtilsV2:result.body.includes("bilik-antara-session-utils.js?v=2"),
  suiteV15:result.body.includes("bilik-antara-suite.js?v=15"),
  legacySessionUtilsV1:result.body.includes("bilik-antara-session-utils.js?v=1"),
  legacySuiteV14:result.body.includes("bilik-antara-suite.js?v=14")
 };
 record("Cloudflare deployed PR128 session frontend",result.status===200&&versions.sessionUtilsV2&&versions.suiteV15,
  {http:result.status,...versions});
}catch(e){record("Cloudflare Bilik Antara HTML reachable",false,{error:e.name});}
try{
 const result=await get(worker+"/bilik-antara-session-utils.js?v=2");
 const updated=result.body.includes("matchArchivedSession")&&result.body.includes("conversationTitle");
 record("Cloudflare serves updated session repair functions",result.status===200&&updated,{http:result.status,updated});
}catch(e){record("Cloudflare session-utils asset reachable",false,{error:e.name});}
console.log("RESULT",checks.every(c=>c.ok)?"CUTOVER IN SYNC":"CUTOVER NEEDS SYNC");
process.exitCode=checks.every(c=>c.ok)?0:1;
