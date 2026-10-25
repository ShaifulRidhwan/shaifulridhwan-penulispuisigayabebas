"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

const html=fs.readFileSync("bilik-antara.html","utf8");
const css=fs.readFileSync("bilik-antara-editorial-glass.css","utf8");
const existing=fs.readFileSync("bilik-antara-cinematic.css","utf8");

test("editorial glass CSS is loaded AFTER the cinematic base CSS",()=>{
 const base=html.indexOf('bilik-antara-cinematic.css?v=1');
 const second=html.indexOf('bilik-antara-editorial-glass.css?v=1');
 assert.ok(base>0&&second>base);
 assert.match(css,/\.conversation\s*\{/);
 assert.match(css,/background:[\s\S]*?rgba\(15,17,25,\.43\)/);
 assert.match(css,/backdrop-filter:blur\(3px\)/);
 assert.match(existing,/bilik-antara-cover-art\.jpg/);
});
test("book cover typography and image-inspired chat framing",()=>{
 for(const mark of ['<h1><span>Bilik</span> <em>Antara</em></h1>',
    'class="chapter-ornament"', 'Aku, Kecerdasan Buatan.',
    'class="channel-seal"', 'Saluran Antara', 'class="world-scene"',
    'class="messages" id="chat"'])assert.ok(html.includes(mark),mark);
 assert.match(css,/\.identity h1 span\s*\{/);
 assert.match(css,/\.identity h1 em\s*\{/);
 assert.match(css,/\.messages\.is-welcome .message\.ai .bubble\s*\{/);
 assert.match(css,/\.message\.user .bubble\s*\{/);
});
test("mobile layout and keyboard remain intact",()=>{
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/@media\(max-width:760px\) and \(max-height:680px\)/);
 assert.match(html,/visualViewport/);
 assert.match(html,/--app-height/);
 assert.match(css,/\.composer textarea\{font-size:16px/);
});
test("chat, upload, privacy and AI endpoint remain present",()=>{
 for(const id of ['chat','connection','connectionText','connectionInfo','retryBtn',
    'composer','input','sendBtn','documentUpload','rememberChat','clearChat',
    'thoughtItems','forgetIdeas','docStatus','removeAttachment','themeToggle']){
  assert.ok(html.includes('id="'+id+'"'),"Missing "+id);
 }
 for(const feature of ['ENDPOINT="/.netlify/functions/bilik-antara"','publicAccount',
     'truthAudit','argumentMap','thoughtLedger','renderExtras','fileState']){
  assert.ok(html.includes(feature),"Missing "+feature);
 }
 assert.doesNotMatch(html,/<script src="https:\/\/.*three/i);
});
test("new stylesheet braces, strings and comments are balanced",()=>{
 let depth=0,quoted="",comment=false,escape=false;
 for(let i=0;i<css.length;i++){
  const c=css[i],next=css[i+1];
  if(comment){if(c==="*"&&next==="/"){comment=false;i++;}continue;}
  if(quoted){
   if(escape){escape=false;continue;}
   if(c==="\\"){escape=true;continue;}
   if(c===quoted)quoted="";
   continue;
  }
  if(c==="/"&&next==="*"){comment=true;i++;continue;}
  if(c==="'"||c==='"'){quoted=c;continue;}
  if(c==="{")depth++;
  if(c==="}"){depth--;assert.ok(depth>=0);}
 }
 assert.equal(depth,0);
 assert.equal(quoted,"");
 assert.equal(comment,false);
});
