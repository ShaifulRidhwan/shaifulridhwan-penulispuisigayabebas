"use strict";
// Run: node tests/aksara-router.test.js
// Offline provider-contract smoke tests, no API keys, network calls or user messages.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const src=fs.readFileSync("netlify/functions/aksara-provider-router.js","utf8");
function makeRouter({review=false,failGroq=false}={}){
 const requests=[];
 const env={
  AKSARA_FREE_FALLBACKS:"true",GROQ_FREE_CONFIRMED:"true",MISTRAL_FREE_CONFIRMED:"true",
  GROQ_API_KEY:"test",MISTRAL_API_KEY:"test",OPENROUTER_API_KEY:"test",
  ...(review?{AKSARA_CROSS_REVIEW:"true"}:{})
 };
 const mockFetch=async(url,opts)=>{
  const payload=JSON.parse(opts.body);requests.push({url,payload});
  if(failGroq&&url.includes("groq.com"))return {ok:false,status:429};
  const isReview=payload.messages?.[0]?.content.includes("pemeriksa ketelitian");
  const content=isReview?JSON.stringify({issue:"",confidence:"low"}):"Aku Aksara A.I., boleh kita sambung?";
  return {ok:true,json:async()=>({model:"test",choices:[{message:{content},finish_reason:"stop"}]})};
 };
 const sandbox={module:{exports:{}},exports:{},process:{env},fetch:mockFetch,AbortController,
  setTimeout,clearTimeout,Date,JSON,Number,String,Array,Map,Error};
 vm.runInNewContext(src,sandbox,{filename:"aksara-provider-router.js"});
 return {router:sandbox.module.exports,requests};
}
async function main(){
 {
  const {router,requests}=makeRouter();
  assert.equal(router.rankProviders(router.configured(),"creative")[0].id,"mistral");
  const messages=Array.from({length:24},(_,i)=>({role:i%2?"assistant":"user",content:"Mesej "+i}));
  const result=await router.complete({system:"Identiti Aksara A.I.",history:messages,question:"Sambung",task:"creative",timeoutMs:1000});
  assert.equal(result.provider,"mistral");
  assert.equal(requests[0].payload.messages.length,26);
  assert.match(requests[0].payload.messages[0].content,/Identiti Aksara A.I./);
  assert.equal(await router.crossReview({question:"ujian",reply:"jawapan",originalProvider:"mistral",task:"technical"}),null);
 }
 {
  const {router,requests}=makeRouter({review:true,failGroq:true});
  const response=await router.complete({system:"Identiti",history:[],question:"Bantu kod",task:"technical",timeoutMs:1000});
  assert.equal(response.provider,"mistral");
  const check=await router.crossReview({question:"Semak fakta",reply:"Jawapan",originalProvider:"groq",task:"technical",timeoutMs:1000});
  assert.equal(check.checked,true);
  assert.equal(check.reviewer,"mistral");
  const reviewCall=requests.find(r=>r.payload.response_format?.type==="json_object");
  assert.ok(reviewCall,"Mistral review uses structured JSON");
 }
 console.log("AKSARA router smoke tests PASS (offline mock)");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
