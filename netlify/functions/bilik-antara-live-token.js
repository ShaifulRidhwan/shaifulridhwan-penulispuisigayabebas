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
  if(!key)return reply(503,{error:"Voice belum boleh digunakan. Kunci API belum diset di Netlify."});
  const ip=String((event.headers||{})["x-nf-client-connection-ip"]||"unknown").slice(0,100);
  if(rate(ip))return reply(429,{error:"Had sembang suara dah dicapai. Cuba lagi dalam beberapa minit."});
  const configured=process.env.GEMINI_LIVE_MODEL||DEFAULT_MODEL;
  const model=/^gemini-(?:3\.8-live(?:-extended-thinking)?|3\.1-flash-live-preview)$/.test(configured)?configured:DEFAULT_MODEL;
  const now=Date.now();
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  const base={
    uses:1,
    expireTime:new Date(now+10*60*1000).toISOString(),
    newSessionExpireTime:new Date(now+60*1000).toISOString()
  };
  async function requestToken(constrained){
    const payload=constrained?{...base,liveConnectConstraints:{model:"models/"+model}}:base;
    const response=await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-goog-api-key":key},
      body:JSON.stringify(payload),
      signal:controller.signal
    });
    const json=await response.json().catch(()=>({}));
    return {response,json};
  }
  try{
    // Some API projects reject optional Live model constraints; retry a
    // one-use/short-lived token without them when the first request gets 400.
    let {response,json}=await requestToken(true);
    if(response.status===400){
      const retry=await requestToken(false);
      response=retry.response;
      json=retry.json;
    }
    if(!response.ok){
      const detail=String(json&&json.error&&json.error.message||"").toLowerCase();
      const message=response.status===429?"Kuota Voice Live dah penuh buat sementara.":
        response.status===401||response.status===403?"Projek ini belum dibenarkan menggunakan Gemini Live.":
        /billing|payment/.test(detail)?"Gemini Live memerlukan bil atau akses projek yang sesuai.":
        /not found|model/.test(detail)?"Model Gemini Live tidak tersedia untuk projek ini.":
        /not supported|not available|permission/.test(detail)?"Gemini Live tidak disokong oleh kunci API projek ini.":
        "Google menolak token Voice (HTTP "+response.status+"). Semak akses Live API dalam projek Google AI Studio.";
      console.warn("[bilik-antara-voice] token refused",{httpStatus:response.status,reason:json&&json.error&&json.error.status||"upstream"});
      return reply(response.status===429?429:502,{error:message,reason:"TOKEN_HTTP_"+response.status});
    }
    if(!json||typeof json.name!=="string"||!json.name.startsWith("auth_tokens/")){
      return reply(502,{error:"Token sementara Gemini tidak sah.",reason:"TOKEN_FORMAT"});
    }
    return reply(200,{
      token:json.name,
      model,
      durationSeconds:600,
      notice:"Audio dihantar terus ke Google Gemini semasa sesi Voice aktif. Sesi tamat automatik dalam 10 minit."
    });
  }catch(e){
    return reply(502,{error:"Sambungan token Voice gagal. Cuba semula.",reason:"TOKEN_NETWORK"});
  }finally{clearTimeout(timeout);}
};
