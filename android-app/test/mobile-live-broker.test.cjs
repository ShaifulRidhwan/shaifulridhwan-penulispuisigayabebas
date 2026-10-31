"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {createHash}=require("node:crypto");
const {createLiveToken,reserveDurableVoice}=require("../../netlify/functions/lib/aksara-mobile-live-broker");
const {handler:siteHandler}=require("../../netlify/functions/bilik-antara-live-token");
const secret="A".repeat(48);
const hash=createHash("sha256").update(secret).digest("hex");
function request(auth, body="{}") {
  return new Request("https://example.netlify.app/.netlify/functions/bilik-antara-live-android",{
    method:"POST",headers:{
      "Content-Type":"application/json",
      ...(auth?{Authorization:auth}:{})
    },body
  });
}
const env={AKSARA_MOBILE_STUDIO_TOKEN_SHA256:hash,GEMINI_API_KEY:"server-only"};
test("unauthorized mobile requests cannot generate a provider token",async()=>{
 let called=0;
 const fetchImpl=async()=>{called++;throw Error("should not call");};
 const no=await createLiveToken(request(null),{}, {env,fetchImpl});
 assert.equal(no.status,401);
 const wrong=await createLiveToken(request("Bearer "+"B".repeat(48)),{}, {env,fetchImpl});
 assert.equal(wrong.status,401);
 assert.equal(called,0);
});
test("missing server secret fails closed",async()=>{
 const res=await createLiveToken(request("Bearer "+secret),{},{env:{GEMINI_API_KEY:"a"}});
 assert.equal(res.status,503);
});
test("quota failures never call Google",async()=>{
 let called=0;
 const res=await createLiveToken(request("Bearer "+secret),{},{
  env,reserve:async()=>false,fetchImpl:async()=>{called++;return null;}
 });
 assert.equal(res.status,429);
 assert.equal(called,0);
});
test("valid QA request returns ephemeral token, never API key",async()=>{
 let called=0;
 const res=await createLiveToken(request("Bearer "+secret),{ip:"127.0.0.1"},{
  env,reserve:async()=>true,now:()=>Date.parse("2026-10-31T00:00:00Z"),
  fetchImpl:async(_url,opt)=>{
    called++;
    const p=JSON.parse(opt.body);
    assert.equal(p.uses,1);
    assert.equal(opt.headers["x-goog-api-key"],"server-only");
    return {ok:true,status:200,json:async()=>({name:"auth_tokens/"+"x".repeat(36)})};
  }
 });
 assert.equal(res.status,200);
 const data=await res.json();
 assert.equal(data.token,"auth_tokens/"+"x".repeat(36));
 assert.equal(data.model,"gemini-3.8-live");
 assert.equal(JSON.stringify(data).includes("server-only"),false);
 assert.equal(called,1);
});
test("web endpoint still requires real browser origin",async()=>{
 const response=await siteHandler({httpMethod:"POST",headers:{},body:"{}"});
 assert.equal(response.statusCode,403);
});

test("durable onlyIfNew slots limit concurrent Live issuance",async()=>{
 const keys=new Set();
 const store={
  async setJSON(key,_value,options){
   assert.equal(options.onlyIfNew,true);
   if(keys.has(key))return {modified:false};
   keys.add(key);
   return {modified:true,etag:"new"};
  }
 };
 const requests=Array.from({length:18},()=>reserveDurableVoice({ip:"192.0.2.1"},store));
 const grants=await Promise.all(requests);
 assert.equal(grants.filter(Boolean).length,6);
 // The other attempts consume some conservative day slots, never extra access.
 assert.ok([...keys].filter(k=>k.startsWith("voice/client/ten-minute/")).length<=6);
 assert.ok([...keys].filter(k=>k.startsWith("voice/global/")).length<=80);
});
test("missing durable store fails closed",async()=>{
 await assert.rejects(()=>reserveDurableVoice({},null),/Missing durable store/);
});
