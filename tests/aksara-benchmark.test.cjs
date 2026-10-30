"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Lab=require("../scripts/benchmark-aksara-providers.cjs");

test("Six synthetic A/B cases share identical system identity and avoid personal user data",()=>{
 assert.deepEqual(Lab.CASES.map(x=>x.id),["bahasa","falsafah","sains","coding","context","identiti"]);
 assert.match(Lab.SYSTEM,/Bahasa Melayu Malaysia/);
 assert.match(Lab.SYSTEM,/CAHAYA/);
 assert.match(Lab.SYSTEM,/GELAP/);
 for(const c of Lab.CASES)assert.ok(c.prompt.length>30);
});

test("Both router requests use fixed free aliases and exactly equivalent prompts",async()=>{
 const observed=[];
 const fetchImpl=async (url,options)=>{
  assert.match(options.headers.Authorization,/^Bearer mock-key$/);
  const body=JSON.parse(options.body);
  observed.push({url,body});
  return {ok:true,json:async()=>({model:url.includes("orcarouter")?"deepseek/free":"dynamic/open",
   choices:[{message:{content:"Aporia ialah kebuntuan dalam persoalan pengetahuan."}}]})};
 };
 const c=Lab.CASES[1];
 const a=await Lab.callProvider("orcarouter",c,{key:"mock-key",fetchImpl});
 const b=await Lab.callProvider("openrouter",c,{key:"mock-key",fetchImpl});
 assert.equal(a.model,"deepseek/free");
 assert.equal(b.model,"dynamic/open");
 assert.equal(observed[0].body.model,"orcarouter/free");
 assert.equal(observed[1].body.model,"openrouter/free");
 assert.equal(observed[0].body.stream,false);
 assert.equal(observed[1].body.stream,false);
 assert.deepEqual(observed[0].body.messages,observed[1].body.messages);
 assert.equal(observed[0].body.max_tokens,550);
 assert.equal(a.anchorCoverage,1);
});

test("Multi-turn comparison retains identical prior messages for both routers",async()=>{
 const messages=[];
 const fetchImpl=async(_url,options)=>{
  messages.push(JSON.parse(options.body).messages);
  return {ok:true,json:async()=>({model:"mock",choices:[{message:{content:"Pilihan kedua ialah IndexedDB di browser. Ini jaga privasi."}}]})};
 };
 const c=Lab.CASES.find(x=>x.id==="context");
 const a=await Lab.callProvider("orcarouter",c,{key:"mock-key",fetchImpl});
 const b=await Lab.callProvider("openrouter",c,{key:"mock-key",fetchImpl});
 assert.deepEqual(messages[0],messages[1]);
 assert.equal(messages[0][1].role,"user");
 assert.equal(messages[0][2].role,"assistant");
 assert.equal(a.anchorCoverage,1);
 assert.equal(b.anchorCoverage,1);
});

test("Dialect indicator is only a hint and does not conflate clean Malay with Indonesia",()=>{
 assert.deepEqual(Lab.assess("Aku boleh jawab, tapi kena tengok konteks dulu.",Lab.CASES[0]).indonesianMarkers,[]);
 assert.deepEqual(Lab.assess("Aku nggak tahu, kayaknya sih begitu.",Lab.CASES[0]).indonesianMarkers,["nggak","kayaknya","sih"]);
});

test("Unsuccessful provider results do not become invented quality scores",()=>{
 const report=Lab.summarize([
  {provider:"orcarouter",caseId:"sains",model:"deepseek/free",latencyMs:500,response:"entropi",indonesianMarkers:[],anchorCoverage:0.5},
  {provider:"openrouter",caseId:"sains",error:"HTTP_429"}
 ]);
 assert.equal(report.providers.orcarouter.requests,1);
 assert.equal(report.providers.orcarouter.keywordCoverage,0.5);
 assert.equal(report.providers.openrouter.successes,0);
 assert.equal(report.providers.openrouter.keywordCoverage,null);
 assert.equal(report.providers.openrouter.medianLatencyMs,null);
 assert.ok(!("winner" in report));
});

test("No API request is performed for self-test",()=>{
 const old=global.fetch;
 global.fetch=()=>{throw Error("self test must never perform HTTP");};
 try{Lab.selfTest();}finally{global.fetch=old;}
});
