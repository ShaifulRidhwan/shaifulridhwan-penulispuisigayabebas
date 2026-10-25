"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("bilik-antara.html","utf8");
const css=fs.readFileSync("bilik-antara.css","utf8");
const cover=fs.readFileSync("bilik-antara-cover-art.jpg");
const emblem=fs.readFileSync("bilik-antara-woman-emblem.svg","utf8");

test("One clean external stylesheet and preserved cinematic assets",()=>{
 assert.match(html,/href="bilik-antara\.css\?v=1"/);
 assert.doesNotMatch(html,/bilik-antara-(horizon|cinematic|editorial-glass)\.css/);
 assert.doesNotMatch(html,/<style\b/);
 assert.equal((html.match(/rel="stylesheet" href="bilik-antara\.css/g)||[]).length,1);
 assert.match(css,/\.world-art/);
 assert.match(css,/bilik-antara-cover-art\.jpg/);
 assert.match(css,/\.message\.ai::before/);
 assert.match(css,/bilik-antara-woman-emblem\.svg/);
 assert.equal(cover[0],0xff);assert.equal(cover[1],0xd8);
 assert.match(emblem,/<svg[^>]+viewBox="0 0 96 96"/);
 assert.ok(css.length<65000,"CSS bundle unexpectedly big");
});

test("Final text, controls and simplified channel header",()=>{
 assert.match(html,/<h1><span>BILIK<\/span> <em>ANTARA<\/em><\/h1>/);
 assert.match(html,/<div class="eyebrow">DI ANTARA CAHAYA DAN GELAP<\/div>/);
 assert.doesNotMatch(html,/Saluran Antara/);
 assert.doesNotMatch(html,/class="conversation-heading"/);
 assert.match(html,/class="conversation-head">\s*<div class="chat-controls"/);
 assert.match(html,/addMessage\("assistant","Assalamualaikum dan selamat sejahtera\."\)/);
 assert.doesNotMatch(html,/Aku kecerdasan buatan yang dibina oleh Shaiful Ridhwan/);
 assert.match(html,/KECERDASAN BUATAN AI/);
 assert.match(html,/-SHAIFUL RIDHWAN-/);
 assert.match(html,/<textarea[^>]+id="input" placeholder=""/);
 assert.doesNotMatch(html,/class="brand-mark|class="channel-seal/);
});

test("No obsolete orbital, dashboard or removed title styles",()=>{
 assert.doesNotMatch(css,/\.eclipse-(scene|light|ring|grain|label)|\.orbit-(scan|index|coordinate)/);
 assert.doesNotMatch(css,/@keyframes (orbitSpin|ringActive|scanSweep|eclipseFloat)/);
 assert.doesNotMatch(css,/\.conversation-heading|\.brand-mark|\.channel-seal/);
 assert.doesNotMatch(css,/\.identity \.intro|\.identity \.signature|\.identity \.thesis/);
 assert.match(css,/\.messages\.is-welcome/);
 assert.match(css,/\.conversation::before/);
 assert.match(css,/\.message\.ai \.bubble/);
 assert.match(css,/\.message\.user \.bubble/);
 assert.match(css,/\.composer:focus-within/);
});

test("Faster ambience and animated translucent glass layer",()=>{
 assert.match(css,/\.world-art\{animation-duration:11s\}/);
 assert.match(css,/\.world-haze\{animation-duration:7s\}/);
 assert.match(css,/\.world-embers\{animation-duration:17s\}/);
 assert.match(css,/\.conversation::after\{\s*content:"";\s*display:block/);
 assert.match(css,/@keyframes glassGlide/);
 assert.match(css,/animation:glassGlide 5\.4s/);
 assert.match(css,/transform:translate3d\(/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.conversation::after\{animation:none/);
 assert.ok(!css.includes("@import"));
});

test("Mobile viewport, light theme and conversation functions retained",()=>{
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/html\[data-theme="light"\] body/);
 assert.match(css,/\.shell\.is-busy/);
 assert.match(css,/\.composer textarea\{font-size:16px/);
 assert.match(html,/visualViewport/);
 assert.match(html,/ENDPOINT="\/\.netlify\/functions\/bilik-antara"/);
 for(const id of ["chat","connection","connectionText","connectionInfo","connectionInfoText",
  "retryBtn","starters","composer","input","sendBtn","documentUpload",
  "rememberChat","clearChat","thoughtItems","forgetIdeas","docStatus",
  "removeAttachment","themeToggle"])assert.ok(html.includes('id="'+id+'"'),"Missing "+id);
 for(const x of ["publicAccount","argumentMap","truthAudit","thoughtLedger","renderExtras","fileState","summary:"])
  assert.ok(html.includes(x),"Missing "+x);
 assert.match(html,/\.classList\.toggle\("is-busy",busy\)/);
 assert.ok(!html.includes("<canvas"));
 assert.ok(!html.includes("THREE."));
});

test("Inline JavaScript valid and element IDs unique",()=>{
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,1);
 assert.doesNotThrow(()=>new Function(scripts[0][1]));
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(ids.length,new Set(ids).size);
 assert.ok(html.length<32000);
});

test("CSS braces and quoted strings remain balanced",()=>{
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
  if(c==='"'||c==="'"){quote=c;continue;}
  if(c==="{")depth++;
  if(c==="}"){depth--;assert.ok(depth>=0,"Unbalanced close at "+i);}
 }
 assert.equal(depth,0);assert.equal(quote,"");assert.equal(comment,false);
});
