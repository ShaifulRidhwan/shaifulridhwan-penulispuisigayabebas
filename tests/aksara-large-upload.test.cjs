"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const Large=require("../netlify/functions/lib/aksara-large-upload");
const {handler}=require("../netlify/functions/aksara-large-upload");
const env={GEMINI_API_KEY:"not-a-real-google-key-example"};
const uri="https://generativelanguage.googleapis.com/v1beta/files/aksaraabc001";
test("signed receipts reject forgery, wrong type and expired credentials",()=>{
 const file={name:"files/aksaraabc001",fileUri:uri,mimeType:"application/pdf",sizeBytes:5000000,exp:Date.now()+180000};
 const proof=Large.sign("file",file,env);
 assert.equal(Large.parseReceipts([proof],env)[0].fileUri,uri);
 assert.throws(()=>Large.parseReceipts([proof+"x"],env));
 assert.throws(()=>Large.parseReceipts([Large.sign("session",file,env)],env));
 assert.throws(()=>Large.parseReceipts([Large.sign("file",{...file,exp:Date.now()-1},env)],env));
 assert.throws(()=>Large.parseReceipts(Array(5).fill(proof),env));
});
test("file sizes and destination URIs are validated",()=>{
 assert.equal(Large.spec({mimeType:"video/mp4",sizeBytes:250000000}).kind,"video");
 assert.throws(()=>Large.spec({mimeType:"video/mp4",sizeBytes:250000001}));
 assert.throws(()=>Large.spec({mimeType:"application/x-msdownload",sizeBytes:10}));
 assert.throws(()=>Large.validatedFile({name:"files/aksaraabc001",uri:"https://example.org/f",mimeType:"application/pdf",sizeBytes:10}));
});
test("Gemini resumable start, ACTIVE verification and signed receipt work without leaking API key",async()=>{
 const oldFetch=global.fetch,oldKey=process.env.GEMINI_API_KEY,oldSecret=process.env.AKSARA_UPLOAD_SIGNING_SECRET;
 try{
  process.env.GEMINI_API_KEY=env.GEMINI_API_KEY;
  delete process.env.AKSARA_UPLOAD_SIGNING_SECRET;
  let n=0;
  global.fetch=async(url,opts={})=>{
    assert.equal(opts.headers["x-goog-api-key"],env.GEMINI_API_KEY);
    n++;
    if(url.endsWith("/upload/v1beta/files"))return new Response("{}",{status:200,headers:{"x-goog-upload-url":"https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=fake"}});
    if(url.endsWith("/v1beta/files/aksaraabc001"))return new Response(JSON.stringify({name:"files/aksaraabc001",uri,mimeType:"application/pdf",sizeBytes:"5000000",state:"ACTIVE"}),{status:200});
    throw Error("Unexpected URL "+url);
  };
  const post=b=>handler({httpMethod:"POST",headers:{origin:"https://shaifulridhwan-penulispuisigayabebas.netlify.app","x-forwarded-for":"198.51.100.20"},body:JSON.stringify(b)});
  const a=await post({action:"start",mimeType:"application/pdf",name:"book.pdf",sizeBytes:5000000});
  assert.equal(a.statusCode,200);
  assert.ok(!a.body.includes(env.GEMINI_API_KEY));
  const started=JSON.parse(a.body);
  assert.ok(started.uploadUrl.includes("upload_id="));
  const b=await post({action:"verify",ticket:started.ticket,name:"files/aksaraabc001"});
  assert.equal(b.statusCode,200);
  const receipt=JSON.parse(b.body).receipt;
  assert.equal(Large.parseReceipts([receipt])[0].fileUri,uri);
  const c=await post({action:"verify",ticket:started.ticket+"fake",name:"files/aksaraabc001"});
  assert.equal(c.statusCode,400);
  assert.equal(n,2);
 }finally{
  global.fetch=oldFetch;
  if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;
  if(oldSecret===undefined)delete process.env.AKSARA_UPLOAD_SIGNING_SECRET;else process.env.AKSARA_UPLOAD_SIGNING_SECRET=oldSecret;
 }
});
