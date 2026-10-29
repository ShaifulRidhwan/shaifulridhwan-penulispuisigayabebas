'use strict';
// CI-only browser integration. All image calls are labelled mocks, never Cloudflare inference.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),C=require('../studio-antara-config');
const BASE=process.env.AUDIT_BASE||'http://127.0.0.1:4179',ORIGIN=new URL(BASE).origin;
function crc(bytes){let n=0xffffffff;for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4),check=Buffer.alloc(4);len.writeUInt32BE(data.length);check.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([len,t,data,check]);}
function png(w,h){const raw=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++){const start=y*(w*3+1);for(let x=0;x<w;x++){raw[start+1+x*3]=80+Math.floor(x/w*120);raw[start+2+x*3]=70;raw[start+3+x*3]=100+Math.floor(y/h*120);}}const head=Buffer.alloc(13);head.writeUInt32BE(w);head.writeUInt32BE(h,4);head[8]=8;head[9]=2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
async function pick(page,id,value){
 const trigger=page.locator('#'+id+' + .studio-picker-trigger');
 await trigger.click();
 const dialog=page.locator('.studio-picker-dialog');
 await dialog.waitFor({state:'visible'});
 const color=await dialog.evaluate(el=>getComputedStyle(el).backgroundImage);
 assert.match(color,/gradient/,'Picker must use dark custom theme');
 const center=await dialog.evaluate(el=>{
  const box=el.getBoundingClientRect();
  return {difference:Math.abs((box.top+box.bottom)/2-innerHeight/2),
          within:box.top>=-1&&box.bottom<=innerHeight+1,
          background:getComputedStyle(el).backgroundImage};
 });
 assert.ok(center.difference<12,'Picker should appear at viewport center, not bottom: '+JSON.stringify(center));
 assert.ok(center.within,'Picker must fit inside viewport');
 const option=page.locator('.studio-picker-option[data-value="'+value+'"]');
 if(page.viewportSize().width<=680)await option.tap();else await option.click();
 assert.equal(await page.locator('#'+id).inputValue(),value);
 assert.equal(await trigger.locator('span').textContent(),await page.locator('#'+id+' option:checked').textContent());
 assert.equal(await page.locator('.studio-picker-backdrop').isHidden(),true);
}
async function auditPickers(page,calls){
 const trigger=page.locator('#imageStyle + .studio-picker-trigger');
 assert.equal(await trigger.getAttribute('aria-haspopup'),'dialog');
 await trigger.focus();await trigger.press('Enter');
 assert.equal(await trigger.getAttribute('aria-expanded'),'true');
 await page.keyboard.press('End');
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.value),'fantasy');
 assert.equal(await page.locator('.studio-picker-option[data-value="fantasy"]').evaluate(el=>{const r=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return r.bottom<=p.bottom+1&&r.top>=p.top-1;}),true,'Keyboard scrolls the last preset into view');
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.className),'studio-picker-close');
 await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.value),'fantasy');
 await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>document.activeElement.dataset.value),'none');
 await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.dataset.value),'antara');
 await page.keyboard.press('Escape');assert.equal(await trigger.getAttribute('aria-expanded'),'false');
 assert.equal(await trigger.evaluate(el=>el===document.activeElement),true,'Escape restores focus');
 for(const value of Object.keys(C.presets))await pick(page,'imageStyle',value);
 // Reopening the final preset must bring it into view even with preventScroll focus.
 await trigger.click();assert.equal(await page.locator('.studio-picker-option[aria-pressed="true"]').evaluate(el=>{const r=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return r.bottom<=p.bottom+1&&r.top>=p.top-1;}),true);
 await page.locator('.studio-picker-close').click();
 for(const value of Object.keys(C.ratios))await pick(page,'imageRatio',value);
 for(const value of C.qualities)await pick(page,'imageQuality',value);
 for(const value of Object.keys(C.models)){
  await pick(page,'imageModel',value);
  assert.equal(await page.locator('#imageRatio + button span').textContent(),await page.locator('#imageRatio option:checked').textContent(),'Automatic ratio reset updates the caption');
  assert.equal(await page.locator('#imageQuality + button').isDisabled(),value==='ovh');
 }
 assert.equal(calls.length,0,'Choosing settings must never generate an image');
}
async function main(){
 const root=path.resolve('.'),server=http.createServer((req,res)=>{const url=new URL(req.url,'http://local'),file=path.join(root,url.pathname==='/'?'studio-antara.html':url.pathname);try{const b=fs.readFileSync(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(b);}catch(_){res.statusCode=404;res.end();}});
 await new Promise(resolve=>server.listen(4179,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});fs.mkdirSync('studio-audit-artifacts',{recursive:true});
 try{for(const [label,width,height] of [['desktop',1440,1000],['mobile',390,844],['small-mobile',320,760]]){
  const context=await browser.newContext({viewport:{width,height},acceptDownloads:true,...(width<=680?{isMobile:true,hasTouch:true}:{})}),page=await context.newPage(),calls=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===ORIGIN?r.continue():r.abort());
  await page.route('**/.netlify/functions/**',async route=>{
   const data=route.request().postDataJSON();calls.push({url:route.request().url(),...data});
   if(route.request().url().includes('enhance'))return data.prompt.includes('enhance503')?route.fulfill({status:503,json:{error:'AI mock unavailable'}}):route.fulfill({json:{ok:true,prompt:data.prompt+', clear visual composition',method:'ai',note:'Draf ujian. Semak dulu.'}});
   if(data.prompt.includes('fail429'))return route.fulfill({status:429,json:{error:'Had ujian dicapai.'}});
   if(data.prompt.includes('limit429'))return route.fulfill({status:429,headers:{'Retry-After':'75'},json:{error:'Had 8 percubaan dalam 10 minit dah dicapai.',scope:'studio'}});
   if(data.prompt.includes('ovh429'))return route.fulfill({status:429,headers:{'Retry-After':'55'},json:{error:'OVHcloud Beta sedang terhad.',scope:'ovh'}});
   if(data.prompt.includes('slow')){await new Promise(r=>setTimeout(r,1800));try{await route.fulfill({json:{}});}catch(_){}return;}
   const s=C.settings(data);if(s.model==='klein'&&s.seed===null)s.seed=42;const image=png(s.width,s.height);
   await route.fulfill({json:{ok:true,image:image.toString('base64'),mime:'image/png',settings:s,promptUsed:C.compose(s),modelName:C.models[s.model].name,width:s.width,height:s.height,durationMs:100}});
  });
  await page.goto(BASE+'/studio-antara.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{const mark=document.createElement('div');mark.textContent='UJIAN MOCK · BUKAN HASIL CLOUDFLARE';mark.style='position:fixed;top:0;left:0;right:0;z-index:9999;background:#6b4725;color:white;text-align:center;font:12px sans-serif;padding:4px';document.body.append(mark);});
  assert.equal(calls.length,0,'No AI requests on page load');assert.equal(await page.locator('#imageStyle option').count(),11);
  // Studio 2.2: protect the shared glass material and typography across sizes.
  const visual=await page.evaluate(()=>{
   const css=selector=>getComputedStyle(document.querySelector(selector));
   const card=css('.creator'),result=css('.result'),gallery=css('.gallery'),
    field=css('.prompt-compose'),trigger=css('.studio-picker-trigger'),
    modal=css('.studio-picker-dialog'),hero=css('.creator #studioTitle'),heading=css('.result .card-top h2'),nav=css('.topbar');
   return {
    cardFill:card.backgroundImage,resultFill:result.backgroundImage,galleryFill:gallery.backgroundImage,
    cardBlur:card.backdropFilter,fieldBlur:field.backdropFilter,triggerBlur:trigger.backdropFilter,
    modalFill:modal.backgroundImage,modalBlur:modal.backdropFilter,
    heroFont:hero.fontFamily,headingFont:heading.fontFamily,navBlur:nav.backdropFilter,navFill:nav.backgroundImage,
    promptWeight:css('#enhancePrompt').fontWeight,
    stylesheet:[...document.styleSheets].some(sheet=>sheet.href?.includes('studio-antara.css?v=17'))
   };
  });
  assert.equal(visual.stylesheet,true,'Audited Studio CSS must load');
  for(const key of ['cardFill','resultFill','galleryFill','modalFill'])assert.match(visual[key],/gradient/,'Missing unified glass gradient: '+key);
  for(const key of ['cardBlur','fieldBlur','triggerBlur','modalBlur'])assert.match(visual[key],/blur/,'Missing translucent glass blur: '+key);
  assert.match(visual.heroFont,/DM Sans/);assert.match(visual.headingFont,/DM Sans/);
  assert.match(visual.navBlur,/blur/,'Studio navigation needs Bilik-style glass');
  assert.match(visual.navFill,/gradient/);
  assert.equal(await page.locator('.hero').count(),0,'Standalone hero should be removed');
  assert.equal(await page.locator('.topbar').locator('a').count(),2,'Header should retain only Bilik Antara and Gaya Bebas');
  assert.equal(await page.locator('.topbar .brand-mark').count(),0,'Top AKSARA mark should be absent');
  assert.equal(await page.locator('#studioTitle').textContent(),'STUDIO ANTARA');
  assert.equal(await page.locator('#resultTitle').textContent(),'RUANG VISUAL');
  assert.equal(await page.locator('#resultTitle span').textContent(),'VISUAL');
  assert.equal(await page.locator('.topbar .home-link').textContent(),'LAMAN UTAMA');
  const headlineGold=await page.locator('#resultTitle span').evaluate(el=>getComputedStyle(el).color);
  const studioGold=await page.locator('#studioTitle span').evaluate(el=>getComputedStyle(el).color);
  assert.equal(headlineGold,studioGold,'VISUAL must use exactly the same gold as ANTARA');
  const breath=await page.evaluate(()=>{
   const style=(selector)=>getComputedStyle(document.querySelector(selector),'::before');
   const motion=['#enhancePrompt','#generateImage','#resultIndicator'].map(selector=>({
    selector,animation:style(selector).animationName,opacity:style(selector).opacity
   }));
   const indicator=document.querySelector('#resultIndicator');
   return {motion,waiting:indicator.classList.contains('is-waiting'),label:indicator.textContent};
  });
  assert.equal(breath.waiting,true);assert.equal(breath.label,'MENUNGGU');
  for(const item of breath.motion)assert.match(item.animation,/studioGlassBreath/,'Missing glass breathing on '+item.selector);
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const selector of ['#enhancePrompt','#generateImage','#resultIndicator']){
   assert.equal(await page.locator(selector).evaluate(el=>getComputedStyle(el,'::before').animationName),'none','Reduced motion must disable breathing: '+selector);
  }
  await page.emulateMedia({reducedMotion:'no-preference'});
  assert.equal(await page.locator('.creator > .card-top #studioTitle').count(),1,'Title is within creator glass');
  assert.equal(await page.locator('#imagePrompt').getAttribute('placeholder'),'Apa yang kau nak lihat?');
  assert.equal(await page.locator('#modelNote').count(),0,'Redundant model prose must be absent');
  assert.equal(await page.locator('#generationStatus').isHidden(),true,'Idle status should not occupy vertical space');
  assert.equal(await page.locator('#imageMetadata').isHidden(),true,'Metadata only appears with real results');
  assert.equal(await page.locator('#resultEmpty .visual-symbol').count(),0,'Empty visual should have no decorative star');
  assert.equal(await page.locator('#enhancePrompt').textContent(),'Perkemas A.I');
  assert.equal(await page.locator('#generateImage').textContent(),'Jana imej');
  const navLayout=await page.locator('.topbar').evaluate(el=>{
   const bar=el.getBoundingClientRect(),items=[...el.children].map(child=>child.getBoundingClientRect());
   return {within:items.every(r=>r.left>=bar.left-1&&r.right<=bar.right+1),allPills:[...el.children].every(child=>getComputedStyle(child).borderRadius!=='0px')};
  });
  assert.equal(navLayout.within,true,'Header glass buttons must fit mobile');
  assert.equal(navLayout.allPills,true,'Header links and brand need consistent glass pills');
  const galleryLayout=await page.locator('#historyPanel > summary').evaluate(el=>{
   const title=el.querySelector('.gallery-title'),meta=el.querySelector('.gallery-meta'),badge=el.querySelector('#historyCount'),arrow=el.querySelector('.gallery-chevron');
   const a=title.getBoundingClientRect(),b=meta.getBoundingClientRect(),c=badge.getBoundingClientRect(),d=arrow.getBoundingClientRect();
   return {grouped:!!(title&&meta&&badge&&arrow),ordered:a.right<b.left&&c.right<d.left,
     badgeRadius:getComputedStyle(badge).borderRadius,oldArrow:getComputedStyle(el,'::after').content,
     titleFont:getComputedStyle(title).fontFamily};
  });
  assert.equal(galleryLayout.grouped,true);
  assert.equal(galleryLayout.ordered,true,'Gallery title and compact count/chevron must not overlap');
  assert.match(galleryLayout.badgeRadius,/999px/);
  assert.equal(galleryLayout.oldArrow,'none','Old duplicate gallery arrow must be hidden');
  const chevrons=await page.evaluate(()=>{
    const field=document.querySelector('#imageRatio + .studio-picker-trigger');
    const arrow=document.querySelector('.gallery-chevron');
    const pickerShape=getComputedStyle(field,'::after'),galleryShape=getComputedStyle(arrow,'::before');
    const box=field.getBoundingClientRect(),gbox=arrow.getBoundingClientRect();
    return {pickerContent:pickerShape.content,galleryContent:galleryShape.content,
      pickerBottom:pickerShape.borderBottomStyle,galleryBottom:galleryShape.borderBottomStyle,
      pickerAlign:getComputedStyle(field).alignItems,
      galleryAlign:getComputedStyle(arrow).alignItems,
      galleryCenter:(gbox.top+gbox.bottom)/2,
      badgeCenter:(document.querySelector('#historyCount').getBoundingClientRect().top+document.querySelector('#historyCount').getBoundingClientRect().bottom)/2,
      fieldHeight:box.height};
  });
  assert.equal(chevrons.pickerBottom,'solid');
  assert.equal(chevrons.galleryBottom,'solid');
  assert.equal(chevrons.pickerAlign,'center');
  assert.equal(chevrons.galleryAlign,'center');
  assert.ok(Math.abs(chevrons.galleryCenter-chevrons.badgeCenter)<=2,'Gallery chevron must be vertically centered with result count');
  assert.match(galleryLayout.titleFont,/DM Sans/);
  assert.equal(visual.promptWeight,'600','Enhance pill must use the refined typography');
  await auditPickers(page,calls);
  await page.locator('#imagePrompt').fill('enhance503 subjek asal');await page.locator('#enhancePrompt').click();await page.locator('#enhancePanel').waitFor({state:'visible'});
  assert.match(await page.locator('#enhancedPrompt').inputValue(),/enhance503 subjek asal/);const lightCalls=calls.length;
  await page.locator('#lightEnhance').click();assert.equal(calls.length,lightCalls,'Light enhancement stays local');
  await page.locator('#cancelEnhanced').click();assert.equal(await page.locator('#imagePrompt').inputValue(),'enhance503 subjek asal');
  const prompt='Sebuah rumah api di tepi lautan';await page.locator('#imagePrompt').fill(prompt);await page.locator('#enhancePrompt').click();await page.locator('#enhancePanel').waitFor({state:'visible'});assert.equal(await page.locator('#imagePrompt').inputValue(),prompt);
  await page.locator('#enhancedPrompt').fill(prompt+' dengan cahaya senja');await page.locator('#useEnhanced').click();assert.ok((await page.locator('#imagePrompt').inputValue()).includes('senja'));await page.locator('#restorePrompt').click();assert.equal(await page.locator('#imagePrompt').inputValue(),prompt);
  await pick(page,'imageRatio','9:16');assert.equal(await page.locator('#imageModel').inputValue(),'klein');assert.equal(await page.locator('#imageModel + button span').textContent(),C.models.klein.name,'Automatic model switch updates the visible caption');await pick(page,'imageQuality','fast');await pick(page,'imageStyle','falsafah');
  await page.locator('#generateImage').click();await page.waitForFunction(()=>!document.querySelector('#generateImage').disabled);await page.locator('#generatedImage').waitFor({state:'visible'});
  assert.equal(await page.locator('#resultIndicator').textContent(),'SIAP');
  assert.equal(await page.locator('#resultIndicator').evaluate(el=>el.classList.contains('is-waiting')),false,'Breathing must stop after generation');
  const first=calls.at(-1);assert.equal(first.ratio,'9:16');assert.equal(first.style,'falsafah');assert.match(await page.locator('#imageMetadata').textContent(),/288 × 512/);
  await page.locator('#variationImage').click();await page.waitForFunction(()=>!document.querySelector('#generateImage').disabled);const variation=calls.at(-1);assert.notEqual(variation.seed,42);assert.equal(variation.prompt,prompt);assert.equal(variation.style,'falsafah');
  await page.locator('#regenerateImage').click();await page.waitForFunction(()=>!document.querySelector('#generateImage').disabled);assert.equal(calls.at(-1).seed,variation.seed);
  const downloadEvent=page.waitForEvent('download');await page.locator('#downloadImage').click();const downloaded=await downloadEvent;assert.ok(fs.statSync(await downloaded.path()).size>100);
  await page.locator('#historyPanel > summary').click();await page.waitForFunction(()=>document.querySelectorAll('.history-card').length===3);await page.reload();await page.locator('#historyPanel > summary').click();await page.waitForFunction(()=>document.querySelectorAll('.history-card').length===3);const before=calls.length;await page.locator('.history-card .view-result').first().click();await page.locator('#generatedImage').waitFor({state:'visible'});assert.equal(calls.length,before,'Opening history never runs inference');
  await page.locator('.history-card [data-action="delete"]').first().click();await page.waitForFunction(()=>document.querySelectorAll('.history-card').length===2);
  await page.locator('#imagePrompt').fill('fail429 quota');await page.locator('#generateImage').click();await page.waitForFunction(()=>!document.querySelector('#generateImage').disabled);assert.match(await page.locator('#generationStatus').textContent(),/Had ujian/);assert.equal(await page.locator('#imagePrompt').inputValue(),'fail429 quota');
  await page.locator('#imagePrompt').fill('slow test cancellation');await page.locator('#generateImage').click();await page.locator('#stopImage').click();await page.waitForFunction(()=>!document.querySelector('#generateImage').disabled);assert.match(await page.locator('#generationStatus').textContent(),/dihentikan/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow');
  await page.locator('#resultTitle').scrollIntoViewIfNeeded();await page.screenshot({path:'studio-audit-artifacts/'+label+'.png',fullPage:true});
  page.once('dialog',d=>d.accept());await page.locator('#clearHistory').click();await page.waitForFunction(()=>document.querySelector('#historyCount').textContent==='0 hasil');
  for(const model of ['schnell','ovh']){await pick(page,'imageModel',model);await page.locator('#imagePrompt').fill('Ujian mock '+model);await page.locator('#generateImage').click();await page.waitForFunction(()=>!document.querySelector('#generateImage').disabled);assert.equal(calls.at(-1).model,model);assert.match(await page.locator('#imageMetadata').textContent(),/1024 × 1024/);}
  await page.locator('#imagePrompt').fill('limit429 countdown');
  await page.locator('#generateImage').click();
  await page.locator('#cooldownStatus').waitFor({state:'visible'});
  assert.match(await page.locator('#cooldownStatus').textContent(),/Had Studio dicapai.*01:1[0-5]/);
  assert.equal(await page.locator('#generateImage').isDisabled(),true);
  const callsBeforeRefresh=calls.length;
  await page.reload();
  assert.equal(calls.length,callsBeforeRefresh,'Reload must not trigger an AI call');
  await page.locator('#cooldownStatus').waitFor({state:'visible'});
  assert.equal(await page.locator('#generateImage').isDisabled(),true,'Studio countdown persists across reload');
  await page.evaluate(()=>localStorage.setItem('studio-antara-cooldown-v1:studio',String(Date.now()-1000)));
  await page.reload();
  assert.equal(await page.locator('#generateImage').isEnabled(),true,'Expired countdown clears on refresh');
  await pick(page,'imageModel','ovh');
  await page.locator('#imagePrompt').fill('ovh429 countdown');
  await page.locator('#generateImage').click();
  await page.locator('#cooldownStatus').waitFor({state:'visible'});
  assert.match(await page.locator('#cooldownStatus').textContent(),/OVHcloud Beta terhad/);
  assert.equal(await page.locator('#generateImage').isDisabled(),true);
  await pick(page,'imageModel','klein');
  assert.equal(await page.locator('#generateImage').isEnabled(),true,'Cloudflare models stay available after OVH 429');
  assert.equal(await page.locator('#cooldownStatus').isHidden(),true);
  await pick(page,'imageModel','ovh');
  assert.equal(await page.locator('#generateImage').isDisabled(),true,'OVH-only cooldown resumes when reselected');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({target:BASE,label,width,noAutomaticAI:true,darkPickers:true,allPresets:true,allModels:true,keyboard:true,touch:width<=680,promptEnhancement:true,regenerate:true,variation:true,history:true,download:true,cancel:true,cooldown:true,errors}));await context.close();
 }}finally{await browser.close();server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
