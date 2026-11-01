// Read-only verification of live Netlify/Cloudflare split.
// Never sends user messages or credentials, writes no data, and does not run AI inference.
const old="https://shaifulridhwan-penulispuisigayabebas.netlify.app";
const current="https://aksara-apps.mshaifulridhwan.workers.dev";
let failures=0;
async function check(name,fn){
 try{
  const facts=await fn();
  const passed=Boolean(facts.passed);
  console.log((passed?"PASS ":"FAIL ")+name+" "+JSON.stringify(facts));
  if(!passed)failures++;
 }catch(e){
  failures++;console.log("FAIL "+name+" "+String(e?.name||"error"));
 }
}
const timeout=()=>AbortSignal.timeout(14000);
await check("Old Netlify Bilik Antara redirects to Cloudflare",async()=>{
 const r=await fetch(old+"/bilik-antara.html",{redirect:"manual",signal:timeout()});
 const to=r.headers.get("location")||"";
 return {passed:[301,302,307,308].includes(r.status)&&to.startsWith(current+"/bilik-antara.html"),http:r.status,location:to.slice(0,180)};
});
await check("Old Netlify short path redirects to Cloudflare",async()=>{
 const r=await fetch(old+"/bilik-antara",{redirect:"manual",signal:timeout()});
 const to=r.headers.get("location")||"";
 return {passed:[301,302,307,308].includes(r.status)&&to.startsWith(current+"/bilik-antara.html"),http:r.status,location:to.slice(0,180)};
});
await check("Old session export page remains on Netlify",async()=>{
 const r=await fetch(old+"/arkib-sesi-netlify.html",{signal:timeout()});
 const html=await r.text();
 return {passed:r.status===200&&html.includes("bilik-antara-suite-v1-archive")&&html.includes("Eksport arkib JSON"),http:r.status,exportPresent:html.includes("Eksport arkib JSON")};
});
await check("Homepage remains at Netlify and links directly to Cloudflare",async()=>{
 const r=await fetch(old+"/",{signal:timeout()});
 const html=await r.text();
 const links=html.split('href="'+current+'/bilik-antara.html"').length-1;
 return {passed:r.status===200&&r.url.startsWith(old)&&links===2,http:r.status,links};
});
await check("Cloudflare Bilik Antara serves session updates",async()=>{
 const r=await fetch(current+"/bilik-antara.html",{signal:timeout()});
 const html=await r.text();
 return {passed:r.status===200&&html.includes("bilik-antara-suite.js?v=15")&&html.includes("bilik-antara-session-utils.js?v=2"),http:r.status,sessionScriptsCurrent:html.includes("bilik-antara-suite.js?v=15")};
});
console.log("RESULT",failures===0?"ALL LIVE REDIRECT CHECKS PASSED":failures+" LIVE CHECKS FAILED");
process.exitCode=failures?1:0;
