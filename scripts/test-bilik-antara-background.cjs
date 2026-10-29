'use strict';
// CI-only visual regression: the real supplied wallpapers, no AI inference.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const base=process.env.BACKGROUND_BASE_SHA||'3edd611c94bccb940ede511a229a41b3167bdb45';
const url=process.env.AUDIT_BASE||'http://127.0.0.1:4177';
const out='browser-audit-artifacts';fs.mkdirSync(out,{recursive:true});
const original=Object.fromEntries(['bilik-antara.html','bilik-antara.css'].map(f=>[f,execFileSync('git',['show',base+':'+f],{encoding:'utf8'})]));
const sizes=[[1920,1080],[1366,768],[390,844],[360,800]];
async function state(page){return page.evaluate(()=>{
 const css=s=>getComputedStyle(document.querySelector(s));
 const geometry=Object.fromEntries(['.topbar','.app-shell','.conversation','.composer','#input','#voiceLive','#connection'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [s,[r.x,r.y,r.width,r.height].map(n=>Math.round(n*10)/10)];}));
 const effects=Object.fromEntries(['.world-art','.world-haze','.world-embers i','.world-hand-sparks i','.frame-glow--light','.frame-glow--shadow','.voice-live-label'].map(s=>{const a=css(s);return [s,[a.animationName,a.animationDuration,a.animationPlayState]];}));
 const glass=Object.fromEntries(['.conversation','.composer','.settings-card','.voice-live-label'].map(s=>{const a=css(s);return [s,[a.backgroundColor,a.backdropFilter||a.webkitBackdropFilter,a.borderRadius,a.color,a.fontFamily]];}));
 return {geometry,effects,glass,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,background:css('.world-art').backgroundImage,position:css('.world-art').backgroundPosition,particles:document.querySelectorAll('.world-hand-sparks i').length};
});}
async function inspect(browser,width,height,mode){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1}),page=await context.newPage();
 const errors=[],assets=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(/bilik-antara-(bg-.*webp|cover-art.jpg)/.test(r.url()))assets.push({url:r.url(),status:r.status()});});
 // Health checks are deliberately unavailable in this offline UI test; no AI call is made.
 await page.route('**/.netlify/functions/**',r=>r.fulfill({status:503,json:{error:'Offline browser audit'}}));
 if(mode==='before'){
  await page.route('**/bilik-antara.html',r=>r.fulfill({contentType:'text/html',body:original['bilik-antara.html']}));
  await page.route('**/bilik-antara.css?*',r=>r.fulfill({contentType:'text/css',body:original['bilik-antara.css']}));
 }
 if(mode==='fallback')await page.route('**/bilik-antara-bg-*.webp',r=>r.abort('failed'));
 await page.goto(url+'/bilik-antara.html',{waitUntil:'networkidle'});
 await page.locator('#chat .message.ai').first().waitFor();
 await page.evaluate(()=>document.fonts.ready);
 const result=await state(page);
 assert.equal(result.overflow,false,mode+' '+width+' horizontal overflow');
 assert.equal(result.particles,24);
 assert.match(result.effects['.world-art'][0],/worldBreath/);
 assert.match(result.effects['.world-haze'][0],/hazeDrift/);
 assert.match(result.effects['.world-embers i'][0],/embersTravel/);
 assert.match(result.effects['.world-hand-sparks i'][0],/handSparkDescent/);
 assert.equal(result.effects['.frame-glow--light'][0],'frameLightBreathe');
 assert.equal(result.effects['.frame-glow--shadow'][0],'frameShadowBreathe');
 if(mode!=='before'){
  const selected='bilik-antara-bg-'+(width<=760?'mobile':'desktop')+'.webp';
  assert.ok(result.background.includes(selected));
  assert.ok(result.background.includes('bilik-antara-cover-art.jpg'));
  const dimensions=await page.evaluate(async source=>{const img=new Image();img.src=source;await img.decode();return [img.naturalWidth,img.naturalHeight];},mode==='fallback'?'bilik-antara-cover-art.jpg?v=2':selected);
  assert.ok(dimensions[0]>0&&dimensions[1]>0);
  if(mode==='after'){
   assert.deepEqual(dimensions,width<=760?[864,1536]:[1536,864]);
   assert.equal(assets.filter(a=>a.url.includes('bg-')&&!a.url.includes(selected)).length,0,'Do not download the opposite wallpaper');
  }
 }
 assert.ok(assets.some(a=>a.url.includes('cover-art.jpg')&&a.status===200),'Original fallback must remain available');
 // Animations advance before the screenshot freezes them for comparison.
 const moving=await page.evaluate(async()=>{const animations=document.querySelector('.world-art').getAnimations();const t=animations[0]?.currentTime;await new Promise(r=>setTimeout(r,80));return animations[0]?.currentTime>t;});
 assert.equal(moving,true,'Existing ambient animation advances');
 await page.screenshot({path:path.join(out,`background-${width}-${height}-${mode}.png`),animations:'disabled'});
 // Existing controls still work; no Voice/microphone session is initiated.
 await page.locator('#input').fill('Ujian latar sahaja');assert.equal(await page.locator('#sendBtn').isEnabled(),true);
 await page.locator('#settingsPanel > summary').click();assert.equal(await page.locator('#featureSessions').isVisible(),true);
 await page.locator('#settingsPanel > summary').click();
 assert.equal(await page.locator('#voicePanel').isVisible(),false);
 assert.deepEqual(errors,[],mode+' page errors');
 await context.close();return result;
}
async function main(){const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{
 for(const [w,h] of sizes){const before=await inspect(browser,w,h,'before'),after=await inspect(browser,w,h,'after'),fallback=await inspect(browser,w,h,'fallback');
  for(const key of ['geometry','effects','glass']){assert.deepEqual(after[key],before[key],key+' changed at '+w);assert.deepEqual(fallback[key],before[key],key+' fallback changed at '+w);}
  console.log(JSON.stringify({viewport:[w,h],layoutUnchanged:true,glassUnchanged:true,animationsUnchanged:true,wallpaperDecoded:true,originalFallbackDecoded:true,overflow:false,controls:true}));
 }
}finally{await browser.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
