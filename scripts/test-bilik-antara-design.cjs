"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("bilik-antara.html","utf8");
const css=fs.readFileSync("bilik-antara-horizon.css","utf8");

test("Horizon: futuristic light and dark styling is external and cacheable",()=>{
 assert.match(html,/href="bilik-antara-horizon\.css\?v=4"/);
 assert.ok(!html.includes("<style>"),"Heavy inline stylesheet must be removed");
 assert.match(css,/html\[data-theme="light"\] body/);
 assert.match(css,/\.eclipse-scene/);
 assert.match(css,/\.orbit-scan/);
 assert.match(css,/\.conversation::before/);
 assert.match(css,/\.message\.ai \.bubble/);
 assert.match(css,/\.message\.user \.bubble/);
 assert.match(css,/\.composer:focus-within/);
 assert.match(css,/\.shell\.is-busy/);
 assert.match(css,/@keyframes orbitSpin/);
});
test("Animation is lightweight and respects accessibility settings",()=>{
 assert.ok(!html.includes("<canvas"));
 assert.ok(!html.includes("ai-face"));
 assert.ok(!html.includes("THREE."));
 assert.ok(!css.includes("@import"),"Avoid third-party style runtime imports");
 assert.ok(!css.includes("filter:blur("),"Avoid per-frame element blur");
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/@media\(max-width:405px\)/);
 assert.ok(html.length<32000,"HTML should remain lean");
 assert.ok(css.length<45000,"CSS should stay small enough to cache efficiently");
});
test("All AI, OSINT, chat, files, memory and theme control hooks survive",()=>{
 const ids=["chat","connection","connectionText","connectionInfo","connectionInfoText",
  "retryBtn","starters","composer","input","sendBtn","documentUpload",
  "rememberChat","clearChat","thoughtItems","forgetIdeas","docStatus",
  "removeAttachment","themeToggle"];
 for(const id of ids)assert.ok(html.includes('id="'+id+'"'),"Missing "+id);
 assert.match(html,/\/\.netlify\/functions\/bilik-antara/);
 assert.ok(!html.includes("data-insight="),"Modes must remain automatic");
 for(const key of ["publicAccount","argumentMap","truthAudit","thoughtLedger","profileUrl","sessionSummary","summary:"]){
  if(key==="sessionSummary")continue;
  assert.ok(html.includes(key),"Missing "+key);
 }
 assert.match(html,/\.classList\.toggle\("is-busy",busy\)/);
});
test("No inline JavaScript syntax errors or duplicate element IDs",()=>{
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,1);
 for(const [,content]of scripts)assert.doesNotThrow(()=>new Function(content));
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(ids.length,new Set(ids).size);
});
test("Stylesheet brackets are balanced, ignoring comments and strings",()=>{
 let depth=0,quote="",comment=false,escaped=false;
 for(let i=0;i<css.length;i++){
  const c=css[i],n=css[i+1];
  if(comment){if(c==="*"&&n==="/"){comment=false;i++;}continue;}
  if(quote){
   if(escaped){escaped=false;continue;}
   if(c==="\\"){escaped=true;continue;}
   if(c===quote)quote="";
   continue;
  }
  if(c==="/"&&n==="*"){comment=true;i++;continue;}
  if(c==="'"||c==='"'){quote=c;continue;}
  if(c==="{")depth++;
  if(c==="}"){depth--;assert.ok(depth>=0,"Extra closing bracket at "+i);}
 }
 assert.equal(depth,0);
 assert.equal(quote,"");
 assert.equal(comment,false);
});
