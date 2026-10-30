"use strict";
// Offline architecture regression: all API requests are mocked. No provider quota used.
const {test,after}=require("node:test");
const assert=require("node:assert/strict");
const keys=["AKSARA_FREE_FALLBACKS","AKSARA_ORCAROUTER_LAYER2","ORCAROUTER_API_KEY","GROQ_API_KEY","GROQ_FREE_CONFIRMED","OPENROUTER_API_KEY","GEMINI_API_KEY","AKSARA_CROSS_REVIEW"];
const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
const originalFetch=global.fetch;
after(()=>{
 global.fetch=originalFetch;
 for(const key of keys){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}
});
function setup(){
 Object.assign(process.env,{
  AKSARA_FREE_FALLBACKS:"true",AKSARA_ORCAROUTER_LAYER2:"true",
  ORCAROUTER_API_KEY:"mock",GROQ_API_KEY:"mock",GROQ_FREE_CONFIRMED:"true",
  OPENROUTER_API_KEY:"mock",GEMINI_API_KEY:"mock",AKSARA_CROSS_REVIEW:"false"
 });
 for(const path of ["../netlify/functions/aksara-provider-router","../netlify/functions/aksara-model-registry","../netlify/functions/bilik-antara"]){
  delete require.cache[require.resolve(path)];
 }
 return require("../netlify/functions/aksara-provider-router");
}
const ok=(provider="demo")=>Response.json({model:provider,choices:[{message:{content:"Aku Aksara. Ini respons ujian."},finish_reason:"stop"}]});
const fail=()=>new Response(JSON.stringify({error:{message:"upstream unavailable"}}),{status:503,headers:{"content-type":"application/json"}});
const provider=url=>url.includes("api.groq.com")?"groq":url.includes("api.orcarouter.ai")?"orcarouter":url.includes("openrouter.ai")?"openrouter":url.includes("googleapis")?"gemini":"unknown";
test("A preference or recent OpenRouter success cannot outrank Groq/OrcaRouter",()=>{
 const Router=setup();
 const available=Router.configured();
 assert.deepEqual(available.map(p=>p.id),["groq","orcarouter","openrouter"]);
 for(const hard of [false,true]){
  const ranked=Router.rankProviders(available,"technical","openrouter",hard);
  assert.equal(ranked.at(-1).id,"openrouter");
  assert.deepEqual(new Set(ranked.slice(0,-1).map(p=>p.id)),new Set(["groq","orcarouter"]));
 }
});
test("OrcaRouter answers after Groq failure; OpenRouter backup is never called",async()=>{
 const Router=setup(),calls=[];
 global.fetch=async(url)=>{const id=provider(url);calls.push(id);return id==="groq"?fail():ok(id);};
 const result=await Router.complete({system:"Aksara",history:[],question:"Terangkan relativiti",deadline:Date.now()+10000});
 assert.equal(result.provider,"orcarouter");
 assert.deepEqual(calls,["groq","orcarouter"]);
 assert.equal(result.attempts[0].provider,"groq");
});
test("OpenRouter only answers after all configured text primaries are unavailable",async()=>{
 const Router=setup(),calls=[];
 global.fetch=async(url)=>{const id=provider(url);calls.push(id);return id==="openrouter"?ok(id):fail();};
 const result=await Router.complete({system:"Aksara",history:[],question:"Terangkan relativiti",deadline:Date.now()+10000,prefer:"openrouter"});
 assert.equal(result.provider,"openrouter");
 assert.deepEqual(new Set(calls.slice(0,2)),new Set(["groq","orcarouter"]));
 assert.equal(calls.at(-1),"openrouter");
 assert.equal(result.attempts.length,2);
});
test("Image route retains explicit OpenRouter-only capability, never leaking to OrcaRouter",async()=>{
 const Router=setup(),calls=[];
 global.fetch=async(url,opts)=>{calls.push(provider(url));const body=JSON.parse(opts.body);
  assert.equal(body.messages.at(-1).content[1].type,"image_url");return ok("vision");};
 const result=await Router.complete({system:"Aksara",history:[],question:"Lihat imej",
  mediaImages:[{mimeType:"image/png",data:"YWJj"}],only:["openrouter"],deadline:Date.now()+10000});
 assert.equal(result.provider,"openrouter");
 assert.deepEqual(calls,["openrouter"]);
});
test("Bilik Antara tests Groq/Orca and Gemini before universal OpenRouter backup",async()=>{
 setup();const handler=require("../netlify/functions/bilik-antara").handler,calls=[];
 global.fetch=async url=>{const id=provider(url);calls.push(id);return id==="openrouter"?ok(id):fail();};
 const event={httpMethod:"POST",
  headers:{origin:"https://shaifulridhwan-penulispuisigayabebas.netlify.app","x-nf-client-connection-ip":"routing-3plus1-test"},
  body:JSON.stringify({question:"Terangkan perbezaan bit dan bait secara ringkas",preferredProvider:"openrouter"})};
 const response=await handler(event),data=JSON.parse(response.body);
 assert.equal(response.statusCode,200,JSON.stringify(data));
 assert.equal(data.provider,"openrouter");
 assert.ok(calls.includes("groq")&&calls.includes("orcarouter")&&calls.includes("gemini"),calls.join(","));
 assert.equal(calls.at(-1),"openrouter",calls.join(","));
});
