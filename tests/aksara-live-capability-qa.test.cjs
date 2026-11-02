"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Intelligence=require("../netlify/functions/antara-intelligence");
const Capabilities=require("../netlify/functions/aksara-capabilities");
const ORIGIN="https://shaifulridhwan-penulispuisigayabebas.netlify.app";
function request(question,extra={}){return {httpMethod:"POST",headers:{origin:ORIGIN,
 "x-nf-client-connection-ip":"aksara-tools-qa-"+Math.random()},body:JSON.stringify({question,...extra})};}
function configure(t){
 const keys=["GEMINI_API_KEY","GEMINI_API_KEY_2","GEMINI_API_KEY_3","GEMINI_API_KEY_4",
 "GROQ_API_KEY","GROQ_FREE_CONFIRMED","AKSARA_FREE_FALLBACKS","AKSARA_HYBRID_ROUTER",
 "AKSARA_WEB_SEARCH_ENABLED","BRAVE_SEARCH_API_KEY","ENABLE_PUBLIC_WORKS"];
 const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const fetchBefore=global.fetch;
 Object.assign(process.env,{GEMINI_API_KEY:"mock-qa-primary",GROQ_API_KEY:"mock-qa-groq",
  GROQ_FREE_CONFIRMED:"true",AKSARA_FREE_FALLBACKS:"true",AKSARA_HYBRID_ROUTER:"true",
  AKSARA_WEB_SEARCH_ENABLED:"false",ENABLE_PUBLIC_WORKS:"true"});
 for(const k of ["GEMINI_API_KEY_2","GEMINI_API_KEY_3","GEMINI_API_KEY_4","BRAVE_SEARCH_API_KEY"])delete process.env[k];
 t.after(()=>{
  global.fetch=fetchBefore;
  for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
 });
}
test("Malay natural calculation offers Gemini code execution",()=>{
 const q="Gunakan alat pelaksanaan kod untuk mengira jumlah kuasa dua dari 1 hingga 1000.";
 const intent=Intelligence.resolveIntent(q,[],false);
 assert.equal(intent.calculate,true);
 assert.ok(Intelligence.getTools(intent).some(x=>x.code_execution));
});
test("Explicit AKSARA poetry discovery is eligible for model function calling",()=>{
 const q="Cari petikan karya puisi AKSARA tentang keraguan hidup.";
 const intent=Intelligence.resolveIntent(q,[],false);
 assert.equal(intent.works,true);
 assert.equal(Capabilities.geminiFunctions({question:q,works:intent.works}).length,1);
});
test("Current news uses real Groq browser before wasting Gemini time, without private summaries",async t=>{
 configure(t);
 const {handler}=require("../netlify/functions/bilik-antara");
 let groqCalls=0,geminiCalls=0,groqBody;
 global.fetch=async(url,options)=>{
  const u=String(url);
  if(u.includes("api.groq.com")){
   groqCalls++;groqBody=JSON.parse(options.body);
   return Response.json({model:"openai/gpt-oss-120b",choices:[{message:{
    content:"Penemuan live yang disahkan browser search.",
    executed_tools:[{name:"browser_search"}]},finish_reason:"stop"}]});
  }
  if(u.includes("googleapis")){geminiCalls++;return Response.json({candidates:[{content:{parts:[{text:"Old general facts."}]},finishReason:"STOP"}]});}
  throw Error("Unexpected external fetch: "+u);
 };
 const resp=await handler(request("Cari tiga berita AI terkini pada 2 November 2026.",
  {summary:"PRIVATE_SUMMARY_SENTINEL_DO_NOT_FORWARD"}));
 assert.equal(resp.statusCode,200);
 const body=JSON.parse(resp.body);
 assert.equal(body.provider,"groq");
 assert.ok(body.toolsUsed.includes("browser_search"));
 assert.equal(groqCalls,1);
 assert.equal(geminiCalls,0);
 assert.deepEqual(groqBody.tools,[{type:"browser_search"}]);
 assert.equal(groqBody.tool_choice,"required");
 assert.ok(!JSON.stringify(groqBody).includes("PRIVATE_SUMMARY_SENTINEL_DO_NOT_FORWARD"));
});
test("Gemini public poetry requests invoke allowed knowledge_search, not static sample",async t=>{
 configure(t);
 const {handler}=require("../netlify/functions/bilik-antara");
 let calls=0,firstBody;
 global.fetch=async(url,options)=>{
  const u=String(url);
  if(!u.includes("googleapis"))throw Error("Only Gemini expected");
  calls++;
  const payload=JSON.parse(options.body);
  if(calls===1){
   firstBody=payload;
   return Response.json({candidates:[{content:{role:"model",parts:[{
    functionCall:{name:"knowledge_search",args:{query:"keraguan tentang kehidupan"}}
   }]},finishReason:"STOP"}]});
  }
  return Response.json({candidates:[{content:{parts:[{
    text:"Aku jumpa petikan karya sebenar melalui indeks AKSARA."
   }]},finishReason:"STOP"}]});
 };
 const resp=await handler(request("Cari petikan karya puisi AKSARA yang membincangkan keraguan hidup."));
 const data=JSON.parse(resp.body);
 assert.equal(resp.statusCode,200);
 assert.equal(data.provider,"gemini");
 assert.ok(data.toolsUsed.includes("knowledge_search"));
 assert.equal(calls,2);
 assert.equal(firstBody.toolConfig.functionCallingConfig.mode,"ANY");
 assert.equal(firstBody.tools[0].functionDeclarations[0].name,"knowledge_search");
});
