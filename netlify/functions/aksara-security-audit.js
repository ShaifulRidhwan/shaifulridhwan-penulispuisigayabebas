"use strict";
/* AKSARA Security Lab: one passive, single-request audit of an owned origin.
 * Never accept hostnames, arbitrary URLs, redirects, credentials or commands. */
const ORIGIN="https://shaifulridhwan-penulispuisigayabebas.netlify.app";
const PATHS=new Set(["/","/bilik-antara.html","/studio-antara.html","/antara-cahaya-dan-gelap.html"]);
const HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
function reply(code,body){return {statusCode:code,headers:HEADERS,body:JSON.stringify(body)};}
function assess(h){
  const get=(name)=>String(h.get(name)||"").trim();
  const csp=get("content-security-policy");
  const frame=get("x-frame-options");
  const tests=[
    ["https",true,"HTTPS digunakan melalui origin yang dikunci."],
    ["hsts",/max-age\s*=\s*\d+/i.test(get("strict-transport-security")),"Tambahkan HSTS selepas memastikan HTTPS konsisten."],
    ["csp",!!csp&&!/^\s*report-only/i.test(csp),"Tetapkan polisi Content-Security-Policy mengikut sumber laman."],
    ["nosniff",get("x-content-type-options").toLowerCase()==="nosniff","Tetapkan X-Content-Type-Options: nosniff."],
    ["referrer",!!get("referrer-policy"),"Tetapkan Referrer-Policy."],
    ["framing",/frame-ancestors/i.test(csp)||/^(deny|sameorigin)$/i.test(frame),"Kawal framing dengan frame-ancestors atau X-Frame-Options."],
    ["permissions",!!get("permissions-policy"),"Tetapkan Permissions-Policy yang sesuai."]
  ];
  return tests.map(([id,passed,advice])=>({id,passed,advice:passed?"Dikesan.":advice}));
}
exports.handler=async function(event){
  if(event.httpMethod!=="GET")return reply(405,{ok:false,error:"Method tidak disokong."});
  const path=event.queryStringParameters?.path||"/bilik-antara.html";
  if(!PATHS.has(path))return reply(400,{ok:false,error:"Hanya halaman Bilik Antara milik projek dibenarkan."});
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),6500);
  try{
    const response=await fetch(ORIGIN+path,{method:"GET",redirect:"manual",signal:controller.signal,headers:{"accept":"text/html"}});
    if(response.body&&typeof response.body.cancel==="function")await response.body.cancel().catch(()=>{});
    if(response.status>=300&&response.status<400)return reply(502,{ok:false,error:"Redirect tidak diikuti; audit dihentikan."});
    const checks=assess(response.headers);
    return reply(200,{ok:true,scope:"owned-origin-only",mode:"passive-single-request",path,status:response.status,checkedAt:new Date().toISOString(),passed:checks.filter(c=>c.passed).length,total:checks.length,checks});
  }catch(_error){return reply(502,{ok:false,error:"Halaman tidak dapat diaudit ketika ini."});}
  finally{clearTimeout(timer);}
};
exports._internal={assess,PATHS,ORIGIN};