// The public API preserves the old .netlify/functions URLs so the existing
// Bilik Antara and Studio browser scripts can be deployed UNMODIFIED.
// The UI, CSS, animations, persona, Hybrid 3+1 and media rules stay shared.
import Chat from "../../netlify/functions/bilik-antara.js";
import netlifyStream from "../../netlify/functions/bilik-antara-stream.mjs";
import Live from "../../netlify/functions/bilik-antara-live-token.js";
import StudioImage from "../../netlify/functions/lib/studio-image-handler.js";
import StudioEnhance from "../../netlify/functions/lib/studio-enhance-handler.js";
export {AksaraControl} from "./control.mjs";

const OLD_ORIGIN="https://shaifulridhwan-penulispuisigayabebas.netlify.app";
const apis=Object.freeze({
 chat:"/.netlify/functions/bilik-antara",
 stream:"/.netlify/functions/bilik-antara-stream",
 voice:"/.netlify/functions/bilik-antara-live-token",
 studio:"/.netlify/functions/studio-image",
 enhance:"/.netlify/functions/studio-enhance"
});
function json(status,message,retry=0){
 return new Response(JSON.stringify({code:status===429?"RATE_LIMIT":"UNAVAILABLE",error:message,retryAfterSeconds:retry||undefined}),
 {status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",
 ...(retry?{"retry-after":String(retry)}:{})}});
}
function asResponse(result,origin){
 const h=new Headers(result.headers||{});
 h.set("Access-Control-Allow-Origin",origin);
 h.set("Access-Control-Allow-Methods","POST, OPTIONS");
 h.set("Access-Control-Allow-Headers","Content-Type");
 h.set("Vary","Origin");
 h.set("Cache-Control","no-store");
 h.set("X-Content-Type-Options","nosniff");
 return new Response(result.body||null,{status:result.statusCode||500,headers:h});
}
function normalizedHeaders(request,origin,legacyOrigin){
 const headers=Object.fromEntries(request.headers);
 // Ignore spoofed Netlify client IP headers from the caller.
 headers["x-nf-client-connection-ip"]=request.headers.get("cf-connecting-ip")||"unknown";
 // The old Chat and Voice handlers validate a Netlify-origin constant.
 // The Worker has already validated same-origin: give them their expected
 // trusted internal string and rewrite only the outgoing CORS header.
 headers.origin=legacyOrigin?internalOrigin():origin;
 headers.host=new URL(request.url).host;
 return headers;
}
function internalOrigin(){return process.env.ALLOWED_ORIGIN||OLD_ORIGIN;}
async function readBody(request,max){
 const len=Number(request.headers.get("content-length")||0);
 if(len>max)throw Object.assign(Error("Permintaan terlalu besar."),{status:413});
 const bytes=await request.arrayBuffer();
 if(bytes.byteLength>max)throw Object.assign(Error("Permintaan terlalu besar."),{status:413});
 return new TextDecoder().decode(bytes);
}
async function ipHash(request,env){
 const salt=String(env.AKSARA_RATE_SALT||"");
 if(salt.length<32)throw Object.assign(Error("Set AKSARA_RATE_SALT pada Worker dahulu."),{status:503});
 const ip=request.headers.get("cf-connecting-ip")||"unknown",day=new Date().toISOString().slice(0,10);
 const bytes=new TextEncoder().encode(day+"|"+ip+"|"+salt);
 const hash=await crypto.subtle.digest("SHA-256",bytes);
 return Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,"0")).join("").slice(0,32);
}
async function quota(env,kind,request,extra={}){
 if(!env.AKSARA_CONTROL)return {error:json(503,"Durable Object belum disambungkan.")};
 let hash;try{hash=await ipHash(request,env);}catch(e){return {error:json(e.status||503,e.message)};}
 try{
  const stub=env.AKSARA_CONTROL.get(env.AKSARA_CONTROL.idFromName("aksara-control-v1"));
  const response=await stub.fetch("https://aksara-control.internal/",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({kind,hash,...extra})});
  const body=await response.json();
  if(!response.ok)return {error:json(response.status,body.error||"Had Aksara.",body.retryAfterSeconds||60)};
  return {stub,...body};
 }catch(_){return {error:json(503,"Kawalan global Aksara belum tersedia. API ditangguh untuk melindungi kuota.")};}
}
async function release(stub,id){
 if(!stub||!id)return;
 try{await stub.fetch("https://aksara-control.internal/",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({kind:"release",id})});}catch(_){}
}
async function handle(request,env,ctx){
 const url=new URL(request.url),path=url.pathname,origin=url.origin;
 if(path==="/")return Response.redirect(OLD_ORIGIN+"/",302);
 if(!Object.values(apis).includes(path))return env.ASSETS.fetch(request);
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{
  "access-control-allow-origin":origin,"access-control-allow-methods":"POST, OPTIONS",
  "access-control-allow-headers":"Content-Type","vary":"Origin"}});
 if(request.method!=="POST")return json(405,"Gunakan POST.");
 // Require a same-origin caller on public POST APIs, including preflight-less
 // direct browser requests; Netlify continues to serve on its own origin.
 if(request.headers.get("origin")!==origin)return json(403,"Origin tidak dibenarkan.");
 const isStudio=path===apis.studio||path===apis.enhance;
 const limit=isStudio?7000:path===apis.voice?100:5400000;
 // Status probes are inexpensive, but must still be rate-limited. They do
 // not spend the global daily inference budget or count as AI answers.
 let body=null,health=false;
 if(path===apis.chat){
  try{
   body=await readBody(request,limit);
   const data=JSON.parse(body);
   health=data&&typeof data==="object"&&(data.probe===true||data.providerStatus===true);
  }catch(e){return json(e.status||400,e.status?e.message:"JSON tidak sah.");}
 }
 const controls=path===apis.chat?(health?"health":"chat"):
  path===apis.stream?"chat":path===apis.voice?"voice":null;
 let pass=null;
 if(controls){pass=await quota(env,controls,request);if(pass.error)return pass.error;}
 if(path===apis.stream){
  const h=new Headers(request.headers);
  h.set("origin",internalOrigin());
  h.set("x-nf-client-connection-ip",request.headers.get("cf-connecting-ip")||"unknown");
  const adapted=new Request(request,{headers:h});
  const result=await netlifyStream(adapted);
  const out=new Headers(result.headers);
  out.set("Access-Control-Allow-Origin",origin);
  out.set("Cache-Control","no-store");
  return new Response(result.body,{status:result.status,headers:out});
 }
 if(body===null)try{body=await readBody(request,limit);}catch(e){return json(e.status||400,e.message);}
 // Studio validates Origin against the actual request Host; the legacy
 // Netlify origin is only needed by Chat/Voice compatibility handlers.
 const headers=normalizedHeaders(request,origin,!isStudio);
 const event={httpMethod:"POST",headers,body,signal:request.signal,isBase64Encoded:false};
 if(path===apis.chat)return asResponse(await Chat.handler(event),origin);
 if(path===apis.voice)return asResponse(await Live.handler(event),origin);
 // Preserve old Studio image-generation payloads, estimate and media parsing.
 // Replace Netlify Blobs ledger with a shared, transactional Cloudflare DO.
 const reserve=async(e,cost,kind="image")=>{
  const selected=await quota(env,"studio",request,{cost,action:kind});
  if(selected.error){
   let msg="Kawalan bajet Studio tidak tersedia.",wait=60;
   try{const data=await selected.error.json();msg=data.error||msg;wait=data.retryAfterSeconds||wait;}catch(_){}
   throw Object.assign(Error(msg),{status:selected.error.status,retryAfter:wait});
  }
  return ()=>release(selected.stub,selected.id);
 };
 // The Worker still uses existing Cloudflare Workers AI REST credentials
 // initially to preserve exact image model request/response behavior.
 const handler=(path===apis.studio?StudioImage:StudioEnhance).createHandler({
  env:{...env},fetchImpl:fetch,reserve
 });
 return asResponse(await handler(event),origin);
}
export default {fetch:handle};
