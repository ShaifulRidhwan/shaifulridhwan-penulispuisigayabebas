import main from "./bilik-antara.js";
// Same validation, personality, tools and routing as the JSON endpoint.
// NDJSON separates partial text from a committed final answer.
const ORIGIN="https://shaifulridhwan-penulispuisigayabebas.netlify.app";
export default async function(request){
 const origin=process.env.ALLOWED_ORIGIN||ORIGIN;
 const headers={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Methods":"POST, OPTIONS",
  "Access-Control-Allow-Headers":"Content-Type","Content-Type":"application/x-ndjson; charset=utf-8",
  "Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Vary":"Origin"};
 const fail=(status,error)=>Response.json({error},{status,headers:{...headers,"Content-Type":"application/json; charset=utf-8"}});
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(request.method!=="POST")return fail(405,"Gunakan POST.");
 if(request.headers.get("origin")&&request.headers.get("origin")!==origin)return fail(403,"Origin tidak dibenarkan.");
 if(Number(request.headers.get("content-length")||0)>5400000)return fail(413,"Permintaan terlalu besar.");
 const body=await request.text();
 if(new TextEncoder().encode(body).length>5400000)return fail(413,"Permintaan terlalu besar.");
 const abort=new AbortController(),encoder=new TextEncoder();let cancelled=false;
 const stop=()=>abort.abort();request.signal.addEventListener("abort",stop,{once:true});
 if(request.signal.aborted)stop();
 const stream=new ReadableStream({
  async start(controller){
   const emit=value=>{if(!cancelled&&!abort.signal.aborted)controller.enqueue(encoder.encode(JSON.stringify(value)+"\n"));};
   emit({type:"start",version:1});
   try{
    // Always send a terminal event before the platform's 30-second limit,
    // including when an upstream reader ignores cancellation.
    let timeout;
    const budget=new Promise(resolve=>{timeout=setTimeout(()=>{
      emit({type:"error",status:504,code:"STREAM_INTERRUPTED",error:"Model ambil masa lama sangat. Mesej kau masih ada.",retryAfterSeconds:3});
      stop();resolve(null);
    },26000);});
    let response;
    try{response=await Promise.race([main.handler({httpMethod:"POST",headers:Object.fromEntries(request.headers),body,
      signal:abort.signal,onDelta:text=>emit({type:"delta",text})}),budget]);}
    finally{clearTimeout(timeout);}
    if(!response)return;
    const data=JSON.parse(response.body||"{}");
    if(response.statusCode>=400)emit({type:"error",status:response.statusCode,...data});
    else emit({type:"done",...data});
   }catch(_){emit({type:"error",status:502,code:"STREAM_INTERRUPTED",error:"Connection jawapan terputus. Cuba lagi."});}
   finally{
    request.signal.removeEventListener("abort",stop);
    if(!cancelled){try{controller.close();}catch(_){}}
   }
  },
  cancel(){cancelled=true;stop();}
 });
 return new Response(stream,{headers});
}
