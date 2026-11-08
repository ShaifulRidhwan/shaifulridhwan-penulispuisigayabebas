"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const lab=require("../netlify/functions/aksara-security-audit.js");
const run=lab.handler;
const parse=(r)=>JSON.parse(r.body);
test("Only owned-site paths are selectable",()=>{
  assert.deepEqual([...lab._internal.PATHS].sort(),["/","/antara-cahaya-dan-gelap.html","/bilik-antara.html","/studio-antara.html"].sort());
  assert.match(lab._internal.ORIGIN,/^https:\/\/shaifulridhwan-penulispuisigayabebas\.netlify\.app$/);
});
test("Reject unapproved path and HTTP method",async()=>{
  const blocked=await run({httpMethod:"GET",queryStringParameters:{path:"https://example.com"}});
  assert.equal(blocked.statusCode,400);
  const local=await run({httpMethod:"GET",queryStringParameters:{path:"//127.0.0.1/"}});
  assert.equal(local.statusCode,400);
  const post=await run({httpMethod:"POST",queryStringParameters:{path:"/"}});
  assert.equal(post.statusCode,405);
});
test("Single fixed-origin request reports missing security headers honestly",async()=>{
  const previous=global.fetch;let count=0;
  global.fetch=async(url,options)=>{
    count++;
    assert.equal(url,lab._internal.ORIGIN+"/bilik-antara.html");
    assert.equal(options.redirect,"manual");
    return {status:200,headers:new Headers({"x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin","x-frame-options":"SAMEORIGIN","permissions-policy":"camera=()"}),body:{cancel:async()=>{}}};
  };
  try{
    const res=await run({httpMethod:"GET",queryStringParameters:{path:"/bilik-antara.html"}});
    const data=parse(res);
    assert.equal(res.statusCode,200);
    assert.equal(count,1);
    assert.equal(data.mode,"passive-single-request");
    assert.equal(data.checks.find(c=>c.id==="nosniff").passed,true);
    assert.equal(data.checks.find(c=>c.id==="csp").passed,false);
    assert.equal(data.checks.find(c=>c.id==="hsts").passed,false);
    assert.equal(data.checks.length,data.total);
    assert.equal(data.passed,data.checks.filter(x=>x.passed).length);
  }finally{global.fetch=previous;}
});
test("Never follow redirects",async()=>{
  const previous=global.fetch;
  global.fetch=async()=>({status:302,headers:new Headers({location:"https://example.com/"}),body:null});
  try{
    const r=await run({httpMethod:"GET",queryStringParameters:{path:"/"}});
    assert.equal(r.statusCode,502);
    assert.equal(parse(r).ok,false);
  }finally{global.fetch=previous;}
});