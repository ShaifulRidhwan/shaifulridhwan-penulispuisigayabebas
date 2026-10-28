"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("bilik-antara.html","utf8");
const css=fs.readFileSync("bilik-antara.css","utf8");
const cover=fs.readFileSync("bilik-antara-cover-art.jpg");
const emblem=fs.readFileSync("bilik-antara-woman-emblem.svg","utf8");

test("One clean external stylesheet and preserved cinematic assets",()=>{
 assert.match(html,/href="bilik-antara\.css\?v=\d+"/);
 assert.doesNotMatch(html,/bilik-antara-(horizon|cinematic|editorial-glass)\.css/);
 assert.doesNotMatch(html,/<style\b/);
 assert.equal((html.match(/rel="stylesheet" href="bilik-antara\.css/g)||[]).length,1);
 assert.match(css,/\.world-art/);
 assert.match(css,/bilik-antara-cover-art\.jpg/);
 assert.match(css,/\.message\.ai::before/);
 assert.match(css,/bilik-antara-woman-emblem\.svg/);
 assert.equal(cover[0],0xff);assert.equal(cover[1],0xd8);
 assert.match(emblem,/<svg[^>]+viewBox="0 0 96 96"/);
 assert.ok(css.length<110000,"CSS bundle unexpectedly big");
});

test("Final text, controls and simplified channel header",()=>{
 assert.match(html,/<h1><span>BILIK<\/span> <em>ANTARA<\/em><\/h1>/);
 assert.match(html,/<div class="eyebrow">DI ANTARA CAHAYA DAN GELAP<\/div>/);
 assert.doesNotMatch(html,/Saluran Antara/);
 assert.doesNotMatch(html,/class="conversation-heading"/);
 assert.match(html,/class="conversation-head">\s*<div class="voice-toolbar"/);
 assert.match(html,/id="voiceLive"[\s\S]*?<div class="chat-controls"/);
 assert.match(html,/addMessage\("assistant","Assalamualaikum dan selamat sejahtera\."\)/);
 assert.doesNotMatch(html,/Aku kecerdasan buatan yang dibina oleh Shaiful Ridhwan/);
 assert.match(html,/AKSARA A\.I\./);
 assert.match(html,/oleh Shaiful Ridhwan/);
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

test("Mobile viewport, permanent dark theme and conversation functions retained",()=>{
 assert.match(css,/@media\(max-width:760px\)/);
 assert.doesNotMatch(css,/data-theme="light"/);
 assert.doesNotMatch(html,/id="themeLight"|id="themeDark"|function setTheme/);
 assert.match(html,/<meta name="color-scheme" content="dark">/);
 assert.match(css,/\.shell\.is-busy/);
 assert.match(css,/\.composer textarea\{\s*font-size:16px/);
 assert.match(html,/visualViewport/);
 assert.match(html,/ENDPOINT="\/\.netlify\/functions\/bilik-antara"/);
 for(const id of ["chat","connection","connectionText","connectionInfo","connectionInfoText",
  "retryBtn","starters","composer","input","sendBtn","documentUpload",
  "rememberChat","clearChat","thoughtItems","forgetIdeas","docStatus",
  "removeAttachment","stopBtn","contextFallback"])assert.ok(html.includes('id="'+id+'"'),"Missing "+id);
 for(const x of ["publicAccount","argumentMap","truthAudit","thoughtLedger","renderExtras","fileState","summary:"])
  assert.ok(html.includes(x),"Missing "+x);
 assert.match(html,/\.classList\.toggle\("is-busy",busy\)/);
 assert.ok(!html.includes("<canvas"));
 assert.ok(!html.includes("THREE."));
});

test("Inline JavaScript valid and element IDs unique",()=>{
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter(m=>m[1].trim()&&!m[0].includes("importmap"));
 assert.equal(scripts.length,1);
 assert.doesNotThrow(()=>new Function(scripts[0][1]));
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(ids.length,new Set(ids).size);
 assert.ok(html.length<60000);
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


test("Feature icon consolidates sessions, performance, studio and keeps privacy actions",()=>{
 const suite=fs.readFileSync("bilik-antara-suite.js","utf8");
 const suiteCSS=fs.readFileSync("bilik-antara-suite.css","utf8");
 assert.match(html,/<summary aria-label="Buka Ciri dan Fungsi Aksara"/);
 assert.match(html,/<div class="settings-title">Ciri &amp; Fungsi<\/div>/);
 for(const id of ["featureSessions","featureMetrics","featureStudio","privacySettings","rememberChat","contextFallback","clearChat","voiceDictate","ideaLedger","forgetIdeas"]){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,"Feature or privacy control missing/duplicated: "+id);
 }
 assert.match(html,/<a class="feature-hub-item" id="featureStudio" href="studio-antara\.html">/);
 assert.match(html,/<details class="feature-privacy" id="privacySettings">/);
 assert.match(suite,/featureSessions\?\.addEventListener\("click",\(\)=>open\("sessions"\)\)/);
 assert.match(suite,/featureMetrics\?\.addEventListener\("click",\(\)=>open\("metrics"\)\)/);
 assert.match(suite,/if\(settings\)settings\.open=false;/);
 assert.match(suite,/head\.after\(status\)/);
 assert.doesNotMatch(suite,/head\.after\(toolbar\)|ba-toolbar|ba-tab/);
 assert.doesNotMatch(suiteCSS,/ba-toolbar|ba-tab/);
 assert.match(css,/\.conversation-head:has\(#settingsPanel\[open\]\)/);
 assert.match(css,/\.conversation #settingsPanel \.feature-hub-item/);
 assert.match(css,/\.conversation>\.messages\.is-welcome/);
});

test("Header chips stay optically aligned and feature interactions have gentle golden motion",()=>{
 assert.match(html,/href="bilik-antara\.css\?v=49"/);
 assert.match(css,/\.conversation-head #voiceLive,\s*\.conversation-head #connection,\s*\.conversation-head #settingsPanel > summary\s*\{/);
 assert.match(css,/height:42px;\s*min-height:42px!important;\s*max-height:42px/);
 assert.match(css,/@media\(max-width:760px\)\{[\s\S]*?\.conversation-head #voiceLive,\.conversation-head #connection/);
 assert.match(css,/@keyframes aksaraFeaturesEnter/);
 assert.match(css,/@keyframes aksaraFeaturesExit/);
 assert.match(css,/\.conversation #settingsPanel\.is-closing \.settings-card/);
 assert.match(css,/\.conversation-head #settingsPanel > summary:focus-visible/);
 assert.match(css,/-webkit-tap-highlight-color:transparent/);
 assert.match(css,/@keyframes aksaraPrivacyReveal/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(html,/featureSummary\.addEventListener\("click",event=>/);
 assert.match(html,/function closeFeatureMenu\(\)/);
 assert.match(html,/if\(event\.key==="Escape"&&ui\.settings\.open\)/);
});

test("Rounded Aksara controls share Liquid Glass, preserve contrast and cap mobile blur",()=>{
 const suite=fs.readFileSync("bilik-antara-suite.css","utf8");
 assert.match(html,/href="bilik-antara-suite\.css\?v=6"/);
 assert.match(css,/\/\* Liquid Glass · clearer optical glass/);
 for(const selector of [".topbar .brand",".topbar .nav-link",
  ".conversation-head #voiceLive",".conversation-head #connection",
  ".conversation-head #settingsPanel>summary",".conversation .starter",
  ".conversation #settingsPanel .feature-hub-item"]){
  assert.ok(css.includes(selector),"Missing common glass surface: "+selector);
 }
 assert.match(css,/--lg-reflection:/);
 assert.match(css,/linear-gradient\(145deg,rgba\(255,247,224,\.035\),rgba\(125,167,205,\.018\)\)/);
 assert.match(css,/inset 0 1px 0 var\(--lg-reflection\)/);
 assert.match(css,/\.conversation-head #connection\.ready/);
 assert.match(css,/\.conversation #settingsPanel \[?\.settings-card|\.conversation #settingsPanel \.settings-card/);
 assert.match(css,/\.conversation \.composer:focus-within/);
 assert.match(css,/\.messages \.message\.user \.bubble/);
 assert.match(css,/backdrop-filter:blur\(2px\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(suite,/Match archive\/performance controls to Aksara's rounded Liquid Glass/);
 assert.match(suite,/\.ba-drawer :is\(\.ba-button,\.ba-mini,\.ba-tiny,\.ba-close,\.ba-session-title\)/);
});

test("Clear Liquid Glass preserves background visibility and treats Send like a glass control",()=>{
 const clear=css.slice(css.indexOf("/* Liquid Glass · clearer optical glass"));
 assert.match(html,/href="bilik-antara\.css\?v=49"/);
 assert.match(clear,/clearer optical glass: transparent tint/);
 assert.match(clear,/rgba\(255,247,224,\.035\)/);
 assert.match(clear,/backdrop-filter:blur\(5px\)/);
 assert.match(clear,/backdrop-filter:blur\(3px\)/);
 assert.match(clear,/\.conversation \.composer:focus-within\{/);
 assert.match(clear,/\.conversation \.composer #sendBtn\{/);
 assert.match(clear,/\.conversation \.composer #sendBtn:disabled\{/);
 assert.match(clear,/\.conversation \.composer #sendBtn:not\(:disabled\)\{/);
 assert.match(clear,/\.conversation \.composer #sendBtn:hover:not\(:disabled\)\{/);
 assert.match(clear,/rgba\(244,216,171,\.055\)/);
 assert.match(clear,/rgba\(253,223,174,\.115\)/);
 assert.doesNotMatch(clear,/rgba\(255,242,207,\.96\)/);
});

test("Voice and Multi AI pills share starter-question sizing and genuinely clearer glass",()=>{
 const clear=css.slice(css.indexOf("/* Liquid Glass · clearer optical glass"));
 const pills=clear.slice(clear.indexOf("/* Two header pills"),clear.indexOf("/* Readable menus"));
 assert.match(pills,/\.conversation-head #voiceLive,\.conversation-head #connection\{/);
 assert.match(pills,/height:38px!important;min-height:38px!important;max-height:38px!important/);
 assert.match(pills,/padding:8px 12px!important/);
 assert.match(pills,/font:500 12px\/1\.4 'DM Sans'/);
 assert.match(clear,/@media\(max-width:760px\)\{[\s\S]*?height:37px!important;min-height:37px!important;max-height:37px!important/);
 assert.match(clear,/\.conversation\{[\s\S]*?rgba\(15,17,25,\.20\)/);
 assert.match(clear,/backdrop-filter:blur\(2px\)/);
 assert.match(clear,/\.conversation \.composer #sendBtn:not\(:disabled\)\{/);
 assert.doesNotMatch(clear,/rgba\(255,242,207,\.96\)|rgba\(214,172,111,\.91\)/);
});
