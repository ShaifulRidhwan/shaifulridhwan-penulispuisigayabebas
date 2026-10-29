"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const read=p=>fs.readFileSync(p,"utf8");
const page=read("studio-antara.html");
const style=read("studio-antara.css");
const client=read("studio-antara-cloud.js");
const server=read("netlify/functions/studio-image.js");
function loadBackend(fetchImpl,env={}){
 const exports={};
 vm.runInNewContext(server,{
   exports,process:{env},fetch:fetchImpl,AbortController,Buffer,URL,Map,Date,
   setTimeout,clearTimeout,console
 },{filename:"studio-image.js"});
 return exports.handler;
}
function request(overrides={}){
 const body={prompt:"A cinematic moonlit skyline above the sea",style:"cinematic",steps:4,seed:null,...overrides};
 return {httpMethod:"POST",headers:{
   host:"example.netlify.app",
   origin:"https://example.netlify.app",
   "content-type":"application/json",
   "x-nf-client-connection-ip":"198.51.100.22"
 },body:JSON.stringify(body)};
}
const env={CLOUDFLARE_ACCOUNT_ID:"a".repeat(32),CLOUDFLARE_API_TOKEN:"fake-private-test-token"};
function goodResponse(){
 return {status:200,ok:true,headers:{get:()=>"application/json"},json:async()=>({
  success:true,result:{image:Buffer.alloc(200,77).toString("base64")}
 })};
}
test("Studio loads only lightweight cloud image files",()=>{
 assert.match(page,/studio-antara-cloud\.js\?v=/);
 assert.match(page,/studio-antara\.css\?v=/);
 assert.match(page,/id="imageForm"/);
 assert.match(page,/id="videoStudio"/);
 assert.match(page,/Akan datang/);
 assert.doesNotMatch(page,/WebGPU|SD.Turbo|studio-imej|web-txt2img/i);
 assert.doesNotMatch(style,/SD.Turbo|studio-imej|web-txt2img/i);
 new vm.Script(client,{filename:"studio-antara-cloud.js"});
 new vm.Script(server,{filename:"netlify/functions/studio-image.js"});
});
test("Legacy local-image runtime files have been deleted",()=>{
 const removed=[
  "studio-imej-beta.html","studio-imej-beta.js","studio-imej-beta.css",
  "studio-imej-config.js","studio-imej-worker.js","studio-imej-sw.js",
  "studio-device-diagnostics.js",
  "studio-antara.js","studio-antara-editor.js",
  "studio-antara-tiptap.js","studio-antara-advanced.js"
 ];
 for(const path of removed)assert.equal(fs.existsSync(path),false,path+" still exists");
 assert.match(client,/caches\.delete\("web-txt2img-v1"\)/);
 assert.match(client,/getRegistrations/);
});
test("Image API validates prompt, style and quality without calling Cloudflare",async()=>{
 let called=false;
 const handler=loadBackend(async()=>{called=true;throw Error("should not fetch");},env);
 for(const [field,value] of [
  ["prompt","x"],["style","surprise"],["steps",999],["seed",-3]
 ]){
   const res=await handler(request({[field]:value}));
   assert.equal(res.statusCode,400,field);
 }
 assert.equal(called,false);
});
test("Image API refuses cross-origin requests",async()=>{
 const handler=loadBackend(async()=>goodResponse(),env);
 const req=request();
 req.headers.origin="https://not-our-site.invalid";
 const res=await handler(req);
 assert.equal(res.statusCode,403);
});
test("Image API reports missing Cloudflare credentials safely",async()=>{
 let called=false;
 const handler=loadBackend(async()=>{called=true;}, {});
 const res=await handler(request());
 assert.equal(res.statusCode,503);
 assert.equal(called,false);
});
test("Cloudflare FLUX request is authenticated on server and returns real image payload",async()=>{
 let url="",options=null;
 const handler=loadBackend(async(u,o)=>{url=u;options=o;return goodResponse();},env);
 const res=await handler(request({steps:8,seed:42}));
 const body=JSON.parse(res.body);
 assert.equal(res.statusCode,200);
 assert.equal(body.ok,true);
 assert.equal(body.mime,"image/jpeg");
 assert.ok(body.image.length>100);
 assert.equal(body.steps,8);
 assert.equal(body.seed,42);
 assert.match(url,/\/ai\/run\/@cf\/black-forest-labs\/flux-1-schnell$/);
 assert.equal(options.headers.Authorization,"Bearer fake-private-test-token");
 assert.equal(JSON.parse(options.body).steps,8);
 assert.equal(JSON.parse(options.body).seed,42);
 assert.match(JSON.parse(options.body).prompt,/cinematic photography/);
 assert.doesNotMatch(res.body,/fake-private-test-token/);
});
test("Cloudflare free-tier limit is surfaced without exposing private error details",async()=>{
 const handler=loadBackend(async()=>({status:429,ok:false,headers:{get:()=>"application/json"}}),env);
 const res=await handler(request());
 assert.equal(res.statusCode,429);
 assert.match(JSON.parse(res.body).error,/kuota|had/i);
});
test("Basic per-instance request limit stops repeated calls",async()=>{
 let calls=0;
 const handler=loadBackend(async()=>{calls++;return goodResponse();},env);
 for(let i=0;i<3;i++){
  const res=await handler(request());
  assert.equal(res.statusCode,200);
 }
 const fourth=await handler(request());
 assert.equal(fourth.statusCode,429);
 assert.equal(calls,3);
});
