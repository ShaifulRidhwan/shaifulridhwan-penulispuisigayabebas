// One-call NVIDIA NIM inference probe. Does not expose token, prompt, response,
// reasoning output or provider error body to the visitor or logs.
// NVIDIA API catalog OpenAI-compatible chat endpoint supports streamed SSE.
const ENDPOINT="https://integrate.api.nvidia.com/v1/chat/completions";
const MESSAGE=[{role:"system",content:"Jawab ringkas dalam Bahasa Melayu Malaysia."},
 {role:"user",content:"Terangkan satu maksud metafora dalam satu ayat."}];
function extractContent(choice){
 const msg=choice?.message||choice?.delta||{};
 const value=msg.content;
 return typeof value==="string"?value:Array.isArray(value)?value.filter(x=>x?.type==="text").map(x=>String(x.text||"")).join(""):"";
}
async function parseSSE(res){
 if(!res.body)return {output:false,reason:"empty_stream"};
 const reader=res.body.getReader();
 const decoder=new TextDecoder();
 let buffer="",visible="",events=0,done=false;
 try{
  while(!done&&events<2500&&visible.length<6000){
   const {value,done:ended}=await reader.read();
   if(ended)break;
   buffer+=decoder.decode(value,{stream:true});
   if(buffer.length>100000)return {output:false,reason:"invalid_stream"};
   // Standard SSE framing; normalize CRLF.
   buffer=buffer.replace(/\r\n/g,"\n");
   let pos;
   while((pos=buffer.indexOf("\n\n"))!==-1){
    const frame=buffer.slice(0,pos);buffer=buffer.slice(pos+2);
    for(const line of frame.split("\n")){
     if(!line.startsWith("data:"))continue;
     const payload=line.slice(5).trim();
     if(payload==="[DONE]"){done=true;break;}
     try{
      const data=JSON.parse(payload);
      const next=extractContent(data?.choices?.[0]);
      if(next)visible=(visible+next).slice(0,6000);
      events++;
     }catch(_){/* ignore non-chat heartbeat */ }
    }
    if(done)break;
   }
  }
 }finally{try{await reader.cancel()}catch(_){}}
 return {output:visible.trim().length>=5,reason:visible.trim().length>=5?"reply_received":"empty_visible_content",streamEvents:events,streamDone:done};
}
export async function probeNvidia(model,apiKey,fetcher=fetch,timeoutMs=28000){
 const started=Date.now(),signal=AbortSignal.timeout(timeoutMs);
 try{
  const res=await fetcher(ENDPOINT,{
   method:"POST",headers:{"Authorization":"Bearer "+apiKey,
    "Content-Type":"application/json","Accept":"text/event-stream"},
   body:JSON.stringify({model,stream:true,max_tokens:1024,temperature:1,top_p:0.95,messages:MESSAGE}),
   signal
  });
  if(!res.ok)return {ok:false,http:res.status,reason:
    res.status===401?"invalid_token":res.status===402?"trial_quota_or_billing":
    res.status===403?"access_restricted":res.status===404?"model_unavailable":
    res.status===422||res.status===400?"request_rejected":
    res.status===429?"rate_limited":"upstream_unavailable",elapsedMs:Date.now()-started};
  let status;
  if(/text\/event-stream/i.test(res.headers.get("content-type")||""))status=await parseSSE(res);
  else {
   const data=await res.json().catch(()=>({}));
   const text=extractContent(data?.choices?.[0]).trim();
   status={output:text.length>=5,reason:text.length>=5?"reply_received":"empty_visible_content"};
  }
  return {ok:status.output,http:res.status,reason:status.reason,
   elapsedMs:Date.now()-started,...(status.streamEvents!==undefined?{streamEvents:status.streamEvents,streamDone:status.streamDone}:{})};
 }catch(e){return {ok:false,reason:
  e?.name==="TimeoutError"||e?.name==="AbortError"?"timeout":"network_unavailable",elapsedMs:Date.now()-started};}
}
export function chooseProbeModels(list,selected,max=3){
 const available=new Set(list.map(x=>x.id));
 const priority=["nvidia/nemotron-3.5-bolt-e4b","nvidia/nemotron-3.5-lightning-30b-a3b",
   "z-ai/glm-5-3-flash","minimaxai/minimax-m3.1-flash","mistralai/mistral-large-4-1t-a52b"];
 const candidates=[...priority,...(selected&&selected!=="deepseek-ai/deepseek-v4.1-flash"?[selected]:[]),
   ...list.filter(x=>x.trialEndpointLabel).map(x=>x.id),
   ...list.map(x=>x.id)];
 return [...new Set(candidates)].filter(x=>available.has(x)).slice(0,max);
}
