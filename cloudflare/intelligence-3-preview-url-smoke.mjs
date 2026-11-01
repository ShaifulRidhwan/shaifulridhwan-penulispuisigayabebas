// Read-only real Cloudflare Preview URL smoke. No secrets or user messages.
const BASE="https://feat-aksara-intelligence-3-p1-p4-aksara-apps.mshaifulridhwan.workers.dev";
const check=(condition,label,detail={})=>{
 console.log(JSON.stringify({label,pass:!!condition,...detail}));
 if(!condition)process.exitCode=1;
};
async function request(path,options={}){
 let error;
 for(let attempt=0;attempt<4;attempt++){
  try{return await fetch(BASE+path,{...options,signal:AbortSignal.timeout(15000),redirect:"follow"});}
  catch(e){error=e;await new Promise(resolve=>setTimeout(resolve,2500));}
 }
 throw error;
}
console.log("AKSARA PR #131 real Cloudflare Preview read-only smoke. No AI inference.");
try{
 const res=await request("/api/aksara-health");
 const h=await res.json();
 check(res.status===200&&h.platform==="cloudflare-workers",
  "staging Worker health",{
   http:res.status,configuredProviders:h.configuredProviders||0,
   controlConfigured:h.controlConfigured===true,
   chatReady:h.services?.chat===true
  });
 // Preview secrets do NOT inherit production secrets. A disabled chat is
 // fail-closed, not evidence that production providers are broken.
 if(!h.controlConfigured)console.log("NOTICE: Preview AKSARA_RATE_SALT secret not set; private inference stays disabled.");
}catch(e){check(false,"staging Worker health",{errorType:e.name||"network"});}
for(const [path,label,needle] of [
 ["/bilik-antara.html","Bilik Antara preview static page",/data-cloudflare-preview="1"/],
 ["/studio-antara.html","Studio preview static page",/data-cloudflare-preview="1"/],
 ["/perpustakaan-aksara.html","Perpustakaan preview static page",/data-cloudflare-preview="1"/],
]){
 try{
  const res=await request(path);
  const txt=await res.text();
  check(res.status===200&&needle.test(txt),label,{http:res.status,previewTag:needle.test(txt)});
 }catch(e){check(false,label,{errorType:e.name||"network"});}
}
try{
 const res=await request("/.netlify/functions/bilik-antara",{
  method:"POST",headers:{"Origin":"https://unauthorized.example","Content-Type":"application/json"},
  body:JSON.stringify({question:"Ini input sintetik yang mesti disekat sebelum AI dipanggil."})});
 check(res.status===403,"foreign origin blocked before inference",{http:res.status});
}catch(e){check(false,"foreign origin blocked before inference",{errorType:e.name||"network"});}
