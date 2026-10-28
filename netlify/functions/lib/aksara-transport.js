"use strict";
// Shared bounds keep complete recent turns where possible and explicitly mark omissions.
function boundedText(value,limit=32000){
 const text=typeof value==="string"?value.trim():"";
 if(text.length<=limit)return text;
 const marker="\n[... bahagian tengah dipendekkan kerana had konteks; minta petikan asal jika perlu ...]\n";
 if(limit<=marker.length)return text.slice(-limit);
 const room=Math.max(0,limit-marker.length),head=Math.ceil(room*.6);
 return text.slice(0,head)+marker+text.slice(-(room-head));
}
function boundedHistory(value,budget=120000){
 if(!Array.isArray(value))return [];
 const rows=value.slice(-24).filter(m=>m&&(m.role==="user"||m.role==="assistant")&&typeof m.content==="string"&&m.content.trim());
 const result=[];
 for(let i=rows.length-1;i>=0&&budget>0;i--){
  const content=boundedText(rows[i].content,Math.min(32000,budget));
  result.unshift({role:rows[i].role,content});budget-=content.length;
 }
 // A truncated window should not start with an orphan assistant turn.
 if(result.length>1&&result[0].role==="assistant")result.shift();
 return result;
}
function requestControl(timeoutMs,parent){
 const controller=new AbortController();
 const abort=()=>controller.abort(parent?.reason);
 if(parent?.aborted)abort();else parent?.addEventListener("abort",abort,{once:true});
 const timer=setTimeout(()=>controller.abort(),Math.max(1,timeoutMs));
 return {signal:controller.signal,close(){clearTimeout(timer);parent?.removeEventListener("abort",abort);}};
}
async function readSSE(body,consume){
 const reader=body.getReader(),decoder=new TextDecoder();let buffer="";
 const block=text=>{
  const data=text.split(/\r?\n/).filter(l=>l.startsWith("data:")).map(l=>l.slice(5).trimStart()).join("\n");
  if(!data||data==="[DONE]")return;
  let parsed;try{parsed=JSON.parse(data);}catch(_){throw new Error("Aliran AI tidak sah.");}
  if(parsed.error)throw new Error("Aliran AI terhenti.");
  consume(parsed);
 };
 try{
  while(true){
   const {value,done}=await reader.read();
   buffer+=done?decoder.decode():decoder.decode(value,{stream:true});
   if(buffer.length>1000000)throw new Error("Aliran AI melebihi had.");
   const blocks=buffer.split(/\r?\n\r?\n/);buffer=blocks.pop()||"";
   for(const text of blocks)block(text);
   if(done){if(buffer.trim())block(buffer);break;}
  }
 }finally{try{await reader.cancel();}catch(_){}reader.releaseLock();}
}
module.exports={boundedText,boundedHistory,requestControl,readSSE};
