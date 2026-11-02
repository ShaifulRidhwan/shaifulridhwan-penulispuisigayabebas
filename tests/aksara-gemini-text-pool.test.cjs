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
  assert.equal(pool.snapshot(env).find(x=>x.slot===1).status,"access_error");
  assert.deepEqual(Array.from({length:4},()=>pool.pick(env).slot),[2,3,4,2]);
  pool.success(1);
  assert.equal(pool.snapshot(env).find(x=>x.slot===1).status,"online");
});

test("quota 429 is not interpreted as a credential error or rotated within one attempt",()=>{
  const pool=createPool(),chosen=pool.pick(env);
  pool.failure(chosen.slot,{status:429});
  assert.equal(pool.snapshot(env).find(x=>x.slot===chosen.slot).status,"degraded");
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
  assert.match(chat,/payload\.voiceFallback===true\?process\.env\.GEMINI_API_KEY/);
  assert.match(chat,/const googleThinking=adaptiveThinking;/);
  assert.match(chat,/const baseModel=freeModel\(process\.env\.GEMINI_MODEL,DEFAULT_MODEL\)/);
  assert.doesNotMatch(live,/GeminiTextPool/);
});
