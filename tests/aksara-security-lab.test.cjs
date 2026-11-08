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
test("Strict CSP produces accurate defensive findings and safe observations",()=>{
  const headers=new Headers({
    "strict-transport-security":"max-age=31536000; includeSubDomains",
    "content-security-policy":"default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
    "x-content-type-options":"nosniff",
    "referrer-policy":"strict-origin-when-cross-origin",
    "permissions-policy":"camera=(), microphone=()"
  });
  const result=lab._internal.assess(headers);
  assert.equal(result.checks.find(x=>x.id==="csp").passed,true);
  assert.equal(result.checks.find(x=>x.id==="csp-eval").passed,true);
  assert.equal(result.checks.find(x=>x.id==="csp-object").passed,true);
  assert.equal(result.checks.find(x=>x.id==="framing").passed,true);
  assert.equal(result.checks.find(x=>x.id==="no-powered-by").passed,true);
  assert.ok(result.observations.some(x=>x.id==="cookies"));
});
test("A page returning a 404 must not be scored as secure",async()=>{
  const previous=global.fetch;
  global.fetch=async()=>({status:404,headers:new Headers(),body:null});
  try{const r=await run({httpMethod:"GET",queryStringParameters:{path:"/studio-antara.html"}});assert.equal(r.statusCode,502);assert.equal(parse(r).ok,false);}
  finally{global.fetch=previous;}
});
test("Aksara v2 UI uses existing scenic assets and actual translucent glass",()=>{
  const fs=require("node:fs"),path=require("node:path");
  const html=fs.readFileSync(path.join(__dirname,"../security-lab.html"),"utf8");
  const css=fs.readFileSync(path.join(__dirname,"../security-lab.css"),"utf8");
  const js=fs.readFileSync(path.join(__dirname,"../security-lab.js"),"utf8");
  assert.match(css,/backdrop-filter:\s*blur\(24px\)/);
  assert.match(css,/aksara-cinematic-mobile\.webp/);
  assert.match(css,/aksara-cinematic-desktop\.webp/);
  for(const mode of ["overview","web","code","reports"])assert.match(html,new RegExp('data-panel="'+mode+'"'));
  for(const id of ["runAudit","runAll","scanCode","exportReport","codeFile","comparisonSection"])
    assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(js,/function inspectCode\(/);
  assert.match(js,/URL\.createObjectURL/);
  assert.doesNotMatch(js,/eval\s*\(\s*source\s*\)/);
});
