/* AKSARA Bilik Antara v0.8: scoped wallpaper enhancement, never touch voice/chat systems. */
(()=>{
 'use strict';
 const scene=document.querySelector('.world-scene');
 if(!scene || document.querySelector('.aksara-living-v08-frame'))return;
 const voice=document.getElementById('voicePanel');
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const network=navigator.connection;
 let frame=null;
 const sync=()=>{
  const busy=document.hidden || reduced.matches || !!network?.saveData ||
   document.body.classList.contains('voice-focus') ||
   (voice && !voice.hidden) ||
   document.documentElement.dataset.livingPaused==='true';
  if(busy){frame?.remove();frame=null;return;}
  if(frame)return;
  frame=document.createElement('iframe');
  frame.className='aksara-living-v08-frame';
  frame.src='bilik-antara-living-v08-bg.html?v=1';
  frame.title='';frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
  frame.loading='lazy';frame.referrerPolicy='same-origin';
  frame.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:none;z-index:0;';
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
 window.addEventListener('pagehide',()=>{frame?.remove();frame=null});
 window.addEventListener('pageshow',sync);
 sync();
})();
