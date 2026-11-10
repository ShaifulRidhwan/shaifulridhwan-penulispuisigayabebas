"use strict";
/* Netlify bridge to Cloudflare's native Workers AI REST endpoint.
 * No AI Gateway unified billing, no prompt logging, no browser credentials.
 * Retains the binding-style ai.run interface used by the original router.
 */
const MODEL="@cf/zai-org/glm-4.7-flash";
const BASE="https://api.cloudflare.com/client/v4/accounts/";
function settings(env=process.env){
 if(env.AKSARA_FREE_FALLBACKS!=="true"||env.AKSARA_WORKERS_REST_ENABLED==="false")return null;
 const account=String(env.CLOUDFLARE_ACCOUNT_ID||"").trim();
 const token=String(env.CLOUDFLARE_WORKERS_AI_TOKEN||env.CLOUDFLARE_API_TOKEN||env.CLOUDFLARE_AUTH_TOKEN||"").trim();
 if(!/^[0-9a-f]{32}$/i.test(account)||token.length<12||/\s/.test(token))return null;
 return {account,token};
}
// Safe, non-secret readiness diagnostics. A configured adapter is not yet a
// verified inference. No credential value, account ID or prompt is returned.
function readiness(env=process.env){
 if(env.AKSARA_FREE_FALLBACKS!=="true")return {enabled:false,reason:"fallbacks_disabled"};
 if(env.AKSARA_WORKERS_REST_ENABLED==="false")return {enabled:false,reason:"rest_disabled"};
 if(!/^[0-9a-f]{32}$/i.test(String(env.CLOUDFLARE_ACCOUNT_ID||"").trim()))
  return {enabled:false,reason:"missing_or_invalid_account"};
 const token=String(env.CLOUDFLARE_WORKERS_AI_TOKEN||env.CLOUDFLARE_API_TOKEN||env.CLOUDFLARE_AUTH_TOKEN||"").trim();
 if(token.length<12||/\s/.test(token))return {enabled:false,reason:"missing_or_invalid_token"};
 return {enabled:true,reason:"adapter_configured"};
}
async function probe(ai,{signal,timeoutMs=7500}={}){
 const start=Date.now();
 if(!ai||typeof ai.run!=="function")return {id:"workers_ai",status:"off",reason:"not_configured"};
 try{
  // Manual-only synthetic smoke: no user questions, sessions, or private context.
  const result=await ai.run(MODEL,{
   messages:[{role:"user",content:"Reply with the word OK."}],
   max_completion_tokens:256,stream:false,
   chat_template_kwargs:{enable_thinking:false,clear_thinking:true},store:false
  },{signal,timeoutMs});
  const content=result?.choices?.[0]?.message?.content??result?.response??"";
  const text=typeof content==="string"?content:
   Array.isArray(content)?content.filter(x=>x?.type==="text").map(x=>x.text).join(""):"";
  if(!String(text).trim())return {id:"workers_ai",model:MODEL,status:"ready",reason:"empty_probe_reply",latencyMs:Date.now()-start};
  return {id:"workers_ai",model:MODEL,status:"online",reason:"inference_verified",latencyMs:Date.now()-start};
 }catch(error){
  const status=Number(error?.status)||0;
  const timeout=error?.name==="TimeoutError"||error?.name==="AbortError"||status===504;
  const reason=timeout?"probe_timeout":
   status===429?"quota":status===401||status===403?"authorization_or_access":
   status===400||status===404?"model_or_request_rejected":
   status>=500?"upstream_unavailable":"transport_error";
  return {id:"workers_ai",model:MODEL,status:timeout?"ready":"offline",
   reason,...(status?{http:status}:{}),latencyMs:Date.now()-start};
 }
}
function create({env=process.env,fetchFn=globalThis.fetch}={}){
 const config=settings(env);
 if(!config||typeof fetchFn!=="function")return null;
 return {
  async run(model,input,{signal,timeoutMs}={}){
   // Explicit allowlist avoids letting a prompt or caller make arbitrary API requests.
   if(model!==MODEL)throw Object.assign(new Error("Workers AI model not allowed"),{status:400});
   const payload={messages:Array.isArray(input?.messages)?input.messages:[],
     temperature:Number.isFinite(input?.temperature)?input.temperature:0.35,
     max_completion_tokens:Math.min(1700,Math.max(128,Number(input?.max_completion_tokens)||650)),
     stream:input?.stream===true,
     chat_template_kwargs:input?.chat_template_kwargs||{enable_thinking:false,clear_thinking:true},
     store:false};
   if(!payload.messages.length)throw Object.assign(new Error("Workers AI messages required"),{status:400});
   // Keep the REST fallback inside Netlify's response budget. Streaming
   // previously waited 40s while Netlify's NDJSON route expired at 26s.
   const ms=Math.min(payload.stream?17000:12000,Math.max(1000,Number(timeoutMs)||Infinity));
   const timeout=signal?AbortSignal.any([signal,AbortSignal.timeout(ms)]):AbortSignal.timeout(ms);
   let response;
   try{
    response=await fetchFn(BASE+config.account+"/ai/run/"+MODEL,{
     method:"POST",headers:{Authorization:"Bearer "+config.token,"Content-Type":"application/json",Accept:payload.stream?"text/event-stream":"application/json"},
     body:JSON.stringify(payload),signal:timeout,redirect:"error",cache:"no-store"
    });
   }catch(e){
    throw Object.assign(new Error("Workers AI REST transport failed"),{
     status:e?.name==="TimeoutError"||e?.name==="AbortError"?504:503,
     errorType:e?.name==="TimeoutError"?"timeout":"transport_error"
    });
   }
   if(!response.ok){
    // Never surface raw body, token, request, or account ID to callers.
    const status=Number(response.status)||502;
    throw Object.assign(new Error("Workers AI REST HTTP "+status),{
     status,errorType:status===429?"rate_limit":[401,403].includes(status)?"authorization_or_access":"upstream_http"
    });
   }
   if(payload.stream){
    if(!/text\/event-stream/i.test(response.headers.get("content-type")||"")||!response.body?.getReader)
     throw Object.assign(new Error("Workers AI REST stream unavailable"),{status:502,errorType:"invalid_stream"});
    return response.body;
   }
   let data;
   try{data=await response.json();}catch(_){throw Object.assign(new Error("Workers AI REST invalid JSON"),{status:502});}
   if(data?.success===false)
    throw Object.assign(new Error("Workers AI REST rejected inference"),{status:502,errorType:"api_rejected"});
   const result=data?.result??data;
   if(!result||typeof result!=="object")throw Object.assign(new Error("Workers AI REST empty result"),{status:502});
   return result;
  }
 };
}
module.exports={MODEL,settings,readiness,probe,create};
