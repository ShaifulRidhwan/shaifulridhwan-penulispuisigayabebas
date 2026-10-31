// Single-run live regression against Cloudflare, no API keys or visitor data in logs.
// Only two low-volume queries; prefer Gemini explicitly, never force a paid fallback.
const base="https://aksara-apps.mshaifulridhwan.workers.dev";
const p="/.netlify/functions/bilik-antara";
const testCases=[
 {name:"ordinary-fast",model:"gemini-3.5-flash-lite",
  question:"Terangkan secara ringkas bagaimana pelangi terbentuk dalam dua ayat."},
 {name:"deep-reasoning",model:"gemini-3.5-flash-lite",
  question:"Buat analisis kritis yang mendalam tentang hujah ini: setiap pemerhatian membuktikan sebab-akibat. Berikan dua bantahan yang berbeza dan satu kesimpulan."}
];
let fail=0;
for(const entry of testCases){
 try{
  const response=await fetch(base+p,{method:"POST",
   headers:{"Origin":base,"Content-Type":"application/json"},
   body:JSON.stringify({question:entry.question,preferredProvider:"gemini",thoughtMode:"cahaya",history:[]}),
   signal:AbortSignal.timeout(32000)
  });
  const payload=await response.json().catch(()=>({}));
  const meta={test:entry.name,http:response.status,provider:payload.provider||"unknown",
    model:payload.model||"unknown",replyPresent:typeof payload.reply==="string"&&payload.reply.length>10,
    errorCode:payload.code||null,
    failures:(payload.routing?.failedAttempts||payload.providerFailures||[]).map(x=>({provider:x.provider,status:x.status,reason:x.reason}))};
  console.log("LIVE",JSON.stringify(meta));
  if(response.status!==200||meta.provider!=="gemini"||meta.model!==entry.model||!meta.replyPresent){
   fail++;
   console.log("NOTE target model not independently confirmed for "+entry.name);
  }
 }catch(err){console.log("NETWORK",entry.name,err.name||"request_failed");fail++;}
}
console.log(fail===0?"PASS Gemini 3.5 Flash-Lite answered both normal and complex":"INCOMPLETE for Gemini 3.5 Flash-Lite "+fail+" of 2 Gemini live tests");
process.exitCode=fail?1:0;
