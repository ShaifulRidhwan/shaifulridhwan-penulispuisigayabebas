"use strict";
/* AKSARA Security Lab v2: read-only checks for an explicitly owned origin.
 * Scope cannot be expanded by user input, redirects are never followed. */
const ORIGIN="https://shaifulridhwan-penulispuisigayabebas.netlify.app";
const PATHS=new Set(["/","/bilik-antara.html","/studio-antara.html","/antara-cahaya-dan-gelap.html"]);
const HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
const safe=(value,max=240)=>String(value||"").replace(/[\r\n\0]/g," ").slice(0,max);
const response=(code,body)=>({statusCode:code,headers:HEADERS,body:JSON.stringify(body)});
function assess(h){
  const get=(key)=>safe(h.get(key),2048).trim();
  const csp=get("content-security-policy"),hsts=get("strict-transport-security"),referrer=get("referrer-policy");
  const xframe=get("x-frame-options"),permissions=get("permissions-policy"),powered=get("x-powered-by");
  const normalizedCsp=csp.toLowerCase();
  const hasDirective=(name)=>new RegExp("(?:^|;)\\s*"+name+"\\s+[^;]+","i").test(csp);
  const strictDirective=(name)=>new RegExp("(?:^|;)\\s*"+name+"\\s+'none'(?:\\s*;|\\s*$)","i").test(csp);
  const entries=[
    ["https","Rangkaian","asas",true,"Origin audit menggunakan HTTPS."],
    ["hsts","Rangkaian","tinggi",/\bmax-age\s*=\s*[1-9]\d{5,}\b/i.test(hsts),"Tetapkan HSTS dengan tempoh munasabah selepas mengesahkan subdomain."],
    ["csp","Polisi","tinggi",Boolean(csp),"Tetapkan Content-Security-Policy yang diuji terhadap fungsi laman."],
    ["csp-eval","Polisi","tinggi",Boolean(csp)&&!/\b'unsafe-eval'\b|['"]unsafe-eval['"]/i.test(normalizedCsp),"Kurangkan penggunaan unsafe-eval dalam CSP."],
    ["csp-object","Polisi","sederhana",Boolean(csp)&&strictDirective("object-src"),"Gunakan object-src 'none' dalam CSP jika tidak memerlukan plugin."],
    ["csp-base","Polisi","sederhana",Boolean(csp)&&hasDirective("base-uri"),"Tetapkan base-uri untuk mengehadkan URL asas dokumen."],
    ["nosniff","Polisi","sederhana",get("x-content-type-options").toLowerCase()==="nosniff","Tetapkan X-Content-Type-Options: nosniff."],
    ["referrer","Privasi","sederhana",/^(no-referrer|same-origin|strict-origin|strict-origin-when-cross-origin)(?:,|$)/i.test(referrer),"Gunakan polisi referrer yang tidak mendedahkan URL penuh kepada laman luar."],
    ["framing","Polisi","tinggi",hasDirective("frame-ancestors")||/^(deny|sameorigin)$/i.test(xframe),"Hadkan embedding dengan CSP frame-ancestors atau X-Frame-Options."],
    ["permissions","Privasi","rendah",Boolean(permissions),"Nyatakan Permissions-Policy untuk keupayaan browser yang sensitif."],
    ["no-powered-by","Pendedahan","rendah",!powered,"Elakkan header X-Powered-By yang mendedahkan maklumat framework."]
  ];
  const checks=entries.map(([id,group,risk,passed,advice])=>({id,group,risk,passed,advice:passed?"Dikesan atau dipatuhi.":advice}));
  const cookie=get("set-cookie");
  const observations=[
    {id:"cookies",title:"Cookie",value:cookie?"Cookie respons dikesan. Sahkan HttpOnly, Secure dan SameSite pada setiap cookie.":"Tiada Set-Cookie dikesan pada respons ini."},
    {id:"coop",title:"Cross-Origin-Opener-Policy",value:get("cross-origin-opener-policy")?"Header tersedia.":"Tiada COOP. Opsyen ini bergantung pada keperluan isolasi laman."},
    {id:"cache",title:"Cache-Control",value:get("cache-control")?safe(get("cache-control"),120):"Tiada arahan cache khusus dikesan."},
    {id:"server",title:"Server",value:get("server")?"Header Server hadir. Nilai sebenar tidak didedahkan dalam laporan.":"Tiada header Server dikesan."}
  ];
  return {checks,observations,hasCsp:Boolean(csp),cspSummary:csp?safe(csp,300):"Belum dikonfigurasi",hasHsts:Boolean(hsts)};
}
exports.handler=async function(event){
  if(event.httpMethod!=="GET")return response(405,{ok:false,error:"Method tidak disokong."});
  const path=event.queryStringParameters?.path||"/bilik-antara.html";
  if(!PATHS.has(path))return response(400,{ok:false,error:"Audit hanya dibenarkan untuk halaman milik projek."});
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),6500);
  try{
    const r=await fetch(ORIGIN+path,{method:"GET",redirect:"manual",signal:ctrl.signal,headers:{"accept":"text/html"}});
    if(r.body&&typeof r.body.cancel==="function")await r.body.cancel().catch(()=>{});
    if(r.status>=300&&r.status<400)return response(502,{ok:false,error:"Redirect tidak diikuti; audit dihentikan."});
    if(r.status!==200)return response(502,{ok:false,error:"Halaman projek tidak memberi respons HTTP 200.",status:r.status});
    const data=assess(r.headers),passed=data.checks.filter(x=>x.passed).length;
    return response(200,{ok:true,scope:"owned-origin-only",mode:"passive-single-request",path,status:r.status,
      checkedAt:new Date().toISOString(),passed,total:data.checks.length,score:Math.round(passed/data.checks.length*100),
      warnings:data.checks.length-passed,...data});
  }catch(_){return response(502,{ok:false,error:"Audit tidak dapat dijalankan. Cuba semula apabila sambungan stabil."});}
  finally{clearTimeout(timer);}
};
exports._internal={assess,PATHS,ORIGIN};