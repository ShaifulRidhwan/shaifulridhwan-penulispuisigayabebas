/* AKSARA Bilik Antara video wallpaper; opt out during live Voice Chat. */
(()=>{
 "use strict";
 const video=document.getElementById("aksaraAmbientVideo");
 const scene=document.querySelector(".world-scene");
 const voice=document.getElementById("voicePanel");
 const trigger=document.getElementById("voiceLive");
 if(!video||!scene||!voice||!trigger)return;
 const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
 const connection=navigator.connection;
 let failed=false;
 const voiceActive=()=>!voice.hidden||trigger.getAttribute("aria-pressed")==="true";
 const allowed=()=>!failed&&!document.hidden&&!reduced.matches&&!connection?.saveData&&!voiceActive();
 const still=()=>scene.classList.remove("has-ambient-video");
 const sync=()=>{
  if(!allowed()){video.pause();still();return;}
  if(!video.paused)return;
  const attempt=video.play();
  if(attempt&&typeof attempt.catch==="function")attempt.catch(still);
 };
 video.addEventListener("playing",()=>{
  if(!allowed()){video.pause();still();return;}
  scene.classList.add("has-ambient-video");
 });
 video.addEventListener("pause",still);
 // A temporary buffer stall must keep the current frame visible; switching to WebP creates flashes.
 // Only explicit pause, denied autoplay or a real error returns to the static wallpaper.
 video.addEventListener("error",()=>{failed=true;video.pause();still()});
 trigger.addEventListener("click",()=>{video.pause();still();},{capture:true});
 const observer=new MutationObserver(sync);
 observer.observe(voice,{attributes:true,attributeFilter:["hidden","class"]});
 observer.observe(trigger,{attributes:true,attributeFilter:["aria-pressed"]});
 document.addEventListener("visibilitychange",sync);
 if(typeof reduced.addEventListener==="function")reduced.addEventListener("change",sync);
 else if(typeof reduced.addListener==="function")reduced.addListener(sync);
 connection?.addEventListener?.("change",sync);
 window.addEventListener("pagehide",()=>{video.pause();still();});
 window.addEventListener("pageshow",sync);
 if(document.readyState==="complete")sync();
 else window.addEventListener("load",sync,{once:true});
})();
