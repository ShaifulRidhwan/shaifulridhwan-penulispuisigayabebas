"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

const html=fs.readFileSync("bilik-antara.html","utf8");
const css=fs.readFileSync("bilik-antara-editorial-glass.css","utf8");
const existing=fs.readFileSync("bilik-antara-cinematic.css","utf8");

test("editorial glass CSS is loaded AFTER the cinematic base CSS",()=>{
 const base=html.indexOf('bilik-antara-cinematic.css?v=1');
 const second=html.indexOf('bilik-antara-editorial-glass.css?v=3');
 assert.ok(base>0&&second>base);
 assert.match(css,/\.conversation\s*\{/);
 assert.match(css,/background:[\s\S]*?rgba\(15,17,25,\.43\)/);
 assert.match(css,/backdrop-filter:blur\(3px\)/);
 assert.match(existing,/bilik-antara-cover-art\.jpg/);
});
test("book cover typography and image-inspired chat framing",()=>{
 for(const mark of ['<h1><span>Bilik</span> <em>Antara</em></h1>',
    'class="chapter-ornament"', 'KECERDASAN BUATAN AI', '-SHAIFUL RIDHWAN-',
    'class="channel-seal channel-seal--muse"', 'Saluran Antara', 'class="world-scene"',
    'class="messages" id="chat"'])assert.ok(html.includes(mark),mark);
 assert.match(css,/\.identity h1 span\s*\{/);
 assert.match(css,/\.identity h1 em\s*\{/);
 assert.match(css,/\.messages\.is-welcome .message\.ai .bubble\s*\{/);
 assert.match(css,/\.message\.user .bubble\s*\{/);
});
test("requested concise hero, greeting and blank composer",()=>{
 assert.doesNotMatch(html,/class="signature"|class="intro"/);
 assert.doesNotMatch(html,/Di antara cahaya dan gelap, kebenaran bukan sekadar sesuatu yang dijawab/);
 assert.doesNotMatch(html,/<span class="brand-name">Bilik Antara/);
 assert.match(html,/<span class="brand-name"><span>KECERDASAN BUATAN AI<\/span><span>-SHAIFUL RIDHWAN-<\/span><\/span>/);
 assert.match(html,/Aku kecerdasan buatan yang dibina oleh Shaiful Ridhwan untuk menguji pemikiran/);
 assert.match(html,/<textarea[^>]+id="input" placeholder=""/);
 assert.doesNotMatch(html,/Tanya apa sahaja\. Hujah lemah pun boleh/);
 assert.match(css,/flex:0 0 clamp\(145px,20dvh,210px\)/);
 assert.match(css,/flex:0 0 clamp\(105px,16dvh,142px\)/);
});
test("female emblem links, centered all-caps hero and preserved chat endpoints",()=>{
 const svg=fs.readFileSync("bilik-antara-woman-emblem.svg","utf8");
 assert.match(svg,/<svg[^>]+viewBox="0 0 96 96"/);
 assert.match(svg,/<path[^>]+fill="url\(#face\)"/);
 assert.equal((html.match(/src="bilik-antara-woman-emblem\.svg"/g)||[]).length,2);
 assert.match(html,/<div class="eyebrow">DI ANTARA CAHAYA DAN GELAP<\/div>/);
 assert.doesNotMatch(html,/Ruang di antara cahaya &amp; gelap/);
 assert.match(css,/\.identity \.eyebrow\{[\s\S]*?justify-content:center/);
 assert.match(css,/\.message\.ai::before\{[\s\S]*?bilik-antara-woman-emblem\.svg/);
 assert.match(html,/ENDPOINT="\/\.netlify\/functions\/bilik-antara"/);
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
