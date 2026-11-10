"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {createPool}=require("../netlify/functions/lib/gemini-text-pool");

const env={
  GEMINI_API_KEY:"key-one",
  GEMINI_API_KEY_2:"key-two",
  GEMINI_API_KEY_3:"key-three",
  GEMINI_API_KEY_4:"key-four"
};

test("all four text keys have the same selectable role",()=>{
  const pool=createPool();
  assert.deepEqual(Array.from({length:8},()=>pool.pick(env).slot),[1,2,3,4,1,2,3,4]);
  assert.equal(pool.configured(env).length,4);
});

test("legacy single Gemini secret remains usable without configuration changes",()=>{
  const pool=createPool();
  assert.equal(pool.pick({GEMINI_API_KEY:"existing-key"}).apiKey,"existing-key");
  assert.equal(pool.pick({}),null);
});

test("duplicate or empty secrets do not create duplicate slots",()=>{
  const pool=createPool();
  assert.deepEqual(pool.configured({GEMINI_API_KEY:" same ",GEMINI_API_KEY_2:"same",GEMINI_API_KEY_4:"new"}).map(x=>x.slot),[1,4]);
});

test("a rejected credential is quarantined without disabling the other configured keys",()=>{
  const pool=createPool();
  assert.equal(pool.pick(env).slot,1);
  pool.failure(1,{status:403,googleCategory:"credential_or_access"});
  assert.equal(pool.snapshot(env).find(x=>x.slot===1).status,"offline");
  assert.equal(pool.snapshot(env).find(x=>x.slot===1).reason,"authentication_or_access");
  assert.deepEqual(Array.from({length:4},()=>pool.pick(env).slot),[2,3,4,2]);
  pool.success(1);
  assert.equal(pool.snapshot(env).find(x=>x.slot===1).status,"online");
});

test("quota 429 is not interpreted as a credential error or rotated within one attempt",()=>{
  const pool=createPool(),chosen=pool.pick(env);
  pool.failure(chosen.slot,{status:429});
  assert.equal(pool.snapshot(env).find(x=>x.slot===chosen.slot).status,"offline");
  assert.equal(chosen.apiKey,"key-one");
});

test("public diagnostics expose only slots and states, never API secrets",()=>{
  const pool=createPool(),status=JSON.stringify(pool.snapshot(env));
  assert.equal(JSON.parse(status).length,4);
  for(const key of Object.values(env))assert.equal(status.includes(key),false);
  assert.equal(status.includes("apiKey"),false);
});

test("chat pool is isolated from unchanged Live and thinking/model configuration",()=>{
  const chat=fs.readFileSync(require.resolve("../netlify/functions/bilik-antara"),"utf8");
  const live=fs.readFileSync(require.resolve("../netlify/functions/bilik-antara-live-token"),"utf8");
  assert.match(chat,/GeminiTextPool\.pick\(\)/);
  assert.match(chat,/const googleThinking=adaptiveThinking;/);
  assert.match(chat,/const baseModel=freeModel\(process\.env\.GEMINI_MODEL,DEFAULT_MODEL\)/);
  assert.doesNotMatch(live,/GeminiTextPool/);
});

test("recorded Voice uses only the primary credential and never selects a chat pool slot",async()=>{
  const pool=require("../netlify/functions/lib/gemini-text-pool");
  const {handler}=require("../netlify/functions/bilik-antara");
  const previous=Object.fromEntries(Object.keys(env).map(name=>[name,process.env[name]]));
  const oldFetch=global.fetch,oldPick=pool.pick;
  let calls=0;
  try{
    Object.assign(process.env,env);
    pool.pick=()=>{throw Error("Recorded Voice must not select a chat credential");};
    global.fetch=async(url,options)=>{
      calls++;
      assert.match(String(url),/^https:\/\/generativelanguage\.googleapis\.com\//);
      assert.equal(options.headers["x-goog-api-key"],env.GEMINI_API_KEY);
      return Response.json({candidates:[{content:{parts:[{text:"Aku dengar."}]},finishReason:"STOP"}]});
    };
    const result=await handler({httpMethod:"POST",headers:{
      origin:"https://shaifulridhwan-penulispuisigayabebas.netlify.app",
      "x-nf-client-connection-ip":"voice-key-isolation-regression"},
      body:JSON.stringify({question:"Jawab rakaman ini",voiceFallback:true,
        media:{mimeType:"audio/webm",data:"QUJDRA=="}})});
    assert.equal(result.statusCode,200);
    assert.equal(JSON.parse(result.body).mode,"recorded-voice");
    assert.equal(calls,1);
  }finally{
    global.fetch=oldFetch;pool.pick=oldPick;
    for(const [name,value] of Object.entries(previous))
      if(value===undefined)delete process.env[name];else process.env[name]=value;
  }
});
