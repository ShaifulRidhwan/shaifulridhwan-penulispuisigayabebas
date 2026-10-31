"use strict";
/*
 * Android OWNER QA Gemini Live broker. Authentication precedes all provider
 * requests; tokens are short-lived, one-use and never contain the API key.
 * Web Origin policy remains intact in the independent website endpoint.
 */
const {authorizeBearer}=require("./aksara-mobile-owner-auth");

const MAX_INPUT=128;
const json=(status,body,extra={})=>new Response(JSON.stringify(body),{
  status,headers:{
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store",
    "X-Content-Type-Options":"nosniff",
    ...extra
  }
});
function authorized(headers,env){
  return authorizeBearer(
    headers.get("authorization"),
    env.AKSARA_MOBILE_STUDIO_TOKEN_SHA256
  );
}
function modelCandidates(mode,env){
  const configured=env.GEMINI_LIVE_MODEL;
  const options=new Set(["gemini-3.8-live-extended-thinking","gemini-3.8-live",
    "gemini-3.1-flash-live-preview"]);
  const preferred=options.has(configured)?configured:"gemini-3.8-live";
  if(mode==="standard")return ["gemini-3.8-live","gemini-3.1-flash-live-preview"];
  return [preferred,...["gemini-3.8-live","gemini-3.1-flash-live-preview"].filter(
    m=>m!==preferred)];
}
async function parseRequest(request){
  const length=Number(request.headers.get("content-length")||0);
  if(length>MAX_INPUT)return {error:"Permintaan terlalu besar."};
  const data=await request.text();
  if(Buffer.byteLength(data)>MAX_INPUT)return {error:"Permintaan terlalu besar."};
  let config;
  try{config=data?JSON.parse(data):{};}catch(_){return {error:"JSON tidak sah."};}
  if(!config||Array.isArray(config)||typeof config!=="object"||
     Object.keys(config).some(k=>k!=="mode") ||
     (config.mode!==undefined && config.mode!=="standard" && config.mode!=="auto"))
    return {error:"Pilihan Voice tidak sah."};
  return {mode:config.mode==="standard"?"standard":"auto"};
}
async function createLiveToken(request,context,{
  env=process.env,
  fetchImpl=fetch,
  reserve=async()=>true,
  now=()=>Date.now()
}={}){
  if(request.method!=="POST")return json(405,{error:"Gunakan POST."});
  const auth=authorized(request.headers,env);
  if(auth==="unconfigured")return json(503,{error:"Broker Android belum dikonfigurasi."});
  if(auth!=="authorized")return json(401,{error:"Token pemilik tidak sah."});
  const input=await parseRequest(request);
  if(input.error)return json(input.error.includes("besar")?413:400,{error:input.error});
  const key=env.GEMINI_API_KEY;
  if(!key)return json(503,{error:"Gemini Live belum dikonfigurasi."});
  let permit;
  try{permit=await reserve(context);}catch(_){
    return json(503,{error:"Kawalan kuota Live tidak tersedia."});
  }
  if(!permit)return json(429,{error:"Kuota Voice Live ujian pemilik dicapai."},
    {"Retry-After":"60"});

  const current=now();
  const deadline=new AbortController();
  const timer=setTimeout(()=>deadline.abort(),18000);
  try{
    let lastStatus=502;
    for(const model of [...new Set(modelCandidates(input.mode,env))]){
      const options={
        uses:1,
        expireTime:new Date(current+5*60_000).toISOString(),
        newSessionExpireTime:new Date(current+60_000).toISOString(),
        liveConnectConstraints:{model:"models/"+model}
      };
      let res;
      try{
        res=await fetchImpl(
          "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
          {
            method:"POST",
            headers:{"x-goog-api-key":key,"Content-Type":"application/json"},
            body:JSON.stringify(options),
            signal:deadline.signal
          }
        );
      }catch(_){return json(502,{error:"Google Live tidak dapat dihubungi."});}
      lastStatus=res.status;
      const body=await res.json().catch(()=>({}));
      if(res.ok){
        if(typeof body.name!=="string"||!/^auth_tokens\/[A-Za-z0-9_-]{10,2048}$/.test(body.name))
          return json(502,{error:"Respons token Google tidak sah."});
        return json(200,{
          token:body.name,model,
          tokenSeconds:300,connectWithinSeconds:60,
          notice:"Token sementara satu penggunaan. Sambungan baharu memerlukan token baharu."
        });
      }
      // Do not bypass quota, permission or billing errors by changing models.
      if([401,403,429].includes(lastStatus))break;
      if(![400,404].includes(lastStatus))break;
    }
    return json(lastStatus===429?429:502,{
      error:lastStatus===429?"Kuota Gemini Live telah dicapai.":
        "Google menolak permintaan token Live (HTTP "+lastStatus+").",
      reason:"TOKEN_HTTP_"+lastStatus
    });
  }finally{
    clearTimeout(timer);
  }
}

/**
 * Durable rate reservation using conditional claim-a-key slots.
 * Netlify Blobs is NOT a transactional counter database. We never perform a
 * read-modify-write counter: onlyIfNew claims an independent immutable key,
 * so a successful allocation cannot exceed the configured per-scope slots.
 *
 * Reservations are conservative: if a later scope is full, earlier claims
 * remain spent. This can block additional requests sooner, never later.
 * Fixed 10-minute buckets may be stricter than a rolling window.
 */
async function reserveDurableVoice(context,store){
  if(!store || typeof store.setJSON!=="function")throw Error("Missing durable store");
  const {createHash,randomInt}=require("node:crypto");
  const now=Date.now();
  const utcDay=new Date(now).toISOString().slice(0,10);
  const tenMinuteBucket=Math.floor(now/600000);
  // Hash the trusted Netlify request IP with the owner secret digest and day.
  // Neither IP nor the bearer token appears in object key names.
  const ip=String(context?.ip||"unknown").slice(0,80);
  const ownerDigest=String(process.env.AKSARA_MOBILE_STUDIO_TOKEN_SHA256||"");
  const client=createHash("sha256").update(utcDay+"|"+ip+"|"+ownerDigest)
    .digest("hex").slice(0,24);
  async function claim(prefix,capacity){
    const start=randomInt(capacity);
    for(let offset=0;offset<capacity;offset++){
      const index=(start+offset)%capacity;
      const result=await store.setJSON(
        prefix+"/"+String(index).padStart(3,"0"),
        {createdAt:now},
        {onlyIfNew:true}
      );
      if(result?.modified===true)return true;
    }
    return false;
  }
  // Reserve in descending scope to reject most traffic early.
  if(!await claim("voice/global/"+utcDay,80))return false;
  if(!await claim("voice/client/day/"+utcDay+"/"+client,30))return false;
  if(!await claim("voice/client/ten-minute/"+tenMinuteBucket+"/"+client,6))return false;
  return true;
}
module.exports={createLiveToken,reserveDurableVoice,modelCandidates,parseRequest};
