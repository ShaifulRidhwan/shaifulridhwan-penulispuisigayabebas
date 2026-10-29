(function(){
'use strict';
const $=id=>document.getElementById(id),C=window.StudioConfig,H=window.StudioHistory;
const form=$('imageForm');if(!form||!C)return;
const ui={prompt:$('imagePrompt'),count:$('promptCount'),style:$('imageStyle'),ratio:$('imageRatio'),quality:$('imageQuality'),model:$('imageModel'),seed:$('imageSeed'),go:$('generateImage'),stop:$('stopImage'),status:$('generationStatus'),result:$('generatedImage'),empty:$('resultEmpty'),loading:$('stageLoading'),indicator:$('resultIndicator'),meta:$('imageMetadata'),download:$('downloadImage')};
let busy=false,controller=null,current=null,imageUrl=null,galleryRows=[],galleryLimit=6,galleryEpoch=0,thumbUrls=[],originalPrompt=null;
const qualityName=value=>({fast:'Pantas',balanced:'Seimbang',detail:'Detail'}[value]||value);
const text=(el,value)=>{el.textContent=value;};
function announce(message,error=false){text(ui.status,message);ui.status.classList.toggle('is-error',error);}
function count(){text(ui.count,ui.prompt.value.length+' / 1200');}
function selected(){return C.settings({prompt:ui.prompt.value,style:ui.style.value,ratio:ui.ratio.value,quality:ui.quality.value,model:ui.model.value,seed:ui.seed.value===''?null:Number(ui.seed.value)});}
function describe(){
 const klein=ui.model.value==='klein';ui.seed.disabled=busy||!klein;
 if(!klein){ui.ratio.value='1:1';ui.seed.value='';}
 text($('modelNote'),klein?'Klein menjana nisbah ini secara natif. Kualiti menukar resolusi; langkahnya kekal 4. Tiada crop pada hasil.':'Schnell: output segi empat; kualiti menggunakan 2, 4 atau 8 langkah. Nisbah lain dan variasi seed tersedia pada Klein.');
 try{const s=C.settings({prompt:'Contoh visual',style:ui.style.value,ratio:ui.ratio.value,model:ui.model.value,quality:ui.quality.value,seed:null});text($('quotaEstimate'),C.models[s.model].name+' · '+(klein?s.width+' × '+s.height+' px':'saiz sebenar disahkan selepas siap')+' · '+s.steps+' langkah. Rizab bajet konservatif: '+C.estimate(s)+' Neurons / percubaan.');}catch(_){}
}
for(const [id,preset] of Object.entries(C.presets)){const option=document.createElement('option');option.value=id;option.textContent=preset.name;ui.style.append(option);}ui.style.value='antara';
ui.prompt.addEventListener('input',count);
ui.prompt.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();form.requestSubmit();}});
ui.ratio.addEventListener('change',()=>{if(ui.ratio.value!=='1:1'&&ui.model.value==='schnell'){ui.model.value='klein';announce('Nisbah ini menggunakan FLUX.2 Klein. Belum ada permintaan dihantar.');}describe();});
[ui.model,ui.quality,ui.style].forEach(el=>el.addEventListener('change',describe));
document.querySelectorAll('[data-prompt]').forEach(button=>button.addEventListener('click',()=>{if(busy)return;ui.prompt.value=button.dataset.prompt;count();ui.prompt.focus();}));
function setBusy(value,mode='image'){
 busy=value;form.setAttribute('aria-busy',String(value));
 form.querySelectorAll('button,input,textarea,select').forEach(el=>{el.disabled=value;});ui.stop.disabled=false;ui.stop.hidden=!value;
 $('resultActions').querySelectorAll('button').forEach(el=>{el.disabled=value||(el.id==='variationImage'&&current?.settings.model!=='klein');});
 ui.loading.hidden=!(value&&mode==='image');$('resultStage').setAttribute('aria-busy',String(value&&mode==='image'));
 text(ui.go,value?'Sekejap…':'✦ Jana imej ↗');text(ui.indicator,value&&mode==='image'?'MENJANA':current?'SIAP':'MENUNGGU');
 if(!value)describe();
}
ui.stop.addEventListener('click',()=>controller?.abort());
function imageBlob(encoded,mime){
 if(!['image/jpeg','image/png'].includes(mime)||typeof encoded!=='string'||encoded.length>4700000||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw Error('Data imej tak sah.');
 const parts=[];for(let i=0;i<encoded.length;i+=32768){const binary=atob(encoded.slice(i,i+32768)),bytes=new Uint8Array(binary.length);for(let j=0;j<binary.length;j++)bytes[j]=binary.charCodeAt(j);parts.push(bytes);}
 const blob=new Blob(parts,{type:mime});if(blob.size>3500000||blob.size<100)throw Error('Saiz hasil tak disokong.');return blob;
}
async function render(meta,blob,signal){
 const url=URL.createObjectURL(blob),img=new Image();img.src=url;
 try{await img.decode();if(signal?.aborted)throw new DOMException('Henti','AbortError');}catch(e){URL.revokeObjectURL(url);throw e;}
 if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=url;current={...meta,blob};
 ui.result.src=url;ui.result.alt='Imej AI: '+meta.settings.prompt.slice(0,180);ui.result.hidden=false;ui.empty.hidden=true;
 text(ui.meta,meta.modelName+' · '+img.naturalWidth+' × '+img.naturalHeight+' px · '+C.presets[meta.settings.style].name+' · '+(meta.settings.seed===null?'Seed automatik tanpa kawalan':('Seed '+meta.settings.seed))+' · '+(meta.durationMs/1000).toFixed(1)+' saat');
 ui.download.href=url;ui.download.download='studio-antara-'+meta.id+(blob.type==='image/png'?'.png':'.jpg');$('resultActions').hidden=false;$('variationNote').hidden=false;$('usedPromptPanel').hidden=false;
 $('variationImage').disabled=busy||meta.settings.model!=='klein';text($('usedPrompt'),meta.promptUsed+'\n\n'+new Date(meta.createdAt).toLocaleString('ms-MY')+' · '+meta.settings.ratio+' · '+qualityName(meta.settings.quality)+' · '+meta.settings.steps+' langkah');
 text(ui.indicator,'SIAP');
 return img;
}
async function thumbnail(img){const canvas=document.createElement('canvas'),scale=Math.min(1,240/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Thumbnail tak dapat disimpan.')),'image/jpeg',.75));}
async function generate(settings){
 if(busy)return;if(!navigator.onLine){announce('Internet terputus. Prompt kau masih ada; cuba bila dah online.',true);return;}
 const startedAt=Date.now(),ctrl=new AbortController();controller=ctrl;const timer=setTimeout(()=>ctrl.abort(),55000);setBusy(true);announce('Cloudflare sedang menjana imej. Setiap percubaan menggunakan kuota.');
 try{
  const res=await fetch('/.netlify/functions/studio-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:settings.prompt,style:settings.style,model:settings.model,quality:settings.quality,ratio:settings.ratio,seed:settings.seed}),signal:ctrl.signal});
  const data=await res.json();if(!res.ok)throw Error(data.error||'Penjanaan gagal. Cuba lagi nanti.');if(!data.ok||!data.settings)throw Error('Respons pelayan tak lengkap.');
  const blob=imageBlob(data.image,data.mime),meta={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),createdAt:Date.now(),settings:data.settings,promptUsed:data.promptUsed,modelName:data.modelName,durationMs:Date.now()-startedAt,cloudMs:data.durationMs};
  const img=await render(meta,blob,ctrl.signal);ui.stop.hidden=true;clearTimeout(timer);if(matchMedia('(max-width:680px)').matches)$('resultTitle').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});let saved=true;
  try{await H.put(meta,blob,await thumbnail(img));}catch(_){saved=false;}
  announce('Imej dah siap dalam '+(meta.durationMs/1000).toFixed(1)+' saat.'+(saved?' Disimpan pada peranti ini.':' Sejarah tak dapat disimpan (storan penuh atau tak tersedia). Simpan imej sekarang.'));
  if($('historyPanel').open)await refreshHistory();
 }catch(error){announce(error.name==='AbortError'?'Permintaan dihentikan atau masa menunggu tamat. Kuota untuk permintaan yang dah dihantar mungkin tetap digunakan.':error.message||'Sambungan gagal. Prompt kau masih ada.',true);}
 finally{clearTimeout(timer);if(controller===ctrl)controller=null;setBusy(false);}
}
form.addEventListener('submit',e=>{e.preventDefault();if(busy)return;try{generate(selected());}catch(error){announce(error.message,true);}});
$('regenerateImage').addEventListener('click',()=>{if(current)generate({...current.settings});});
function differentSeed(seed){let next;do{const array=new Uint32Array(1);crypto.getRandomValues(array);next=array[0]&2147483647;}while(next===seed);return next;}
$('variationImage').addEventListener('click',()=>{if(current?.settings.model==='klein')generate({...current.settings,seed:differentSeed(current.settings.seed)});});
async function copy(value){try{await navigator.clipboard.writeText(value);announce('Prompt dah disalin.');}catch(_){let box=$('copyFallback');if(!box){box=document.createElement('textarea');box.id='copyFallback';box.readOnly=true;box.setAttribute('aria-label','Prompt untuk disalin secara manual');$('resultActions').after(box);}box.hidden=false;box.value=value;box.focus();box.select();announce('Tak dapat salin automatik. Teks dipilih; tekan Salin pada peranti kau.',true);}}
$('copyPrompt').addEventListener('click',()=>{if(current)copy(current.promptUsed);});
// Enhancing is always explicit. Reviewing a draft never consumes an image request.
$('enhanceEnabled').addEventListener('change',()=>{$('enhancePrompt').hidden=!$('enhanceEnabled').checked;if(!$('enhanceEnabled').checked)$('enhancePanel').hidden=true;});
function draft(prompt,note){$('enhancePanel').hidden=false;$('enhancedPrompt').value=prompt;text($('enhanceNote'),note);}
$('lightEnhance').addEventListener('click',()=>draft(C.lightEnhance(ui.prompt.value),'Mod ringan: tambah panduan visual umum sahaja; bukan terjemahan AI.'));
$('cancelEnhanced').addEventListener('click',()=>{$('enhancePanel').hidden=true;});
$('useEnhanced').addEventListener('click',()=>{const value=$('enhancedPrompt').value.trim();if(value.length<4||value.length>1200){announce('Draf mesti 4 hingga 1200 aksara.',true);return;}originalPrompt=ui.prompt.value;ui.prompt.value=value;count();$('enhancePanel').hidden=true;$('restorePrompt').hidden=false;announce('Draf digunakan. Kau masih boleh edit atau pulangkan prompt asal.');});
const restore=document.createElement('button');restore.id='restorePrompt';restore.type='button';restore.textContent='Pulangkan prompt asal';restore.hidden=true;$('enhanceEnabled').closest('.enhance-row').after(restore);
restore.addEventListener('click',()=>{if(originalPrompt!==null){ui.prompt.value=originalPrompt;count();originalPrompt=null;}restore.hidden=true;});
$('enhancePrompt').addEventListener('click',async()=>{
 if(busy)return;const prompt=ui.prompt.value.trim();if(prompt.length<4||prompt.length>850){draft(C.lightEnhance(prompt),'Prompt panjang: guna mod ringan atau edit sendiri. AI menerima hingga 850 aksara.');return;}
 if(!navigator.onLine){draft(C.lightEnhance(prompt),'Tiada internet. Mod ringan digunakan tanpa menghantar prompt.');return;}
 const ctrl=new AbortController();controller=ctrl;setBusy(true,'enhance');announce('Groq sedang perkemas prompt. Imej belum dijana.');const timer=setTimeout(()=>ctrl.abort(),14000);
 try{const res=await fetch('/.netlify/functions/studio-enhance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt}),signal:ctrl.signal});const data=await res.json();if(!res.ok)throw Error(data.error);if(ctrl.signal.aborted)return;draft(data.prompt,data.note);announce('Draf dah tersedia. Semak sebelum guna.');}
 catch(error){if(error.name==='AbortError')announce('Perkemas dihentikan. Prompt asal kekal.');else{draft(C.lightEnhance(prompt),'AI tak tersedia. Mod ringan digunakan; semak dahulu.');announce('Draf mod ringan tersedia.');}}
 finally{clearTimeout(timer);controller=null;setBusy(false);}
});
// Gallery loads at most six thumbnails per page, and full images only on demand.
function clearThumbs(){thumbUrls.forEach(URL.revokeObjectURL);thumbUrls=[];}
async function refreshHistory(){
 const epoch=++galleryEpoch;clearThumbs();$('historyGrid').replaceChildren();text($('historyStatus'),'Sedang baca sejarah pada peranti ini…');
 try{galleryRows=await H.list();if(epoch!==galleryEpoch)return;text($('historyCount'),galleryRows.length+' hasil');text($('historyStatus'),galleryRows.length?'':'Belum ada hasil yang disimpan di sini.');
  for(const row of galleryRows.slice(0,galleryLimit)){
   const saved=await H.getThumb(row.id);if(epoch!==galleryEpoch)return;if(!saved?.thumb)continue;
   const url=URL.createObjectURL(saved.thumb);thumbUrls.push(url);
   const card=document.createElement('article');card.className='history-card';card.dataset.id=row.id;
   const view=document.createElement('button');view.type='button';view.className='view-result';view.dataset.action='view';view.setAttribute('aria-label','Lihat imej: '+row.settings.prompt.slice(0,100));
   const image=document.createElement('img');image.src=url;image.loading='lazy';image.decoding='async';image.alt=row.settings.prompt.slice(0,100);view.append(image);
   const p=document.createElement('p');p.textContent=row.settings.prompt.slice(0,160);
   const small=document.createElement('small');small.textContent=C.presets[row.settings.style].name+' · '+row.settings.ratio+' · '+qualityName(row.settings.quality)+' · '+(row.settings.seed===null?'seed automatik':'seed '+row.settings.seed)+' · '+(row.durationMs/1000).toFixed(1)+'s · '+new Date(row.createdAt).toLocaleString('ms-MY');
   const actions=document.createElement('div');actions.className='inline-actions';for(const [action,label] of [['regen','Jana semula'],['copy','Salin prompt'],['save','Simpan'],['delete','Padam']]){const b=document.createElement('button');b.type='button';b.dataset.action=action;b.textContent=label;actions.append(b);}
   card.append(view,p,small,actions);$('historyGrid').append(card);
  }
  $('moreHistory').hidden=galleryRows.length<=galleryLimit;
 }catch(_){text($('historyStatus'),'Sejarah tak tersedia. Storan mungkin penuh, disekat atau dibuka dalam mod peribadi.');}
}
$('historyPanel').addEventListener('toggle',()=>{if($('historyPanel').open){galleryLimit=6;refreshHistory();}else{galleryEpoch++;clearThumbs();$('historyGrid').replaceChildren();}});
$('refreshHistory').addEventListener('click',refreshHistory);$('moreHistory').addEventListener('click',()=>{galleryLimit+=6;refreshHistory();});
$('clearHistory').addEventListener('click',async()=>{if(!confirm('Padam semua sejarah Studio pada peranti ini? Imej yang dah dimuat turun tak terjejas.'))return;try{await H.clear();await refreshHistory();}catch(_){text($('historyStatus'),'Sejarah tak dapat dipadam. Cuba lagi.');}});
$('historyGrid').addEventListener('click',async event=>{
 const button=event.target.closest('button[data-action]'),card=button?.closest('[data-id]');if(!button||!card)return;const meta=galleryRows.find(r=>r.id===card.dataset.id);if(!meta)return;
 try{
  const action=button.dataset.action;
  if(action==='delete'){await H.remove(meta.id);await refreshHistory();return;}
  if(action==='copy'){await copy(meta.promptUsed);return;}
  if(action==='regen'){if(!busy)generate({...meta.settings});return;}
  if(busy){announce('Tunggu penjanaan selesai dulu.');return;}
  const saved=await H.get(meta.id);if(!saved?.blob)throw Error('Imej tak ditemui dalam storan.');
  if(action==='view'){await render(meta,saved.blob);$('variationImage').disabled=meta.settings.model!=='klein';$('resultTitle').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
  if(action==='save'){const url=URL.createObjectURL(saved.blob),a=document.createElement('a');a.href=url;a.download='studio-antara-'+meta.id+(saved.blob.type==='image/png'?'.png':'.jpg');document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 }catch(error){text($('historyStatus'),error.message||'Tak dapat buka hasil ini.');}
});
window.addEventListener('offline',()=>announce('Internet terputus. Prompt dan hasil semasa masih ada.',true));
window.addEventListener('pagehide',event=>{controller?.abort();if(!event.persisted){if(imageUrl)URL.revokeObjectURL(imageUrl);clearThumbs();}});
// Remove only the superseded image runtime cache; never touch unrelated storage.
function removeOldImageRuntime(){if('caches' in window)caches.delete('web-txt2img-v1').catch(()=>{});if(navigator.serviceWorker?.getRegistrations){const old=new URL('studio-imej-sw.js',location.href).href;navigator.serviceWorker.getRegistrations().then(rows=>rows.forEach(r=>{if([r.active?.scriptURL,r.waiting?.scriptURL,r.installing?.scriptURL].includes(old))r.unregister().catch(()=>{});})).catch(()=>{});}}
if('requestIdleCallback' in window)requestIdleCallback(removeOldImageRuntime,{timeout:7000});else setTimeout(removeOldImageRuntime,2000);
count();describe();
})();
