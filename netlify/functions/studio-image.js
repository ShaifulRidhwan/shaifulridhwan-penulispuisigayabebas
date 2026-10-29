"use strict";
/* Studio Antara: Cloudflare Workers AI image proxy.
 * API credentials never leave the Netlify runtime.
 * Per-instance abuse controls are best-effort, NOT distributed quotas.
 */
const MODEL="@cf/black-forest-labs/flux-1-schnell";
const TIME_WINDOW=10*60*1000;
const LIMIT_PER_WINDOW=3;
const MAX_PROMPT=1200;
const STYLE=Object.freeze({
  cinematic:"cinematic photography, dramatic lighting, refined composition",
  realistic:"photorealistic detail, natural lighting, lifelike textures",
  illustration:"premium editorial illustration, sophisticated color palette",
  minimal:"minimalist composition, elegant negative space, clean lines",
  fantasy:"imaginative fantasy art, atmospheric lighting, intricate detail",
  none:""
});
const clients=new Map();
let inFlight=0;
const headers={
  "Cache-Control":"no-store",
  "Content-Type":"application/json; charset=utf-8",
  "X-Content-Type-Options":"nosniff",
  "X-Robots-Tag":"noindex"
};
function response(status,data){
  return {statusCode:status,headers,body:JSON.stringify(data)};
}
function rateLimited(ip){
  const now=Date.now();
  if(clients.size>500){
    for(const [key,item] of clients)if(now-item.started>=TIME_WINDOW)clients.delete(key);
    if(clients.size>1000)clients.clear();
  }
  const old=clients.get(ip);
  if(!old||now-old.started>=TIME_WINDOW){
    clients.set(ip,{started:now,count:1});
    return false;
  }
  old.count++;
  return old.count>LIMIT_PER_WINDOW;
}
function originMatches(event){
  const origin=event.headers?.origin||event.headers?.Origin;
  if(!origin)return true; // Browser same-origin fetch sends Origin; CLI can omit it.
  const host=String(event.headers?.host||event.headers?.Host||"").toLowerCase();
  try{
    const url=new URL(origin);
    return url.protocol==="https:"&&url.host.toLowerCase()===host;
  }catch(_){return false;}
}
exports.handler=async function(event){
  if(event.httpMethod!=="POST")return response(405,{error:"Gunakan POST untuk menjana imej."});
  if(!originMatches(event))return response(403,{error:"Permintaan bukan daripada Studio Antara."});
  if(!/application\/json/i.test(event.headers?.["content-type"]||event.headers?.["Content-Type"]||""))
    return response(415,{error:"Format permintaan mesti JSON."});
  if(typeof event.body!=="string"||event.body.length>4200)
    return response(413,{error:"Permintaan terlalu besar."});
  let input;
  try{input=JSON.parse(event.body);}catch(_){return response(400,{error:"Data JSON tidak sah."});}
  if(!input||typeof input!=="object"||Array.isArray(input))
    return response(400,{error:"Format data tidak sah."});
  const prompt=typeof input.prompt==="string"?input.prompt.trim():"";
  if(prompt.length<4||prompt.length>MAX_PROMPT)
    return response(400,{error:"Tulis arahan imej antara 4 hingga 1200 aksara."});
  if(typeof input.style!=="string"||!Object.prototype.hasOwnProperty.call(STYLE,input.style))
    return response(400,{error:"Gaya imej tidak dikenali."});
  const steps=Number(input.steps);
  if(steps!==4&&steps!==8)return response(400,{error:"Tetapan kualiti tidak sah."});
  const hasSeed=input.seed!==null&&input.seed!==undefined&&input.seed!=="";
  const seed=hasSeed?Number(input.seed):null;
  if(hasSeed&&(!Number.isSafeInteger(seed)||seed<0||seed>2147483647))
    return response(400,{error:"Seed perlu nombor bulat antara 0 hingga 2147483647."});
  const account=process.env.CLOUDFLARE_ACCOUNT_ID;
  const token=process.env.CLOUDFLARE_API_TOKEN;
  if(!account||!token)return response(503,{error:"Sambungan Cloudflare belum tersedia. Semak Environment Variables di Netlify."});
  if(!/^[a-f0-9]{32}$/i.test(account))return response(503,{error:"Account ID Cloudflare belum dikonfigurasi dengan betul."});
  const ip=String(event.headers?.["x-nf-client-connection-ip"]||event.headers?.["x-forwarded-for"]||"unknown").split(",")[0].trim().slice(0,80)||"unknown";
  if(rateLimited(ip))return response(429,{error:"Had percubaan sementara dicapai. Cuba lagi kemudian."});
  if(inFlight>=2)return response(429,{error:"Studio sedang sibuk. Cuba lagi sebentar."});
  inFlight++;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),48000);
  try{
    const text=prompt+(STYLE[input.style]?", "+STYLE[input.style]:"");
    const payload={prompt:text,steps,...(hasSeed?{seed}:{})};
    const upstream=await fetch("https://api.cloudflare.com/client/v4/accounts/"+account+"/ai/run/"+MODEL,{
      method:"POST",
      headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
      body:JSON.stringify(payload),
      signal:controller.signal
    });
    if(upstream.status===429)return response(429,{error:"Kuota atau had Cloudflare Workers AI dicapai. Cuba semula selepas kuota tersedia."});
    if(upstream.status===401||upstream.status===403)
      return response(502,{error:"Cloudflare menolak token atau kebenaran Workers AI. Semak tetapan API Token."});
    if(!upstream.ok)
      return response(502,{error:"Cloudflare tidak berjaya menjana imej (HTTP "+upstream.status+")."});
    const type=upstream.headers.get("content-type")||"";
    let image=null,mime="image/jpeg";
    if(/^image\/(jpeg|png)/i.test(type)){
      const buffer=Buffer.from(await upstream.arrayBuffer());
      if(buffer.length>0&&buffer.length<=3_500_000){
        image=buffer.toString("base64");
        mime=type.startsWith("image/png")?"image/png":"image/jpeg";
      }
    }else{
      const result=await upstream.json();
      image=typeof result?.result?.image==="string"?result.result.image:
        typeof result?.image==="string"?result.image:null;
      // Sometimes providers return a data URI rather than a raw base64 string.
      if(image&&/^data:image\/(jpeg|png);base64,/i.test(image)){
        mime=image.slice(5,image.indexOf(";")).toLowerCase();
        image=image.slice(image.indexOf(",")+1);
      }
    }
    if(!image||image.length<100||image.length>4_700_000||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(image))
      return response(502,{error:"Cloudflare tidak memulangkan imej dalam format yang disokong."});
    return response(200,{ok:true,image,mime,model:"FLUX.1 Schnell",steps,seed});
  }catch(error){
    if(error?.name==="AbortError")return response(504,{error:"Penjanaan imej mengambil masa terlalu lama. Cuba semula."});
    return response(502,{error:"Sambungan ke Cloudflare gagal. Cuba semula sebentar lagi."});
  }finally{
    clearTimeout(timer);
    inFlight--;
  }
};
