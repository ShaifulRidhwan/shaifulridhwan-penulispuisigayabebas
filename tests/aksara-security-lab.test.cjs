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

test("HTTP indicator weighting does not treat high and low risks equally",()=>{
  const checks=[
    {passed:true,weight:5},{passed:false,weight:1}
  ];
  assert.equal(lab._internal.score(checks),83);
  assert.equal(lab._internal.score(checks.map(x=>({...x,passed:false}))),0);
  assert.equal(lab._internal.score([]),0);
});
test("Public HTTP audit v3 includes model disclaimer and weighted checks",async()=>{
  const previous=global.fetch;
  global.fetch=async()=>({status:200,headers:new Headers({
    "strict-transport-security":"max-age=31536000",
    "content-security-policy":"default-src 'self'; frame-ancestors *; object-src 'none'; base-uri 'self'",
    "x-content-type-options":"nosniff"
  }),body:null});
  try{
    const r=await run({httpMethod:"GET",queryStringParameters:{path:"/"}}),data=parse(r);
    assert.equal(data.schemaVersion,3);
    assert.match(data.scoreModel,/not-penetration-test/);
    assert.equal(data.checks.find(x=>x.id==="framing").passed,false);
    assert.ok(data.checks.find(x=>x.id==="hsts").weight>data.checks.find(x=>x.id==="permissions").weight);
    assert.equal(data.score,lab._internal.score(data.checks));
  }finally{global.fetch=previous;}
});
test("Security CI is accessible, glass tokens shared and history defaults off",()=>{
  const fs=require("node:fs"),path=require("node:path");
  const root=path.join(__dirname,"..");
  const html=fs.readFileSync(path.join(root,"security-lab.html"),"utf8");
  const bilik=fs.readFileSync(path.join(root,"bilik-antara.html"),"utf8");
  const ci=fs.readFileSync(path.join(root,"security-ci.js"),"utf8");
  const tokens=fs.readFileSync(path.join(root,"aksara-glass-tokens.css"),"utf8");
  assert.match(html,/id="ciStatus"/);
  assert.match(html,/id="importFindings"/);
  assert.match(html,/id="analyzeSecurity"/);
  assert.match(html,/role="tablist"/);
  assert.match(html,/id="saveAuditHistory"/);
  assert.doesNotMatch(html,/id="saveAuditHistory"[^>]+checked/);
  assert.match(html,/aksara-glass-tokens\.css/);
  assert.match(bilik,/aksara-glass-tokens\.css/);
  assert.match(tokens,/--aksara-glass-surface:/);
  assert.match(ci,/security-reports\/latest\.json/);
  assert.match(ci,/document\.createElement/);
  assert.doesNotMatch(ci,/\beval\s*\(/);
});
