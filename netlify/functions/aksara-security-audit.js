"use strict";
/* AKSARA Security Lab v3. Fixed owned origin, read-only request, no redirects.
 * Findings are HTTP posture indicators, not a penetration-test certification. */
const ORIGIN="https://shaifulridhwan-penulispuisigayabebas.netlify.app";
const PATHS=new Set(["/","/bilik-antara.html","/studio-antara.html","/antara-cahaya-dan-gelap.html"]);
const HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
const WEIGHT=Object.freeze({tinggi:5,sederhana:3,rendah:1,asas:1});
const clean=(value,max=300)=>String(value||"").replace(/[\r\n\0]/g," ").slice(0,max);
const respond=(status,body)=>({statusCode:status,headers:HEADERS,body:JSON.stringify(body)});
function assess(headers){
  const get=(k)=>clean(headers.get(k),2048).trim();
  const csp=get("content-security-policy"),hsts=get("strict-transport-security");
  const xframe=get("x-frame-options"),ref=get("referrer-policy"),permissions=get("permissions-policy");
  const segments=csp.split(";").map(x=>x.trim()).filter(Boolean);
  const directive=(name)=>{
    const found=segments.find(x=>x.toLowerCase().split(/\s+/)[0]===name);
    return found?found.split(/\s+/).slice(1):null;
  };
  const frame=directive("frame-ancestors");
  const strictObject=directive("object-src");
  const maxAge=(hsts.match(/(?:^|;)\s*max-age\s*=\s*(\d+)\s*(?:;|$)/i)||[])[1];
  const hstsDuration=maxAge?Number(maxAge):0;
  // These checks indicate observed configuration, not overall vulnerability.
  const specs=[
    ["https","Rangkaian","asas",true,"Audit menggunakan origin HTTPS yang dikunci; ini bukan audit TLS penuh."],
    ["hsts","Rangkaian","tinggi",hstsDuration>=15552000,"Semak HSTS max-age sekurang-kurangnya 15552000 selepas menilai keperluan subdomain."],
    ["csp","Polisi","tinggi",Boolean(csp),"Tiada enforced Content-Security-Policy; rancang polisi tanpa merosakkan skrip laman."],
    ["csp-eval","Polisi","tinggi",Boolean(csp)&&!csp.includes("'unsafe-eval'"),"Elakkan 'unsafe-eval' dalam polisi CSP."],
    ["csp-object","Polisi","sederhana",Boolean(strictObject)&&strictObject.length===1&&strictObject[0]==="'none'","Pertimbangkan object-src 'none' pada CSP."],
    ["csp-base","Polisi","sederhana",Boolean(directive("base-uri")),"Tetapkan base-uri bagi melindungi URL asas laman."],
    ["nosniff","Polisi","sederhana",get("x-content-type-options").toLowerCase()==="nosniff","Tetapkan X-Content-Type-Options: nosniff."],
    ["referrer","Privasi","sederhana",/^(no-referrer|same-origin|strict-origin|strict-origin-when-cross-origin)(?:\s*,|$)/i.test(ref),"Gunakan Referrer-Policy yang tidak membocorkan URL penuh kepada laman luar."],
    ["framing","Polisi","tinggi",Boolean(frame)&&frame.length>0&&!frame.includes("*")||/^(deny|sameorigin)$/i.test(xframe),"Hadkan framing menggunakan frame-ancestors atau X-Frame-Options."],
    ["permissions","Privasi","rendah",Boolean(permissions),"Tetapkan Permissions-Policy mengikut keperluan kamera, mikrofon dan lokasi."],
    ["no-powered-by","Pendedahan","rendah",!get("x-powered-by"),"Kurangkan pendedahan header framework yang tidak diperlukan."]
  ];
  const checks=specs.map(([id,group,risk,passed,advice])=>({
    id,group,risk,weight:WEIGHT[risk],passed,status:passed?"observed":"attention",
    advice:passed?"Konfigurasi berkaitan dikesan. Perlu semakan lanjut untuk mengesahkan keberkesanannya.":advice
  }));
  const observations=[
    {id:"cookies",title:"Cookie",value:get("set-cookie")?"Set-Cookie dikesan. Audit HttpOnly, Secure dan SameSite secara berasingan.":"Tiada Set-Cookie pada respons yang diperiksa."},
    {id:"coop",title:"Cross-Origin-Opener-Policy",value:get("cross-origin-opener-policy")?"Header tersedia.":"Tiada COOP; keperluannya bergantung pada penggunaan cross-origin."},
    {id:"cache",title:"Cache-Control",value:get("cache-control")?clean(get("cache-control"),120):"Tiada Cache-Control khusus dikesan."},
    {id:"server",title:"Server",value:get("server")?"Header Server hadir; nilainya tidak didedahkan.":"Header Server tidak dikesan."}
  ];
  return {checks,observations,hasCsp:Boolean(csp),cspSummary:csp?clean(csp,300):"Belum dikonfigurasi",hasHsts:Boolean(hsts)};
}
function score(checks){
  const denominator=checks.reduce((sum,c)=>sum+(Number(c.weight)||1),0);
  const numerator=checks.reduce((sum,c)=>sum+(c.passed?(Number(c.weight)||1):0),0);
  return denominator?Math.round(numerator/denominator*100):0;
}
exports.handler=async function(event){
  if(event.httpMethod!=="GET")return respond(405,{ok:false,error:"Method tidak disokong."});
  const path=event.queryStringParameters?.path||"/bilik-antara.html";
  if(!PATHS.has(path))return respond(400,{ok:false,error:"Audit terhad kepada halaman projek AKSARA."});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);
  try{
    const res=await fetch(ORIGIN+path,{method:"GET",redirect:"manual",signal:controller.signal,headers:{"accept":"text/html"}});
    if(res.body&&typeof res.body.cancel==="function")await res.body.cancel().catch(()=>{});
    if(res.status>=300&&res.status<400)return respond(502,{ok:false,error:"Redirect dikesan dan tidak diikuti."});
    if(res.status!==200)return respond(502,{ok:false,error:"Halaman tidak memberi HTTP 200.",status:res.status});
    const audit=assess(res.headers),passed=audit.checks.filter(c=>c.passed).length;
    return respond(200,{ok:true,schemaVersion:3,scope:"owned-origin-only",mode:"passive-single-request",
      scoreModel:"weighted-http-configuration-indicators-not-penetration-test",path,status:res.status,
      checkedAt:new Date().toISOString(),passed,total:audit.checks.length,
      score:score(audit.checks),warnings:audit.checks.length-passed,...audit});
  }catch(_){return respond(502,{ok:false,error:"Audit tidak tersedia. Semak sambungan kemudian."});}
  finally{clearTimeout(timer);}
};
exports._internal={ORIGIN,PATHS,WEIGHT,assess,score};