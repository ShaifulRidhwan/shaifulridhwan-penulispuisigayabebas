// Optional Cloudflare-only invisible Turnstile verification.
// The UI remains unchanged and this script loads no external code unless enabled.
(()=>{
 "use strict";
 const originalFetch=window.fetch.bind(window),api="/api/aksara-capabilities";
 let config=null,pendingConfig=null,turnstileReady=null,widgetId=null,challenge=null;
 async function capabilities(){
  if(config)return config;
  if(pendingConfig)return pendingConfig;
  pendingConfig=(async()=>{
   try{const r=await originalFetch(api,{cache:"no-store"});if(!r.ok)return {required:false};
    const data=await r.json();return data.turnstile||{required:false};
   }catch(_){return {required:false};}
  })();
  config=await pendingConfig;return config;
 }
 function loader(){
  if(turnstileReady)return turnstileReady;
  turnstileReady=new Promise((resolve,reject)=>{
   const script=document.createElement("script");
   script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
   script.async=true;script.onload=resolve;script.onerror=()=>reject(Error("Turnstile tidak dapat dimuat."));
   document.head.appendChild(script);
  });
  return turnstileReady;
 }
 async function token(sitekey){
  await loader();
  if(!window.turnstile)throw Error("Turnstile tidak tersedia.");
  if(!document.body)throw Error("Dokumen belum sedia.");
  if(!widgetId){
   const mount=document.createElement("div");
   mount.id="aksara-turnstile-private";
   mount.style.cssText="position:fixed;bottom:1rem;right:1rem;z-index:20000;";
   document.body.appendChild(mount);
   widgetId=window.turnstile.render(mount,{sitekey,execution:"execute",appearance:"interaction-only",
    callback:value=>{if(challenge){challenge.resolve(value);challenge=null;}},
    "error-callback":()=>{if(challenge){challenge.reject(Error("Pengesahan Turnstile gagal."));challenge=null;}}});
  }
  if(challenge)throw Error("Pengesahan lain sedang berjalan.");
  const promise=new Promise((resolve,reject)=>{challenge={resolve,reject};});
  window.turnstile.reset(widgetId);
  window.turnstile.execute(widgetId);
  return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Error("Turnstile mengambil masa terlalu lama.")),20000))]);
 }
 const routes=new Set(["bilik-antara","bilik-antara-stream","bilik-antara-live-token","studio-image","studio-enhance"]);
 window.fetch=async(input,init)=>{
  const requestInput=input instanceof Request;
  const method=String(init?.method||(requestInput?input.method:"GET")).toUpperCase();
  let url;try{url=new URL(requestInput?input.url:String(input),location.href);}catch(_){return originalFetch(input,init);}
  const path=url.pathname.split("/").at(-1);
  if(method!=="POST"||url.origin!==location.origin||!routes.has(path))return originalFetch(input,init);
  const body=init?.body;
  if(typeof body==="string"&&(/"providerStatus"\s*:\s*true|"probe"\s*:\s*true/.test(body)))
   return originalFetch(input,init);
  const state=await capabilities();
  if(!state.required)return originalFetch(input,init);
  if(!state.sitekey)throw Error("Konfigurasi Turnstile belum lengkap.");
  const answer=await token(state.sitekey);
  const headers=new Headers(init?.headers||(requestInput?input.headers:undefined));
  headers.set("x-aksara-turnstile-token",answer);
  return originalFetch(input,{...init,headers});
 };
})();
