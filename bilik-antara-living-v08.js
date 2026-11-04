/* AKSARA Bilik Antara v0.8.1: keep wallpaper warm only during short Voice pauses. */
(()=>{
 'use strict';
 const scene=document.querySelector('.world-scene');
 if(!scene||document.querySelector('.aksara-living-v08-frame'))return;
 const voice=document.getElementById('voicePanel');
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const network=navigator.connection;
 let frame=null,releaseTimer=null;
 const clearRelease=()=>{
  if(releaseTimer!==null){clearTimeout(releaseTimer);releaseTimer=null;}
 };
 const release=()=>{
  clearRelease();
  if(frame){frame.remove();frame=null;}
 };
 const pauseChild=(active)=>{
  if(!frame)return;
  try{
   frame.contentDocument?.querySelector('.world-scene')?.classList.toggle('living-active',active);
  }catch(_error){/* Same-origin wallpaper unavailable: keep original static fallback. */}
 };
 const sync=()=>{
  const hardStop=document.hidden||reduced.matches||!!network?.saveData;
  const softStop=document.body.classList.contains('voice-focus')||
   (voice&&!voice.hidden)||
   document.documentElement.dataset.livingPaused==='true';
  if(hardStop){pauseChild(false);release();return;}
  if(softStop){
   if(frame){
    pauseChild(false);
    frame.style.display='none';
    if(releaseTimer===null){releaseTimer=setTimeout(release,45000);}
   }
   return;
  }
  clearRelease();
  if(frame){frame.style.display='block';pauseChild(true);return;}
  frame=document.createElement('iframe');
  frame.className='aksara-living-v08-frame';
  frame.src='bilik-antara-living-v08-bg.html?v=1';
  frame.title='';frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
  frame.loading='lazy';frame.referrerPolicy='same-origin';
  frame.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:none;z-index:2;';
  frame.addEventListener('load',sync,{once:true});
  scene.appendChild(frame);
 };
 const observer=new MutationObserver(sync);
 observer.observe(document.body,{attributes:true,attributeFilter:['class']});
 observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-living-paused']});
 if(voice)observer.observe(voice,{attributes:true,attributeFilter:['hidden','class']});
 document.addEventListener('visibilitychange',sync);
 if(reduced.addEventListener)reduced.addEventListener('change',sync);
 else reduced.addListener(sync);
 network?.addEventListener?.('change',sync);
 window.addEventListener('pagehide',release);
 window.addEventListener('pageshow',sync);
 sync();
})();
