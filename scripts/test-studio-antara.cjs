'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../studio-antara-config');
const D=require('../studio-antara-cooldown');
const {createHandler}=require('../netlify/functions/lib/studio-image-handler');
const {createHandler:enhancer}=require('../netlify/functions/lib/studio-enhance-handler');
const {reserve}=require('../netlify/functions/lib/studio-quota');
const {imageInfo}=require('../netlify/functions/lib/studio-http');
const env={CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_API_TOKEN:'test-private-token'};
function event(changes={},ip='198.51.100.8'){return {httpMethod:'POST',headers:{origin:'https://example.netlify.app',host:'example.netlify.app','content-type':'application/json','x-nf-client-connection-ip':ip},body:JSON.stringify({prompt:'Wanita berdiri dalam cahaya.',style:'antara',model:'schnell',ratio:'1:1',quality:'balanced',seed:null,...changes})};}
function png(w=1024,h=1024){const b=Buffer.alloc(200);Buffer.from([137,80,78,71,13,10,26,10]).copy(b);b.writeUInt32BE(w,16);b.writeUInt32BE(h,20);return b;}
const upstream=(bytes=png())=>new Response(JSON.stringify({success:true,result:{image:bytes.toString('base64')}}),{headers:{'content-type':'application/json'}});
const quota=async()=>async()=>{};
test('Studio is cloud-only, image-only and all client JS parses',()=>{
 const html=fs.readFileSync('studio-antara.html','utf8');
 assert.doesNotMatch(html,/id="tabVideo"|WebGPU|SD.Turbo|onnx/i);
 assert.match(html,/id="enhancePrompt"/);assert.doesNotMatch(html,/id="enhanceEnabled"/);
 assert.match(html,/studio-antara-ui\.js\?v=2/);
 for(const name of ['studio-antara-cloud.js','studio-antara-ui.js','studio-antara-config.js','studio-antara-history.js'])new vm.Script(fs.readFileSync(name,'utf8'));
 assert.match(fs.readFileSync('studio-antara-history.js','utf8'),/indexedDB\.open/);
 assert.doesNotMatch(fs.readFileSync('studio-antara-cloud.js','utf8'),/localStorage\.setItem/);
});
test('Studio audit rejects orphaned styles after removing old UI phases',()=>{
 const html=fs.readFileSync('studio-antara.html','utf8');
 const css=fs.readFileSync('studio-antara.css','utf8');
 assert.match(html,/studio-antara\.css\?v=17/);
 for(const old of ['hero','hero-facts','eyebrow','step-label','tiny-star','visual-symbol','enhance-row','model-note','brand-mark','brand-light','brand-muted']){
  const pattern=new RegExp('(^|[^a-zA-Z0-9_-])\\.'+old+'(?![a-zA-Z0-9_-])');
  assert.doesNotMatch(css,pattern,'Old unused selector should not survive: '+old);
 }
 for(const live of ['.studio-picker-dialog','.studio-picker-trigger','.glass-card','#enhancePrompt','#generateImage','studioGlassBreath']){
  assert.ok(css.includes(live),'Active glass selector is missing: '+live);
 }
});
test('Studio 2.4 removes redundant copy and decorative icons without hiding functional notices',()=>{
 const html=fs.readFileSync('studio-antara.html','utf8'),script=fs.readFileSync('studio-antara-cloud.js','utf8');
 assert.match(html,/<section class="glass-card creator" aria-labelledby="studioTitle">/);
 assert.match(html,/<h1 id="studioTitle" class="studio-card-title">STUDIO <span>ANTARA<\/span><\/h1>/);
 assert.match(html,/<h2 id="resultTitle">RUANG <span>VISUAL<\/span><\/h2>/);
 assert.match(html,/<a class="home-link" href="index\.html">LAMAN UTAMA<\/a>/);
 assert.match(html,/<span id="resultIndicator" class="result-indicator is-waiting">MENUNGGU<\/span>/);
 assert.match(html,/studio-antara\.css\?v=17/);
 assert.match(html,/studio-antara-cloud\.js\?v=8/);
 assert.match(script,/ui\.indicator\.classList\.toggle\('is-waiting'/);
 assert.match(script,/ui\.indicator\.classList\.remove\('is-waiting'\)/);
 assert.doesNotMatch(html,/<span class="brand-mark">AKSARA<\/span>/);
 assert.match(html,/<textarea id="imagePrompt"[^>]*placeholder="Apa yang kau nak lihat\?"/);
 assert.match(html,/<p class="generation-status" id="generationStatus"[^>]*hidden><\/p>/);
 assert.match(html,/<p id="imageMetadata" class="image-meta" hidden><\/p>/);
 assert.doesNotMatch(html,/RUANG KREATIF CAHAYA DAN GELAP|Bayangkan\. Perkemas\. Jadikan visual\.|Mula dengan imaginasi\.|01 \/ IDEA KAU|02 \/ HASIL KAU|Dah sedia\. Cerita je apa yang kau bayangkan\.|Idea kau bermula di sini\.|Tanpa model besar pada peranti\.|Schnell: output segi empat/);
 assert.doesNotMatch(html,/✦|↗|←|↓/);
 assert.doesNotMatch(script,/modelNote|✦|↗/);
 assert.match(html,/<header class="topbar">/);
 assert.match(html,/<a class="back-link" href="bilik-antara\.html">BILIK ANTARA<\/a>/);
 assert.match(script,/ui\.status\.hidden=!message/);
 assert.match(script,/ui\.meta\.hidden=false/);
});
test('Every preset affects the actual model prompt',()=>{
 assert.equal(Object.keys(C.presets).length,11);
 for(const style of Object.keys(C.presets)){const s=C.settings({prompt:'Seekor kucing',style});assert.ok(C.compose(s).startsWith('Seekor kucing'));if(style!=='none')assert.ok(C.compose(s).length>s.prompt.length);}
});
test('Ratios are native dimensions; quality maps to supported steps or resolution',()=>{
 for(const ratio of Object.keys(C.ratios))for(const quality of C.qualities){const s=C.settings({prompt:'Sebuah lautan',model:'klein',ratio,quality});const [a,b]=ratio.split(':').map(Number);assert.equal(s.width*b,s.height*a);assert.equal(s.steps,4);}
 assert.deepEqual(C.qualities.map(quality=>C.settings({prompt:'Sebuah lautan',quality}).steps),[2,4,8]);
 assert.throws(()=>C.settings({prompt:'Sebuah lautan',ratio:'9:16'}));
 assert.throws(()=>C.settings({prompt:'Sebuah lautan',seed:42}));
});
test('Schnell sends only prompt and steps; output dimensions come from actual bytes',async()=>{
 let opts;const h=createHandler({env,reserve:quota,fetchImpl:async(u,o)=>{opts=o;assert.match(u,/flux-1-schnell$/);return upstream();}});
 const res=await h(event());assert.equal(res.statusCode,200);const data=JSON.parse(res.body);assert.equal(data.width,1024);assert.equal(data.settings.seed,null);assert.deepEqual(Object.keys(JSON.parse(opts.body)).sort(),['prompt','steps']);assert.doesNotMatch(res.body,/test-private-token/);
});
test('Klein sends native size and seed as multipart without unsupported steps',async()=>{
 let opts;const h=createHandler({env,reserve:quota,fetchImpl:async(u,o)=>{opts=o;assert.match(u,/flux-2-klein-4b$/);return upstream(png(576,1024));}});
 const res=await h(event({model:'klein',ratio:'9:16',quality:'detail',seed:42}));assert.equal(res.statusCode,200);assert.equal(opts.body.get('seed'),'42');assert.equal(opts.body.get('width'),'576');assert.equal(opts.body.get('steps'),null);assert.equal(JSON.parse(res.body).settings.seed,42);
});
test('No resize/crop hides a wrong native ratio',async()=>{
 const h=createHandler({env,reserve:quota,fetchImpl:async()=>upstream()});const res=await h(event({model:'klein',ratio:'9:16'}));assert.equal(res.statusCode,502);assert.match(JSON.parse(res.body).error,/saiz berbeza/);
});
test('Validation rejects forged origin, missing origin, unknown parameters and invalid settings before quota',async()=>{
 let calls=0;const h=createHandler({env,reserve:async()=>{calls++;},fetchImpl:async()=>upstream()});
 for(const data of [{prompt:'x'},{seed:-1},{seed:'42'},{model:'paid'},{ratio:'2:1'},{quality:'ultra'},{style:'unknown'},{width:2048}])assert.equal((await h(event(data))).statusCode,400);
 for(const origin of [undefined,'https://evil.test']){const e=event();e.headers.origin=origin;assert.equal((await h(e)).statusCode,403);}
 const large=event();large.body='x'.repeat(8000);assert.equal((await h(large)).statusCode,413);assert.equal(calls,0);
});
test('Cloudflare errors never leak response bodies or credentials; reservations are released',async()=>{
 for(const status of [401,403,429,500]){let released=0;const h=createHandler({env,reserve:async()=>async()=>released++,fetchImpl:async()=>new Response('SECRET',{status})});const res=await h(event());assert.equal(res.statusCode,status===429?429:502);assert.doesNotMatch(res.body,/SECRET|test-private-token/);assert.equal(released,1);}
});
test('Upstream timeout aborts and releases concurrency',async()=>{
 let released=0;const h=createHandler({env,timeout:10,reserve:async()=>async()=>released++,fetchImpl:async(u,o)=>new Promise((resolve,reject)=>o.signal.addEventListener('abort',()=>reject(new DOMException('timeout','AbortError'))))});assert.equal((await h(event())).statusCode,504);assert.equal(released,1);
});
test('Oversized streams and malformed images are rejected',async()=>{
 assert.throws(()=>imageInfo(Buffer.alloc(200)));
 const h=createHandler({env,reserve:quota,fetchImpl:async()=>new Response('x',{headers:{'content-length':'9000000'}})});assert.equal((await h(event())).statusCode,502);
});
function store(){let entries=new Map(),version=0;return {async getWithMetadata(key){const x=entries.get(key);return x?structuredClone(x):null;},async setJSON(key,data,options){const old=entries.get(key);if(options.onlyIfNew&&old||options.onlyIfMatch&&old?.etag!==options.onlyIfMatch)return {modified:false};const etag=String(++version);entries.set(key,{data:structuredClone(data),etag});return {modified:true,etag};},entries};}
test('Cross-instance CAS prevents exceeding concurrency and daily reserved budget',async()=>{
 const db=store(),now=Date.now();const results=await Promise.allSettled(Array.from({length:4},(_,i)=>reserve(event({},'ip'+i),2100,'image',{store:db,now})));
 const success=results.filter(x=>x.status==='fulfilled');assert.equal(success.length,2);await Promise.all(success.map(x=>x.value()));
 const state=[...db.entries.values()][0].data;assert.equal(state.units,4200);assert.equal(Object.keys(state.leases).length,0);
 await assert.rejects(reserve(event({},'new-ip'),2100,'image',{store:db,now}),{status:429});
 assert.ok(!JSON.stringify(state).includes('Wanita'));assert.ok(!JSON.stringify(state).includes('198.51.100'));
});
test('Expired leases recover; per-IP rate survives separate function instances',async()=>{
 const db=store(),now=Date.now();for(let i=0;i<8;i++){const release=await reserve(event(),1,'image',{store:db,now});await release();}
 await assert.rejects(reserve(event(),1,'image',{store:db,now}),{status:429});
 const release=await reserve(event(),1,'image',{store:db,now:now+610000});await release();
});
test('Quota storage failure is fail-closed before any image inference',async()=>{
 const db={getWithMetadata(){throw Error('offline');}};await assert.rejects(reserve(event(),10,'image',{store:db}),{status:503});
});
test('Prompt enhancement fallback preserves the original, long prompts are never truncated',async()=>{
 const e=event();e.body=JSON.stringify({prompt:'Wanita berdiri dalam cahaya.'});const r=await enhancer({env:{},reserve:quota})(e);assert.equal(r.statusCode,200);const d=JSON.parse(r.body);assert.equal(d.method,'light');assert.ok(d.prompt.startsWith('Wanita berdiri dalam cahaya.'));
 const long='a'.repeat(1199);assert.equal(C.lightEnhance(long),long);
});
test('Explicit prompt AI uses an isolated free Groq call and validates editable output',async()=>{
 let called=0;const h=enhancer({env:{GROQ_API_KEY:'fake',GROQ_FREE_CONFIRMED:'true'},reserve:quota,fetchImpl:async(u,o)=>{called++;assert.match(u,/groq/);return Response.json({choices:[{message:{content:JSON.stringify({prompt:'A woman standing in golden light, clear composition.'})}}]});}});
 const e=event();e.body=JSON.stringify({prompt:'Wanita berdiri dalam cahaya.'});const r=await h(e);assert.equal(called,1);assert.equal(JSON.parse(r.body).method,'ai');
});
test('Modern request adapter bounds request body and uses trusted Netlify context IP',async()=>{
 const adapt=require('../netlify/functions/lib/studio-request');let seen;
 const req=new Request('https://example.netlify.app/.netlify/functions/studio-image',{method:'POST',headers:{Origin:'https://example.netlify.app','Content-Type':'application/json'},body:'{}'});
 const res=await adapt(req,{ip:'trusted-ip'},async event=>{seen=event;return {statusCode:200,headers:{'content-type':'application/json'},body:'{"ok":true}'};});assert.equal(res.status,200);assert.equal(seen.headers.host,'example.netlify.app');assert.equal(seen.headers['x-nf-client-connection-ip'],'trusted-ip');
 const big=new Request(req.url,{method:'POST',body:'x'.repeat(8000)});assert.equal((await adapt(big,{},()=>{throw Error('must not invoke')})).status,413);
});

test('OVH Beta stays opt-in, has square output and never spends Cloudflare Neurons',()=>{
 const s=C.settings({prompt:'Malam yang tenang',model:'ovh',ratio:'1:1',quality:'detail'});
 assert.equal(s.width,1024);assert.equal(s.height,1024);assert.equal(s.steps,null);assert.equal(C.estimate(s),0);
 assert.throws(()=>C.settings({prompt:'Malam yang tenang',model:'ovh',ratio:'9:16'}));
 assert.throws(()=>C.settings({prompt:'Malam yang tenang',model:'ovh',seed:1}));
 assert.equal(C.settings({prompt:'Malam yang tenang'}).model,'schnell');
});
test('Manual OVH Beta calls anonymous endpoint, checks image bytes and avoids Cloudflare secrets',async()=>{
 let cost=-1,calls=0;const h=createHandler({env:{},reserve:async(e,n)=>{cost=n;return async()=>{};},fetchImpl:async(url,opts)=>{
  calls++;assert.equal(url,'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/images/generations');
  assert.equal(opts.headers.Authorization,undefined);assert.equal(opts.method,'POST');
  assert.deepEqual(JSON.parse(opts.body),{model:'stable-diffusion-xl-base-v10',prompt:C.compose(C.settings({prompt:'Wanita berdiri dalam cahaya.',style:'antara',model:'ovh'})),size:'1024x1024'});
  return Response.json({data:[{b64_json:png().toString('base64')}]});
 }});
 const out=await h(event({model:'ovh'}));assert.equal(out.statusCode,200);assert.equal(cost,0);assert.equal(calls,1);
 const data=JSON.parse(out.body);assert.equal(data.modelName,'OVHcloud SDXL · Beta');assert.equal(data.estimatedNeurons,0);
 assert.equal(data.width,1024);assert.equal(data.height,1024);assert.doesNotMatch(out.body,/test-private-token/);
});
test('OVH Beta failures do not auto-fallback or leak upstream bodies',async()=>{
 for(const status of [401,403,429,503]){
  let calls=0,released=0;
  const h=createHandler({env:{},reserve:async()=>async()=>released++,fetchImpl:async()=>{calls++;return new Response('HIDDEN_TOKEN',{status});}});
  const out=await h(event({model:'ovh'}));assert.equal(calls,1);assert.equal(released,1);
  assert.equal(out.statusCode,status===429?429:502);assert.doesNotMatch(out.body,/HIDDEN_TOKEN/);
 }
});
test('OVH Beta UI is manual, readable and no old hand particle layer remains',()=>{
 const html=fs.readFileSync('studio-antara.html','utf8'),script=fs.readFileSync('studio-antara-cloud.js','utf8');
 assert.ok(html.includes('<option value="ovh">OVHcloud SDXL · Beta</option>'));
 assert.match(html,/id="modelBetaInfo"/);assert.match(script,/modelBetaInfo/);
 const bilik=fs.readFileSync('bilik-antara.html','utf8'),css=fs.readFileSync('bilik-antara.css','utf8');
 assert.doesNotMatch(bilik,/world-hand-sparks/);assert.doesNotMatch(css,/world-hand-sparks/);
 const hub=bilik.slice(bilik.indexOf('<div class="feature-hub"'),bilik.indexOf('<details class="feature-privacy"'));
 assert.ok(hub.indexOf('id="featureStudio"')<hub.indexOf('id="featureMetrics"'));
 assert.ok(hub.indexOf('id="featureMetrics"')<hub.indexOf('id="featureSessions"'));
 assert.match(hub,/Prestasi A.I/);
});

test('Countdown formats and survives refresh without storing prompts or images',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const now=1761753600000,end=D.save('studio',135,storage,now);
 assert.equal(D.read('studio',storage,now+1000),end);
 assert.equal(D.remaining(end,now),135);assert.equal(D.remaining(end,now+2500),133);
 assert.equal(D.format(135),'02:15');assert.equal(D.format(3661),'1:01:01');
 assert.equal(D.parseRetryAfter('75',now),75);assert.equal(D.parseRetryAfter('Thu, 29 Oct 2026 16:02:00 GMT',now)>0,true);
 assert.equal(D.parseRetryAfter('bad',now),0);
 assert.equal(data.size,1);assert.match([...data.keys()][0],/studio-antara-cooldown-v1:studio/);
 assert.equal(D.read('studio',storage,end+1),0);assert.equal(data.size,0);
 assert.equal(D.save('unrecognized',12,storage,now),0);
});
test('429 responses provide Retry-After with correct provider scope and never expose upstream data',async()=>{
 for(const model of ['ovh','schnell']){
  const h=createHandler({env,reserve:quota,fetchImpl:async()=>new Response('PRIVATE UPSTREAM',{status:429,headers:{'Retry-After':'73'}})});
  const res=await h(event({model}));assert.equal(res.statusCode,429);assert.equal(res.headers['Retry-After'],'73');
  assert.equal(JSON.parse(res.body).scope,model==='ovh'?'ovh':'cloudflare');
  assert.doesNotMatch(res.body,/PRIVATE UPSTREAM/);
 }
 const limited=Object.assign(Error('Had 8 percubaan dalam 10 minit dah dicapai.'),{status:429,retryAfter:428});
 const h=createHandler({env,reserve:async()=>{throw limited;},fetchImpl:async()=>{throw Error('never call AI');}});
 const res=await h(event({model:'ovh'}));assert.equal(res.statusCode,429);assert.equal(res.headers['Retry-After'],'428');
 assert.equal(JSON.parse(res.body).scope,'studio');
});
test('Studio countdown UI is accessible and does not request inference on load',()=>{
 const html=fs.readFileSync('studio-antara.html','utf8');
 assert.match(html,/id="cooldownStatus"[^>]*role="timer"[^>]*aria-live="off"/);
 assert.match(html,/studio-antara-cooldown\.js\?v=1/);
 const script=fs.readFileSync('studio-antara-cloud.js','utf8');
 assert.match(script,/rememberRateLimit/);assert.match(script,/cooldownFor/);
 assert.doesNotMatch(script,/localStorage\.setItem/);
});
