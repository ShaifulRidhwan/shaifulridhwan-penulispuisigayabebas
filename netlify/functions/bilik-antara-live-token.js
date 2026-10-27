"use strict";
/*
 * Bilik Antara Live Voice token broker.
 * Real GEMINI_API_KEY never leaves Netlify; browsers only receive one-use
 * ephemeral tokens with a short TTL. No audio or transcript passes this handler.
 */
const DEFAULT_ORIGIN="https://shaifulridhwan-penulispuisigayabebas.netlify.app";
// Prefer reasoning-capable Live; fall back automatically to standard Live when
// the project's API access does not support the extended-thinking model.
const DEFAULT_MODEL="gemini-3.8-live-extended-thinking";
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
function rate(ip,success=false){
  const now=Date.now();
  if(recent.size>1000)for(const [k,state] of recent)if(now-state.last>RATE_WINDOW_MS)recent.delete(k);
  const state=recent.get(ip)||{attempts:[],sessions:[],last:now};
  state.attempts=state.attempts.filter(t=>now-t<RATE_WINDOW_MS);
  state.sessions=state.sessions.filter(t=>now-t<RATE_WINDOW_MS);
  state.last=now;
  if(success){state.sessions.push(now);recent.set(ip,state);return false;}
  if(state.attempts.length>=12||state.sessions.length>=5){recent.set(ip,state);return true;}
  state.attempts.push(now);recent.set(ip,state);return false;
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
  if(rate(ip))return reply(429,{error:"Had cubaan atau sesi Voice Live dicapai buat sementara. Cuba kemudian.",reason:"LOCAL_RATE_LIMIT"});
  const configured=process.env.GEMINI_LIVE_MODEL||DEFAULT_MODEL;
  const model=/^gemini-(?:3\.8-live(?:-extended-thinking)?|3\.1-flash-live-preview)$/.test(configured)?configured:DEFAULT_MODEL;
  const now=Date.now();
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),22000);
  const base={
    uses:1,
    expireTime:new Date(now+10*60*1000).toISOString(),
    newSessionExpireTime:new Date(now+60*1000).toISOString()
  };
  try{
    // Try model-bound, one-use Live tokens first; if Google explicitly
    // rejects that optional field, use a shorter one-use Live-only token.
    const candidates=model==="gemini-3.8-live-extended-thinking"?
      [model,"gemini-3.8-live","gemini-3.1-flash-live-preview"]:
      [model,...(model==="gemini-3.8-live"?["gemini-3.1-flash-live-preview"]:["gemini-3.8-live"])];
    let lastStatus=502,lastReason="UPSTREAM",lastMessage="",tried=[];
    outer: for(const candidate of [...new Set(candidates)]){
      // Attempt the smallest valid model-locked token first. Avoid binding
      // extra Live config that may differ from the actual WebSocket setup.
      // Google only ever receives a ONE-USE, short-lived, model-bound request.
      for(const variant of ["model-only","audio-config"]){
        const restriction={model:"models/"+candidate};
        if(variant==="audio-config")restriction.config={
          sessionResumption:{},responseModalities:["AUDIO"]
        };
        const response=await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens",{
          method:"POST",
          headers:{"Content-Type":"application/json","x-goog-api-key":key},
          body:JSON.stringify({...base,liveConnectConstraints:restriction}),
          signal:controller.signal
        });
        const json=await response.json().catch(()=>({}));
        tried.push(candidate+(variant==="model-only"?" · model sahaja":" · audio"));
        if(response.ok){
          if(!json||typeof json.name!=="string"||!json.name.startsWith("auth_tokens/"))
            return reply(502,{error:"Token sementara Google tidak sah.",reason:"TOKEN_FORMAT"});
          rate(ip,true);
          return reply(200,{
            token:json.name,model:candidate,durationSeconds:600,
            notice:"Setiap sambungan Google sekitar 10 minit. Bilik Antara boleh cuba memperbaharui sambungan sehingga 24 jam jika tab kekal aktif, tertakluk pada kuota dan sokongan Google."
          });
        }
        lastStatus=response.status;
        lastReason=String(json?.error?.status||"UPSTREAM").slice(0,40);
        lastMessage=String(json?.error?.message||"").slice(0,400);
        console.warn("[bilik-antara-voice] token refused",{
          httpStatus:lastStatus,reason:lastReason,model:candidate,variant
        });
        // Some Google projects reject the optional liveConnectConstraints field
        // itself. Google's REST docs explicitly support a one-use ephemeral
        // token without that field. This is a fallback ONLY for that specific
        // 400, never an attempt to bypass denied access, quotas or billing.
        if(lastStatus===400&&/liveConnectConstraints|live_connect_constraints/i.test(lastMessage)){
          const shortToken={
            uses:1,expireTime:new Date(now+5*60*1000).toISOString(),
            newSessionExpireTime:new Date(now+90*1000).toISOString()
          };
          const fallback=await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens",{
            method:"POST",
            headers:{"Content-Type":"application/json","x-goog-api-key":key},
            body:JSON.stringify(shortToken),signal:controller.signal
          });
          const bare=await fallback.json().catch(()=>({}));
          tried.push("short-lived-token · Live API only");
          if(fallback.ok){
            if(typeof bare.name!=="string"||!bare.name.startsWith("auth_tokens/"))
              return reply(502,{error:"Token sementara Google tidak sah.",reason:"TOKEN_FORMAT"});
            rate(ip,true);
            return reply(200,{
              token:bare.name,
              // If the project rejects model-bound credentials, preserve the
              // previously verified standard Live path instead of guessing
              // whether an unconstrained credential permits extended thinking.
              model:candidate==="gemini-3.8-live-extended-thinking"?"gemini-3.8-live":candidate,
              durationSeconds:300,
              tokenMode:"temporary-live-only",
              notice:"Token Live sementara sah lima minit untuk membuka sambungan. Ini bukan tempoh keseluruhan penggunaan harian; penyambungan semula memerlukan token baharu."
            });
          }
          lastStatus=fallback.status;
          lastReason=String(bare?.error?.status||"UPSTREAM").slice(0,40);
          lastMessage=String(bare?.error?.message||"").slice(0,400);
          console.warn("[bilik-antara-voice] short-lived fallback refused",{
            httpStatus:lastStatus,reason:lastReason
          });
          break outer;
        }
        // Never keep retrying on bad credentials, quota or paid-plan errors.
        if(lastStatus!==400&&lastStatus!==404)break outer;
        if(lastStatus===404)break; // A nonexistent model cannot be fixed by config.
      }
    }
    const lower=lastMessage.toLowerCase();
    const error=/billing|payment|restricted.*tier/.test(lower)?"Google menyatakan projek memerlukan akses/bil yang sesuai. Tiada caj atau pelan ditukar oleh Bilik Antara.":
      /leaked|blocked.*key/.test(lower)?"Kunci API projek disekat oleh Google. Semak kunci di AI Studio.":
      lastStatus===429?"Kuota Gemini Live percuma penuh buat sementara (429).":
      [401,403].includes(lastStatus)?"Kunci atau projek API tidak dibenarkan menggunakan Gemini Live ("+lastStatus+").":
      [400,404].includes(lastStatus)?"Google menolak tetapan token Voice untuk model yang dicuba. Semak akses Live API dan konfigurasi (HTTP "+lastStatus+").":
      "Google tidak mengeluarkan token Voice (HTTP "+lastStatus+").";
    const diagnostic=["INVALID_ARGUMENT","PERMISSION_DENIED","RESOURCE_EXHAUSTED","NOT_FOUND"].includes(lastReason)?lastReason:"UPSTREAM";
    const fieldIssue=/liveConnectConstraints|live_connect_constraints/i.test(lastMessage)?"TOKEN_CONSTRAINTS":
      /newSessionExpireTime|new_session_expire_time/i.test(lastMessage)?"TOKEN_SESSION_EXPIRY":
      /expireTime|expire_time/i.test(lastMessage)?"TOKEN_EXPIRY":
      /model/i.test(lastMessage)?"MODEL_ACCESS":
      /API key|api_key/i.test(lastMessage)?"API_KEY":
      /audio|modality|config/i.test(lastMessage)?"LIVE_CONFIG":"UNKNOWN";
    return reply(lastStatus===429?429:502,{
      error,reason:"TOKEN_HTTP_"+lastStatus,diagnostic,fieldIssue,
      triedModels:tried,
      hint:"Jika masalah berulang, semak akses Gemini Live dan model tersedia dalam Google AI Studio."
    });
  }catch(e){
    return reply(502,{error:"Sambungan token Voice gagal. Cuba semula.",reason:"TOKEN_NETWORK"});
  }finally{clearTimeout(timeout);}
};
