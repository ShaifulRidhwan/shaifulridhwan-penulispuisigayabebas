"use strict";
/*
 * Bilik Antara Live Voice token broker.
 * Real GEMINI_API_KEY never leaves Netlify; browsers only receive one-use
 * ephemeral tokens with a short TTL. No audio or transcript passes this handler.
 */
const DEFAULT_ORIGIN="https://shaifulridhwan-penulispuisigayabebas.netlify.app";
const DEFAULT_MODEL="gemini-3.8-live";
const RATE_WINDOW_MS=10*60*1000;
const recent=new Map();
const headers=()=>({
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store, max-age=0",
  "Pragma":"no-cache",
  "Access-Control-Allow-Origin":process.env.ALLOWED_ORIGIN||DEFAULT_ORIGIN,
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Access-Control-Allow-Headers":"Content-Type",
  "Vary":"Origin"
});
function reply(code,payload){return {statusCode:code,headers:headers(),body:JSON.stringify(payload)};}
function rate(ip){
  const now=Date.now();
  if(recent.size>1000)for(const [k,v] of recent)if(now-v[0]>RATE_WINDOW_MS)recent.delete(k);
  const calls=(recent.get(ip)||[]).filter(t=>now-t<RATE_WINDOW_MS);
  if(calls.length>=3){recent.set(ip,calls);return true;}
  calls.push(now);recent.set(ip,calls);return false;
}
function allowedOrigin(event){
  const h=event.headers||{};
  const expected=process.env.ALLOWED_ORIGIN||DEFAULT_ORIGIN;
  return (h.origin||h.Origin)===expected;
}
exports.handler=async(event)=>{
  if(event.httpMethod==="OPTIONS"){
    return allowedOrigin(event)?{statusCode:204,headers:headers(),body:""}:reply(403,{error:"Origin tidak dibenarkan."});
  }
  if(event.httpMethod!=="POST")return reply(405,{error:"Gunakan POST."});
  if(!allowedOrigin(event))return reply(403,{error:"Origin tidak dibenarkan."});
  if(event.body && event.body.length>100)return reply(413,{error:"Permintaan terlalu besar."});
  const key=process.env.GEMINI_API_KEY;
  if(!key)return reply(503,{error:"Voice belum tersedia: GEMINI_API_KEY tiada di Netlify."});
  const ip=String((event.headers||{})["x-nf-client-connection-ip"]||"unknown").slice(0,100);
  if(rate(ip))return reply(429,{error:"Had Voice sementara dicapai. Cuba lagi selepas beberapa minit."});
  const configured=process.env.GEMINI_LIVE_MODEL||DEFAULT_MODEL;
  const model=/^gemini-[a-z0-9.-]{5,60}$/.test(configured)?configured:DEFAULT_MODEL;
  const now=Date.now();
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),9000);
  try{
    const response=await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-goog-api-key":key},
      body:JSON.stringify({
        uses:1,
        expireTime:new Date(now+10*60*1000).toISOString(),
        newSessionExpireTime:new Date(now+60*1000).toISOString(),
        liveConnectConstraints:{model:"models/"+model}
      }),
      signal:controller.signal
    });
    if(!response.ok){
      const message=response.status===429?"Kuota Gemini Live penuh.":
        response.status===403||response.status===401?"Akses Gemini Live tidak dibenarkan untuk projek ini.":
        response.status===400?"Model Voice tidak tersedia atau konfigurasi Live API belum disokong.":
        "Gemini Live gagal dihubungi.";
      return reply(response.status===429?429:502,{error:message});
    }
    const json=await response.json();
    if(!json||typeof json.name!=="string"||!json.name.startsWith("auth_tokens/")){
      return reply(502,{error:"Token sementara Gemini tidak sah."});
    }
    return reply(200,{
      token:json.name,
      model,
      durationSeconds:600,
      notice:"Audio dihantar terus ke Google Gemini semasa sesi Voice aktif. Sesi tamat automatik dalam 10 minit."
    });
  }catch(e){
    return reply(502,{error:"Sambungan token Voice gagal. Cuba semula."});
  }finally{clearTimeout(timeout);}
};
