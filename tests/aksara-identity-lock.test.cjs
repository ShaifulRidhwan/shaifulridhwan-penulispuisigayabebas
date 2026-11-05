"use strict";
/* Explicit identity compatibility lock for P0–P2 integration. No external API
 * calls, uploads, network fetches or production mutation. To intentionally
 * revise identity later, review and update the fingerprint and contracts.
 * v0.4: code-chat also resolves a bare explicit run command; still requires a click to execute;
 * creator identity, personality and provider locks remain untouched.
 * Voice fingerprint reviewed for the authorized classic UI, volume and resume fix (2026-11-04). */
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const crypto=require("node:crypto");
const Identity=require("../bilik-antara-identity");
const Brain=require("../bilik-antara-brain");
const Modes=require("../bilik-antara-modes");
const ChatStyle=require("../bilik-antara-chat-style");
const {handler}=require("../netlify/functions/bilik-antara");
const protectedFiles=Object.freeze({
 "bilik-antara-identity.js":"5ade3406d8d730e10a0e2c945cc8c5b3dae647af",
 "bilik-antara-brain.js":"edb5b73fd35d7b070c4623385ee4b12817df268d",
 "bilik-antara-modes.js":"30e8ebb88cee73529c7493a637986c5155357e51",
 "bilik-antara-chat-style.js":"9fc607daf19e2e838d29b7905fce63a2da1ecf78",
 "bilik-antara-voice.js":"aa649b09fdabe5d485eccfb959ff82ee4cc460e2",
 "netlify/functions/aksara-provider-router.js":"f364a7ac8c0d896a4c39987c24af036b3bbb3428",
 "bilik-antara-code-chat.js":"cbc4d15a7dc4a92375372927da85c7a62f5b62eb"
});
function gitBlob(bytes){
 const prefix=Buffer.from("blob "+bytes.length+"\0");
 return crypto.createHash("sha1").update(prefix).update(bytes).digest("hex");
}
test("identity, Voice and intentionally approved capability router fingerprints remain locked",()=>{
 for(const [name,expected] of Object.entries(protectedFiles))
  assert.equal(gitBlob(fs.readFileSync(name)),expected,"Identity lock changed: "+name);
});
test("identity fundamentals, model provenance, creator and Coder Poet remain unchanged",()=>{
 assert.equal(Identity.NAME,"Aksara A.I.");
 assert.equal(Identity.ROOM,"Bilik Antara");
 assert.equal(Identity.CREATOR,"Shaiful Ridhwan");
 assert.equal(Identity.BASE,"Google Gemini");
 assert.deepEqual([...Identity.TEXT_PROVIDERS],["Google Gemini","Groq","Cloudflare Workers AI","OpenRouter"]);
 assert.equal(Identity.answerIdentity("Siapa Aku"),Identity.WHO_AM_I);
 assert.equal(Identity.answerIdentity("The Coder Poet"),Identity.CODER_POET_ANSWER);
 assert.match(Identity.answerIdentity("Siapa cipta kau?"),/Shaiful Ridhwan/);
 assert.ok(Brain.CORE.includes("Aksara"));
 assert.match(Identity.RUNTIME_PROMPT,/Aksara A\.I\./);
 assert.match(Identity.CORE_PROMPT,/Nama rasmi kau Aksara A\.I\./);
});
test("CAHAYA, GELAP and Voice have distinct stable delivery contracts",()=>{
 assert.equal(Modes.normalize("bogus"),"cahaya");
 assert.match(Modes.instructions("gelap","critique",false),/falsafah|premis|kriti/i);
 assert.match(Identity.VOICE_CORE_PROMPT,/Jangan hasilkan/);
 assert.match(Brain.TEXT_DELIVERY,/DUA emoji/);
 const light=ChatStyle.reply("Aku Aksara.",{mode:"cahaya"});
 const dark=ChatStyle.reply("Aku Aksara.",{mode:"gelap"});
 assert.ok(ChatStyle.count(light)===2);
 assert.ok(ChatStyle.count(dark)===0);
 assert.match(Modes.localIdentity("kau siapa?",Identity),/Aksara A\.I\./);
});
test("P0–P2 extend task handling without replacing existing provider personality system",()=>{
 const source=fs.readFileSync("netlify/functions/bilik-antara.js","utf8");
 assert.ok(source.includes('const PERSONALITY=Brain.CORE+"\\n"+Brain.TEXT_DELIVERY+"\\n"+Identity.RUNTIME_PROMPT'));
 assert.ok(source.includes("const GELAP_PERSONALITY=PERSONALITY.replace(Brain.TEXT_DELIVERY,Modes.DELIVERY)"));
 assert.ok(source.includes('const personality=thoughtMode==="gelap"?GELAP_PERSONALITY:PERSONALITY'));
 assert.ok(source.includes("systemPrefix:personality"),"Fallback receives identical personality prefix");
 assert.ok(source.includes("const baseSystem=personality+"),"Primary model receives identity personality");
 assert.ok(source.includes('const voiceSystemBase=Brain.CORE+'),"Voice keeps shared identity");
 assert.ok(source.includes('const identityReply=(!media.length&&!documentText)?Identity.answerIdentity(question):null'));
 assert.ok(source.includes('if(identityReply&&thoughtMode!=="gelap")'));
 assert.ok(source.includes("const darkIdentity=thoughtMode==="));
 assert.ok(source.includes('outputFormat:Structured.wantsJson(question)?"json":undefined'));
});
test("identity answers remain local in CAHAYA and GELAP, including when web search is configured",async()=>{
 const oldFetch=global.fetch,old=process.env.AKSARA_WEB_SEARCH_ENABLED,key=process.env.BRAVE_SEARCH_API_KEY,gemini=process.env.GEMINI_API_KEY;
 let calls=0;
 global.fetch=async()=>{calls++;throw Error("Local identity must not call an external API");};
 process.env.AKSARA_WEB_SEARCH_ENABLED="true";
 process.env.BRAVE_SEARCH_API_KEY="test-not-a-real-secret";
 process.env.GEMINI_API_KEY="mock-identity-test";
 try{
  for(const [i,mode] of ["cahaya","gelap"].entries()){
   const body={question:"kau siapa?",thoughtMode:mode,history:[]};
   const out=await handler({
    httpMethod:"POST",
    headers:{"x-nf-client-connection-ip":"identity-lock-"+i},
    body:JSON.stringify(body)
   });
   assert.equal(out.statusCode,200,mode);
   const result=JSON.parse(out.body);
   assert.equal(result.model,"project-identity");
   assert.equal(result.thoughtMode,mode);
   assert.match(result.reply,/Aksara A\.I\./);
   assert.match(result.reply,/Bilik Antara/);
   assert.match(result.reply,/Shaiful Ridhwan/);
   if(mode==="gelap")assert.equal(ChatStyle.count(result.reply),0);
   else assert.equal(ChatStyle.count(result.reply),2);
  }
  assert.equal(calls,0);
 }finally{
  global.fetch=oldFetch;
  if(old===undefined)delete process.env.AKSARA_WEB_SEARCH_ENABLED;else process.env.AKSARA_WEB_SEARCH_ENABLED=old;
  if(key===undefined)delete process.env.BRAVE_SEARCH_API_KEY;else process.env.BRAVE_SEARCH_API_KEY=key;
  if(gemini===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=gemini;
 }
});
test("JSON formatting is a formatting exception, not a redefinition of ordinary Aksara voice",()=>{
 const source=fs.readFileSync("bilik-antara.html","utf8");
 assert.ok(source.includes('if(data.outputFormat!=="json")data.reply=window.BilikAntaraChatStyle.reply'));
 assert.ok(source.includes('data?.intro===true?text:window.BilikAntaraChatStyle.reply'));
 assert.ok(source.includes("data?.outputFormat==="+'"json"'+"?text:"));
 assert.ok(source.includes('outputFormat:data.outputFormat||""'));
});
