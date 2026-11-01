"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const Router=require("../netlify/functions/aksara-provider-router");
const Identity=require("../bilik-antara-identity");
const model="@cf/zai-org/glm-4.7-flash";
test("Workers AI receives complete Aksara identity, context, and Malay guidance",async()=>{
 const old={fall:process.env.AKSARA_FREE_FALLBACKS,groq:process.env.GROQ_API_KEY,router:process.env.OPENROUTER_API_KEY};
 process.env.AKSARA_FREE_FALLBACKS="true";delete process.env.GROQ_API_KEY;delete process.env.OPENROUTER_API_KEY;
 const calls=[];
 const ai={run:async(m,input)=>{calls.push({m,input});return {response:"Aku Aksara A.I. Boleh, kita bedah dulu logiknya."};}};
 try{
  const answer=await Router.complete({cloudflareAI:ai,system:Identity.CORE_PROMPT+"\nMOD: GELAP",history:[{role:"user",content:"Aku nak bincang falsafah"},{role:"assistant",content:"Boleh."}],question:"Sambung topik tadi",task:"critique",deadline:Date.now()+10000});
  assert.equal(answer.provider,"workers_ai");
  assert.equal(calls[0].m,model);
  assert.match(calls[0].input.messages[0].content,/Aksara A\.I\./);
  assert.match(calls[0].input.messages[0].content,/Bahasa Melayu Malaysia/);
  assert.match(calls[0].input.messages[0].content,/GELAP/);
  assert.equal(calls[0].input.messages.at(-1).content,"Sambung topik tadi");
  assert.equal(calls[0].input.messages.length,4);
  assert.match(answer.reply,/Aku Aksara/);
 }finally{
  if(old.fall===undefined)delete process.env.AKSARA_FREE_FALLBACKS;else process.env.AKSARA_FREE_FALLBACKS=old.fall;
  if(old.groq===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=old.groq;
  if(old.router===undefined)delete process.env.OPENROUTER_API_KEY;else process.env.OPENROUTER_API_KEY=old.router;
 }
});
test("Workers AI SSE sends complete user-visible text and never leaks internal reasoning",async()=>{
 const old={fall:process.env.AKSARA_FREE_FALLBACKS,groq:process.env.GROQ_API_KEY,router:process.env.OPENROUTER_API_KEY};
 process.env.AKSARA_FREE_FALLBACKS="true";delete process.env.GROQ_API_KEY;delete process.env.OPENROUTER_API_KEY;
 const events=[
  'data: '+JSON.stringify({choices:[{delta:{content:"Aku Aksara."}}]})+'\n\n',
  'data: '+JSON.stringify({choices:[{delta:{reasoning_content:"internal",content:" Kita sambung."},finish_reason:"stop"}]})+'\n\n',
  "data: [DONE]\n\n"
 ];
 const bytes=new TextEncoder();
 const ai={run:async()=>new ReadableStream({start(c){events.forEach(x=>c.enqueue(bytes.encode(x)));c.close();}})};
 let chunks=[];
 try{
  const answer=await Router.complete({cloudflareAI:ai,system:"Identiti Aksara; Bahasa Melayu Malaysia",history:[],question:"Kenapa?",onDelta:x=>chunks.push(x),deadline:Date.now()+10000});
  assert.equal(answer.provider,"workers_ai");
  assert.equal(chunks.join(""),"Aku Aksara. Kita sambung.");
  assert.doesNotMatch(chunks.join(""),/internal/);
 }finally{
  if(old.fall===undefined)delete process.env.AKSARA_FREE_FALLBACKS;else process.env.AKSARA_FREE_FALLBACKS=old.fall;
  if(old.groq===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=old.groq;
  if(old.router===undefined)delete process.env.OPENROUTER_API_KEY;else process.env.OPENROUTER_API_KEY=old.router;
 }
});
