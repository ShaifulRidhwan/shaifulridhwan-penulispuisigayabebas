// Owner-only NVIDIA prototype diagnostic. NEVER enables NVIDIA for public Chat.
// Requires a separate random, >=32-character AKSARA_NVIDIA_TEST_TOKEN Cloudflare Secret.
// The test prompt is fixed; no visitor messages, keys or model outputs are logged/stored.
const MODEL="deepseek-ai/deepseek-v4.1-flash";
const hdr={"content-type":"application/json; charset=utf-8","cache-control":"no-store",
 "x-robots-tag":"noindex, nofollow","x-content-type-options":"nosniff",
 "referrer-policy":"no-referrer"};
const send=(status,data)=>new Response(JSON.stringify(data),{status,headers:hdr});
async function matchToken(a,b){
 const enc=new TextEncoder();
 const [x,y]=await Promise.all([crypto.subtle.digest("SHA-256",enc.encode(a)),
  crypto.subtle.digest("SHA-256",enc.encode(b))]);
 const v1=new Uint8Array(x),v2=new Uint8Array(y);let diff=0;
 for(let i=0;i<v1.length;i++)diff|=v1[i]^v2[i];
 return diff===0;
}
const ui='<!doctype html><html lang="ms"><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<meta name="robots" content="noindex,nofollow"><title>AKSARA NVIDIA · Ujian Pemilik</title>'+
 '<style>body{font:16px system-ui;background:#0d1221;color:#ece8e1;max-width:570px;'+
 'margin:5vh auto;padding:1.5rem}main{padding:1.5rem;border:1px solid #4d5360;'+
 'border-radius:20px;background:#181e2e}input,button{box-sizing:border-box;width:100%;padding:14px;'+
 'border-radius:11px;font:inherit}input{background:#111827;color:white;border:1px solid #626b7c;'+
 'margin:12px 0}button{background:#dec89b;border:0;color:#121826;font-weight:700;cursor:pointer}'+
 'p{line-height:1.5;color:#c5cad4}output{display:block;white-space:pre-wrap;margin-top:20px}'+
 '</style></head><body><main><h1>Ujian NVIDIA AKSARA</h1>'+
 '<p>Hanya untuk pemilik dan pengujian prototaip. Chat awam tidak mengakses NVIDIA. '+
 'Masukkan token ujian berasingan, <strong>bukan API key NVIDIA</strong>. '+
 'Maksimum dua ujian sehari, dengan mesej ujian tetap.</p>'+
 '<form><label for="token">AKSARA_NVIDIA_TEST_TOKEN</label>'+
 '<input id="token" type="password" minlength="32" required autocomplete="off" spellcheck="false">'+
 '<button type="submit" data-test="inference">Uji DeepSeek melalui NVIDIA</button>'+ 
 '<button type="button" data-test="catalog" style="margin-top:10px;background:#788697">Semak akses API NVIDIA (tanpa inferens)</button></form><output aria-live="polite"></output>'+ 
 '</main><script>const f=document.querySelector("form"),o=document.querySelector("output"),'+
 'i=document.querySelector("input"),b=document.querySelector("button[data-test=inference]"),c=document.querySelector("button[data-test=catalog]");'+ 
 'let checking=false;async function run(mode){if(checking)return;checking=true;b.disabled=true;c.disabled=true;'+ 
 'o.textContent="Menguji API...";try{const r=await fetch(location.pathname,{method:"POST",'+
 'headers:{"Content-Type":"application/json"},body:JSON.stringify({token:i.value,mode})});'+ 
 'i.value="";const j=await r.json();o.textContent=JSON.stringify(j,null,2);}'+
 'catch(_){o.textContent="Ralat rangkaian semasa ujian."}finally{b.disabled=false;c.disabled=false;checking=false}}'+
 'f.addEventListener("submit",e=>{e.preventDefault();run("inference")});c.addEventListener("click",()=>run("catalog"));'+ 
 '</script></body></html>';
export async function nvidiaDiagnostic(request,env,quotaFn,fetchImpl=fetch){
 if(request.method==="GET")return new Response(ui,{headers:{"content-type":"text/html; charset=utf-8",
  "cache-control":"no-store","x-robots-tag":"noindex, nofollow",
  "x-content-type-options":"nosniff","referrer-policy":"no-referrer",
  "content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"}});
 if(request.method!=="POST")return send(405,{ok:false,error:"POST sahaja."});
 if(request.headers.get("origin")!==new URL(request.url).origin)
  return send(403,{ok:false,error:"Origin tidak dibenarkan."});
 let data;
 try{
  if(Number(request.headers.get("content-length")||0)>4096)return send(413,{ok:false,error:"Badan terlalu besar."});
  const raw=await request.text();
  if(raw.length>4096)return send(413,{ok:false,error:"Badan terlalu besar."});
  data=JSON.parse(raw);
 }catch(_){return send(400,{ok:false,error:"JSON tidak sah."});}
 const expected=String(env.AKSARA_NVIDIA_TEST_TOKEN||"");
 if(expected.length<32)return send(503,{ok:false,error:"Token ujian pemilik belum diset pada Cloudflare."});
 const submitted=typeof data?.token==="string"?data.token:"";
 if(submitted.length<32||submitted.length>256||!(await matchToken(submitted,expected)))
  return send(403,{ok:false,error:"Token ujian tidak sah."});
 if(!String(env.NVIDIA_API_KEY||"").trim())
  return send(503,{ok:false,error:"NVIDIA_API_KEY tiada pada Worker."});
 const catalog=data?.mode==="catalog";
 if(data?.mode!==undefined&&!["inference","catalog"].includes(data.mode))return send(400,{ok:false,error:"Jenis ujian tidak sah."});
 const allowed=await quotaFn(env,catalog?"health":"nvidia-test",request);
 if(allowed.error)return allowed.error;
 const timeout=AbortSignal.timeout(catalog?8000:30000);
 try{
  if(catalog){
   const res=await fetchImpl("https://integrate.api.nvidia.com/v1/models",{
    method:"GET",headers:{"Authorization":"Bearer "+env.NVIDIA_API_KEY,"Accept":"application/json"},signal:timeout});
   if(!res.ok)return send(502,{ok:false,provider:"NVIDIA",phase:"catalog",http:res.status});
   const models=await res.json().catch(()=>({}));
   const listed=Array.isArray(models?.data)&&models.data.some(x=>x?.id===MODEL);
   return send(200,{ok:true,provider:"NVIDIA",phase:"catalog",credentialAccepted:true,modelListed:listed,
    note:"Model disenaraikan, tetapi inferens belum disahkan berfungsi."});
  }
  const res=await fetchImpl("https://integrate.api.nvidia.com/v1/chat/completions",{
   method:"POST",headers:{"Authorization":"Bearer "+env.NVIDIA_API_KEY,
    "Content-Type":"application/json","Accept":"application/json"},
   body:JSON.stringify({model:MODEL,stream:false,max_tokens:512,temperature:1,top_p:0.95,
    messages:[{role:"system",content:"Jawab secara ringkas dalam Bahasa Melayu Malaysia."},
    {role:"user",content:"Beri satu ayat tentang apa itu metafora."}]}),
   signal:timeout
  });
  if(!res.ok)return send(502,{ok:false,provider:"NVIDIA",upstreamHttp:res.status,
   reason:res.status===402?"trial_quota_or_billing":res.status===401?"invalid_token":
    res.status===403?"access_restricted":res.status===429?"rate_limited":"upstream_unavailable"});
  let result={};try{result=await res.json()}catch(_){}
  const answer=String(result?.choices?.[0]?.message?.content||"").trim();
  return send(answer.length>5?200:502,{
   ok:answer.length>5,provider:"NVIDIA",model:MODEL,upstreamHttp:res.status,
   hasAnswer:answer.length>5,
   note:"Jawapan ujian, prompt dan API key tidak dipaparkan. Chat awam masih tidak menggunakan NVIDIA."
  });
 }catch(e){
  return send(504,{ok:false,provider:"NVIDIA",
   reason:e?.name==="TimeoutError"||e?.name==="AbortError"?"timeout":"network_unavailable"});
 }
}
