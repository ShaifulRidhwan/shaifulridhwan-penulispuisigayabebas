"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const Policy=require("../netlify/functions/aksara-hybrid-policy");
const Budget=require("../netlify/functions/lib/aksara-shared-budget");
test("3+1 has three primaries and OpenRouter only as fallback",()=>{
 const p=Policy.decide({task:"conversation",thinking:"low",available:["openrouter","orcarouter","groq","gemini"]});
 assert.deepEqual(p.primaries,["gemini","groq","orcarouter"]);
 assert.equal(p.backup,"openrouter");
 assert.equal(p.geminiFirst,false);
});
test("complex analysis and tool requirements prefer Gemini",()=>{
 for(const opts of [{task:"technical",thinking:"high"},{task:"research",hasTools:true},{task:"general",hasMedia:true}]){
  assert.equal(Policy.decide({...opts,available:["gemini","groq","orcarouter","openrouter"]}).geminiFirst,true);
 }
});
test("failed or unavailable Gemini not falsely required for simple text",()=>{
 assert.equal(Policy.decide({available:["groq","orcarouter","openrouter"]}).geminiFirst,false);
});
function memoryStore(){
 const data=new Map();
 return {data,
  async getWithMetadata(key){return data.has(key)?{data:data.get(key).data,etag:String(data.get(key).etag)}:null;},
  async setJSON(key,value,options){const old=data.get(key);
   if((options.onlyIfNew&&old)||(options.onlyIfMatch&&String(old?.etag)!==String(options.onlyIfMatch)))return {modified:false};
   data.set(key,{data:value,etag:(old?.etag||0)+1});return {modified:true};}
 };
}
test("shared budget counts across callers and rejects exhausted cap",async()=>{
 const store=memoryStore(),now=Date.parse("2026-10-31T16:00:00Z");
 assert.equal((await Budget.reserve({store,cap:2,now})).used,1);
 assert.equal((await Budget.reserve({store,cap:2,now})).used,2);
 await assert.rejects(()=>Budget.reserve({store,cap:2,now}),e=>e.status===429&&e.retryAfterSeconds>0);
});
test("shared budget fails closed on missing storage",async()=>{
 await assert.rejects(()=>Budget.reserve({}),e=>e.status===503);
});
test("chat and voice advertise native Netlify limits",()=>{
 const chat=require("../netlify/functions/bilik-antara");
 const voice=require("../netlify/functions/bilik-antara-live-token");
 assert.equal(chat.config.rateLimit.windowLimit,60);
 assert.equal(voice.config.rateLimit.windowLimit,30);
});
