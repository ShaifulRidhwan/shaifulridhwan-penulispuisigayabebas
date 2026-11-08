// Deterministic web references. Inference is intercepted ONLY in this test harness.
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path');
const origin=process.env.AKSARA_WEB_ORIGIN||'https://shaifulridhwan-penulispuisigayabebas.netlify.app';
const out=path.resolve(__dirname,'../../docs/android-rebuild/visual-comparison/web');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||undefined,args:['--no-sandbox']});
 fs.mkdirSync(out,{recursive:true});
 for(const width of (process.env.WIDTHS||'360,390,393,412').split(',').map(Number)){
  const height={360:800,390:844,393:852,412:915}[width]||844;
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce',locale:'ms-MY',timezoneId:'Asia/Kuala_Lumpur'});
  await context.addInitScript(()=>{Date.now=()=>1794117600000;});
  const page=await context.newPage();let streaming=false;
  await page.route('**/.netlify/functions/bilik-antara*',async route=>{
   const url=route.request().url(),body=route.request().postDataJSON()||{};
   if(body.providerStatus){await route.fulfill({json:{providers:{},providerStatus:{},ok:true}});return;}
   if(url.includes('live-token')){await route.fulfill({status:503,json:{error:'Visual test: voice backend disabled.'}});return;}
   const reply='Relativiti menghubungkan ruang dan masa. Cahaya bergerak pada kelajuan yang sama bagi semua pemerhati inersia.';
   if(url.includes('stream')){if(streaming)await sleep(5000);await route.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({type:'delta',text:reply})+'\n'+JSON.stringify({type:'done',reply,provider:'fixture',model:'visual-fixture',sources:[]})+'\n'});}
   else await route.fulfill({json:{reply,provider:'fixture',model:'visual-fixture',sources:[]}});
  });
  await page.goto(origin+'/bilik-antara.html',{waitUntil:'networkidle',timeout:90000});
  await page.evaluate(()=>document.fonts.ready); await sleep(1000);
  async function capture(name){
   await page.screenshot({path:path.join(out,`${width}-${name}.png`)});
   const data=await page.evaluate(()=>({url:location.href,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},fonts:[...document.fonts].map(x=>({family:x.family,weight:x.weight,status:x.status})),sheets:[...document.styleSheets].map(x=>x.href||'inline'),elements:[...document.querySelectorAll('body *')].filter(x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';}).map(x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x);return {tag:x.tagName,id:x.id,cls:x.className?.baseVal??x.className,text:x.children.length?'':x.textContent?.trim().slice(0,160),rect:{x:r.x,y:r.y,width:r.width,height:r.height},styles:Object.fromEntries(['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','color','background','backgroundImage','backgroundPosition','backgroundSize','border','borderRadius','padding','gap','backdropFilter','filter','boxShadow','opacity','display','flexDirection','alignItems','animation','transition'].map(k=>[k,s[k]]))};})}));
   fs.writeFileSync(path.join(out,`${width}-${name}.json`),JSON.stringify(data,null,2));
  }
  await capture('welcome');
  // Open each overlay with its real click handler; close via Escape.
  const controls=[['connection','#connection'],['code','#codeEngineStatus'],['terminal','#codeAITerminalOpen'],['portal','.portal-trigger'],['thinking','#thoughtMode'],['attachments','#attachmentTrigger'],['voice-permission','#voiceLive']];
  for(const [name,selector] of controls){
   const el=page.locator(selector);if(!(await el.count())){fs.appendFileSync(path.join(out,'missing-controls.txt'),`${width} ${name} ${selector}\n`);continue;}
   try{await el.click({timeout:5000});await sleep(300);await capture(name);await page.keyboard.press('Escape');await sleep(250);if(name==='portal'){await page.locator('#portalClose').click().catch(()=>{});}}
   catch(e){fs.appendFileSync(path.join(out,'capture-errors.txt'),`${width} ${name}: ${e.message}\n`);}
  }
  await page.keyboard.press('Escape');
  await page.locator('#input').fill('Terangkan relativiti.');await capture('composer-focused');
  streaming=true;await page.locator('#sendBtn').click();await sleep(300);await capture('streaming');
  await sleep(5500);await capture('chat');
  fs.writeFileSync(path.join(out,`${width}-inventory.json`),JSON.stringify(await page.evaluate(()=>({dialogs:[...document.querySelectorAll('dialog,[role=dialog]')].map(x=>({id:x.id,cls:x.className,text:x.textContent?.trim()})),buttons:[...document.querySelectorAll('button,summary')].map(x=>({id:x.id,cls:x.className,label:x.getAttribute('aria-label'),text:x.textContent?.trim()})),breakpoints:[...document.styleSheets].flatMap(s=>{try{return [...s.cssRules].filter(x=>x.conditionText).map(x=>x.conditionText)}catch{return []}})})),null,2));
  // Additional reachable application states. They remain unaccepted until native equivalents exist.
  for(const [name,trigger] of [['sessions','#featureSessions'],['metrics','#featureMetrics'],['knowledge','#featureKnowledge']]){
   try{await page.locator('.portal-trigger').click();await page.locator(trigger).click();await sleep(300);await capture(name);await page.keyboard.press('Escape');}catch(e){fs.appendFileSync(path.join(out,'capture-errors.txt'),`${width} ${name}: ${e.message}\n`);}
  }
  await page.goto(origin+'/bilik-antara.html?voice-preview=1',{waitUntil:'networkidle',timeout:90000});
  await page.locator('#voiceLive').click();await sleep(1000);await capture('voice');
  fs.writeFileSync(path.join(out,`${width}-voice-dom.txt`),await page.locator('#voicePanel').innerText());
  for(const [name,pathname] of [['studio','studio-antara.html'],['library','perpustakaan-aksara.html'],['security','security-lab.html']]){
   try{const response=await page.goto(origin+'/'+pathname,{waitUntil:'networkidle',timeout:45000});if(!response.ok())throw Error('HTTP '+response.status());await sleep(500);await capture(name);fs.writeFileSync(path.join(out,`${width}-${name}-http.txt`),String(response.status()));}catch(e){fs.writeFileSync(path.join(out,`${width}-${name}-blocked.json`),JSON.stringify({screen:name,status:'BLOCKED_WEB_REFERENCE',error:e.message}));}
  }
  await context.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
