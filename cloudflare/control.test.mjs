import {test} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {AksaraControl} from "./src/control.mjs";
const hash="f".repeat(32);
function fixture(env={}){
 const db=new DatabaseSync(":memory:");
 const sql={exec(query,...params){
  const statement=db.prepare(query);
  return /^\s*SELECT\b/i.test(query)
   ? {toArray:()=>statement.all(...params)}
   : {toArray:()=>{statement.run(...params);return []}};
 }};
 // Cloudflare SQLite's .exec() executes statements immediately, including
 // mutations whose return value the handler doesn't inspect.
 sql.exec=(query,...params)=>{
  const statement=db.prepare(query);
  if(/^\s*SELECT\b/i.test(query))return {toArray:()=>statement.all(...params)};
  statement.run(...params);
  return {toArray:()=>[]};
 };
 const ctx={storage:{sql,transactionSync(fn){
  db.exec("BEGIN IMMEDIATE");
  try{const result=fn();db.exec("COMMIT");return result;}
  catch(e){db.exec("ROLLBACK");throw e;}
 }}};
 const obj=new AksaraControl(ctx,env);
 async function request(kind,extra={}){
  const res=await obj.fetch(new Request("https://aksara-control.internal/",{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({kind,hash,...extra})
  }));
  return {status:res.status,data:await res.json(),retry:res.headers.get("retry-after")};
 }
 return {db,request};
}
test("chat has atomic shared daily cap; health probes don't consume inference",async t=>{
 const {db,request}=fixture({AKSARA_CHAT_DAILY_REQUESTS:"2"});t.after(()=>db.close());
 for(let n=0;n<4;n++)assert.equal((await request("health")).status,200);
 assert.equal((await request("chat")).status,200);
 assert.equal((await request("chat")).status,200);
 const blocked=await request("chat");
 assert.equal(blocked.status,429);
 assert.match(blocked.data.error,/Bajet harian Chat/);
 assert.ok(Number(blocked.retry)>0);
 assert.equal(db.prepare("SELECT chat FROM daily").get().chat,2);
});
test("voice has a separate throttle",async t=>{
 const {db,request}=fixture();t.after(()=>db.close());
 for(let n=0;n<5;n++)assert.equal((await request("voice")).status,200);
 assert.equal((await request("voice")).status,429);
 assert.equal((await request("chat")).status,200);
});
test("studio leases and global neuron budget are jointly enforced",async t=>{
 const {db,request}=fixture({STUDIO_DAILY_NEURONS:"20"});t.after(()=>db.close());
 const first=await request("studio",{cost:6,action:"image"});
 const second=await request("studio",{cost:6,action:"image"});
 assert.equal(first.status,200);assert.equal(second.status,200);
 assert.equal((await request("studio",{cost:1,action:"image"})).status,429);
 assert.equal((await request("release",{id:first.data.id})).status,200);
 assert.equal((await request("studio",{cost:9,action:"image"})).status,429);
 assert.equal((await request("release",{id:second.data.id})).status,200);
 const last=await request("studio",{cost:8,action:"image"});
 assert.equal(last.status,200);
 assert.equal(db.prepare("SELECT studio FROM daily").get().studio,20);
 assert.equal((await request("release",{id:last.data.id})).status,200);
 assert.equal((await request("studio",{cost:1,action:"image"})).status,429);
});
test("studio AI prompt enhancements are limited per user",async t=>{
 const {db,request}=fixture();t.after(()=>db.close());
 const first=await request("studio",{action:"enhance"});
 assert.equal(first.status,200);
 assert.equal((await request("release",{id:first.data.id})).status,200);
 assert.equal((await request("studio",{action:"enhance"})).status,429);
 assert.equal(db.prepare("SELECT enhancements FROM daily").get().enhancements,1);
});
test("retired owner-only provider test route is unavailable",async t=>{
 const {db,request}=fixture();t.after(()=>db.close());
 assert.equal((await request("nvidia-test")).status,400);
 assert.equal((await request("chat")).status,200);
});
test("control rejects malformed digests and release IDs",async t=>{
 const {db,request}=fixture();t.after(()=>db.close());
 assert.equal((await request("chat",{hash:"192.0.2.1"})).status,400);
 assert.equal((await request("release",{id:"../../oops"})).status,400);
 assert.equal((await request("unsupported")).status,400);
});
test("safe health endpoint never leaks configured provider keys",async()=>{
 const worker=(await import("./src/index.mjs")).default;
 const env={AKSARA_RATE_SALT:"0123456789abcdef0123456789abcdef",
  GEMINI_API_KEY:"TEST_PRIVATE_GEMINI",GROQ_API_KEY:"TEST_PRIVATE_GROQ",
  GROQ_FREE_CONFIRMED:"true",AI:{run:async()=>({response:"OK"})},CLOUDFLARE_ACCOUNT_ID:"test-account-id",
  CLOUDFLARE_API_TOKEN:"TEST_PRIVATE_CF",AKSARA_CONTROL:{},
  ASSETS:{fetch:()=>Response.json({ok:true})}};
 const result=await worker.fetch(new Request("https://apps.example.com/api/aksara-health"),env,{});
 assert.equal(result.status,200);
 const body=await result.text();
 assert.match(body,/"chat":true/);
 assert.match(body,/"voice":true/);
 assert.match(body,/"studio":true/);
 assert.doesNotMatch(body,/TEST_PRIVATE|RATE_SALT|API_KEY/);
 for(const endpoint of ["bilik-antara","studio-image","bilik-antara-stream","bilik-antara-live-token"]){
  const result=await worker.fetch(new Request("https://apps.example.com/.netlify/functions/"+endpoint,{
   method:"OPTIONS",headers:{"origin":"https://untrusted.example"}}),env,{});
  assert.equal(result.status,403);
 }
});
