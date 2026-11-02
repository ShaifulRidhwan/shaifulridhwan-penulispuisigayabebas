"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {handler}=require("../netlify/functions/bilik-antara");

test("Gemini 1-4 have independent, truthful HTTP-backed status and no secret disclosure",async()=>{
 const keys=["fake-key-1","fake-key-2","fake-key-3","fake-key-4"];
 const names=["GEMINI_API_KEY","GEMINI_API_KEY_2","GEMINI_API_KEY_3","GEMINI_API_KEY_4"];
 const previous=names.map(name=>process.env[name]);
 const oldFetch=global.fetch;
 const calls=[];
 try{
  names.forEach((name,i)=>{process.env[name]=keys[i];});
  global.fetch=async(url,opts)=>{
   if(!String(url).includes("generativelanguage.googleapis.com"))throw Error("Unexpected API: "+url);
   const credential=opts.headers["x-goog-api-key"];
   calls.push(credential);
   if(credential===keys[2])return {ok:false,status:403,
    json:async()=>({error:{status:"PERMISSION_DENIED",message:"API key not valid"}})};
   return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:"OK"}]}}]})};
  };
  const event={httpMethod:"POST",
   headers:{origin:"https://shaifulridhwan-penulispuisigayabebas.netlify.app",
    "x-nf-client-connection-ip":"quad-ui-test"},
   body:JSON.stringify({providerStatus:true,geminiPoolRefresh:true})};
  const response=await handler(event);
  assert.equal(response.statusCode,200);
  const body=JSON.parse(response.body);
  const gemini=body.providers.find(x=>x.id==="gemini");
  assert.ok(gemini);
  assert.equal(gemini.status,"online");
  assert.deepEqual(gemini.pool.map(x=>x.slot),[1,2,3,4]);
  assert.deepEqual(gemini.pool.map(x=>x.status),["online","online","offline","online"]);
  assert.equal(gemini.pool[2].http,403);
  assert.equal(gemini.pool[2].reason,"authentication_or_access");
  assert.ok(gemini.pool.filter(x=>x.status==="online").every(x=>x.http===200&&x.checkedAt>0));
  assert.equal(calls.length,4,"A manual status refresh checks each configured slot exactly once");
  assert.equal(new Set(calls).size,4);
  for(const key of keys)assert.ok(!response.body.includes(key),"API keys must never appear in public health payload");
 }finally{
  global.fetch=oldFetch;
  names.forEach((name,i)=>{if(previous[i]===undefined)delete process.env[name];else process.env[name]=previous[i];});
 }
});

test("Multi AI UI nests four status rows and explicit refresh under the original Gemini row",()=>{
 const html=fs.readFileSync("bilik-antara.html","utf8");
 const css=fs.readFileSync("bilik-antara.css","utf8");
 assert.match(html,/const expandable=id==="gemini"\|\|id==="openrouter"/);
 const renderer=fs.readFileSync("bilik-antara-gemini-status.js","utf8");
 assert.match(renderer,/for\(let slot=1;slot<=4;slot\+\+\)/);
 assert.match(renderer,/child\.dataset\.geminiSlot=String\(slot\)/);
 assert.match(renderer,/item\?\.pool/);
 assert.match(html,/src="bilik-antara-gemini-status\.js\?v=1"/);
 assert.match(html,/geminiPoolRefresh:force===true/);
 assert.match(css,/\.multi-ai-gemini-detail/);
 assert.match(html,/Ready bukan Connected/);
 const live=fs.readFileSync("netlify/functions/bilik-antara-live-token.js","utf8");
 assert.doesNotMatch(live,/GeminiTextPool|geminiPoolRefresh/);
});
