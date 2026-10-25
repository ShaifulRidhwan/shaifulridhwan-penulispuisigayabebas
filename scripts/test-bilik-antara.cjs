"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const h=require("../netlify/functions/antara-intelligence");
const {handler}=require("../netlify/functions/bilik-antara");
process.env.GEMINI_API_KEY="demo-test-key";
const requests=[];
global.fetch=async(_url,config)=>{
 requests.push(JSON.parse(config.body));
 return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:"Jawapan ujian."}]},finishReason:"STOP",groundingMetadata:{groundingChunks:[{web:{uri:"https://example.com/fakta",title:"Rujukan"}}]}}]})};
};
function e(body,id){return {httpMethod:"POST",headers:{origin:"https://shaifulridhwan-penulispuisigayabebas.netlify.app","x-nf-client-connection-ip":id},body:JSON.stringify(body)};}
test("adaptive reasoning",()=>{
 assert.equal(h.thinkingFor("bedah","hai"),"high");
 assert.equal(h.thinkingFor("bual","hai"),"low");
 assert.ok(h.poemMatches("wanita yang diwarisi").length);
});
test("probe",async()=>{
 const r=await handler(e({probe:true},"probe"));
 assert.equal(r.statusCode,200);
 assert.equal(JSON.parse(r.body).geminiVerified,false);
});
test("bedah, selidik, karya and memory",async()=>{
 const a=await handler(e({question:"Bedah paradoks",insightMode:"bedah"},"bedah"));
 assert.equal(a.statusCode,200);
 assert.equal(requests.at(-1).generationConfig.thinkingConfig.thinkingLevel,"high");
 const b=await handler(e({question:"Cari berita",insightMode:"selidik"},"selidik"));
 assert.equal(b.statusCode,200);
 assert.ok(requests.at(-1).tools.some(t=>t.google_search));
 assert.equal(JSON.parse(b.body).sources[0].title,"Rujukan");
 await handler(e({question:"wanita yang diwarisi",useWorks:true},"karya"));
 assert.match(JSON.stringify(requests.at(-1)),/WANITA YANG DIWARISI/);
 const c=await handler(e({summarize:true,history:[{role:"user",content:"a"},{role:"assistant",content:"b"},{role:"user",content:"c"},{role:"assistant",content:"d"}]},"memory"));
 assert.ok(JSON.parse(c.body).summary);
});
test("reject invalid payload",async()=>{
 assert.equal((await handler(e({},"empty"))).statusCode,400);
 assert.equal((await handler(e({documentText:"x".repeat(56000)},"large"))).statusCode,413);
});
