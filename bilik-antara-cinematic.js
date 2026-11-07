/* AKSARA Cinematic Living World v1.0
   Static artwork + lightweight CSS atmospheric layers.
   No iframe, no canvas, no video, no timers, no network requests. */
(()=>{
 "use strict";
 const scene=document.querySelector(".world-scene");
 if(!scene)return;
 const voice=document.getElementById("voicePanel");
 const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
 const network=navigator.connection;
 const root=document.documentElement;
 const mode=()=>window.BilikAntaraThought?.getMode?.()==="gelap"?"gelap":"cahaya";
 const sync=()=>{
  root.dataset.cinematicMode=mode();
  const voiceBusy=document.body.classList.contains("voice-focus")||(voice&&!voice.hidden);
  const pause=document.hidden||reduced.matches||!!network?.saveData||voiceBusy||root.dataset.livingPaused==="true";
  scene.dataset.motion=pause?"off":"on";
 };
 const observer=new MutationObserver(sync);
 observer.observe(document.body,{attributes:true,attributeFilter:["class"]});
 observer.observe(root,{attributes:true,attributeFilter:["data-living-paused"]});
 if(voice)observer.observe(voice,{attributes:true,attributeFilter:["hidden","class"]});
 document.addEventListener("visibilitychange",sync);
 window.addEventListener("pageshow",sync);
 window.addEventListener("ba:thought-mode-changed",sync);
 if(reduced.addEventListener)reduced.addEventListener("change",sync);
 else reduced.addListener?.(sync);
 network?.addEventListener?.("change",sync);
 sync();
})();
