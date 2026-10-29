/* Aksara Living Glass Frame: a tiny collision observer, not a decorative timer.
 * Bursts appear only where the actual moving gold and blue-dark beams meet.
 * Existing background particles, voice renderer and AI routing are untouched. */
(function(root){
 "use strict";

 function center(rect){
  return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
 }
 function contact(gold,dark,threshold){
  if(!gold||!dark||!Number.isFinite(threshold)||threshold<=0)return null;
  const a=center(gold),b=center(dark),dx=a.x-b.x,dy=a.y-b.y;
  const distanceSquared=dx*dx+dy*dy;
  if(distanceSquared>threshold*threshold)return null;
  return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.sqrt(distanceSquared)};
 }
 function rangeFor(widthA,widthB){
  return Math.min(68,Math.max(28,(widthA+widthB)*.26));
 }
 if(typeof module==="object"&&module.exports){
  module.exports={contact,rangeFor};
 }
 if(!root||!root.document)return;

 const doc=root.document;
 function install(){
  const frame=doc.querySelector(".conversation>.glass-frame-orbit");
  const gold=frame?.querySelector(".frame-orbit__beam--light");
  const dark=frame?.querySelector(".frame-orbit__beam--shadow");
  const impact=frame?.querySelector(".frame-orbit__impact");
  if(!frame||!gold||!dark||!impact||!root.requestAnimationFrame)return;
  // Static glints are the fallback for browsers without CSS motion-path support.
  if(!root.CSS?.supports?.("offset-path","inset(2px round 22px)"))return;

  const prefersLess=root.matchMedia?.("(prefers-reduced-motion: reduce)");
  let visible=true,raf=0,active=false,lastSample=-Infinity,lastBurst=-Infinity;
  let near=false,threshold=36,clearTimer=0,destroyed=false;

  function measure(){
   threshold=rangeFor(gold.offsetWidth,dark.offsetWidth);
   near=false;
  }
  function burst(point){
   const bounds=frame.getBoundingClientRect();
   const x=Math.max(5,Math.min(bounds.width-5,point.x-bounds.left));
   const y=Math.max(5,Math.min(bounds.height-5,point.y-bounds.top));
   impact.style.setProperty("--impact-x",Math.round(x*10)/10+"px");
   impact.style.setProperty("--impact-y",Math.round(y*10)/10+"px");
   impact.classList.add("is-active");
   if(clearTimer)root.clearTimeout(clearTimer);
   clearTimer=root.setTimeout(()=>{
    impact.classList.remove("is-active");
    clearTimer=0;
   },710);
  }
  function canRun(){
   return !destroyed&&visible&&doc.visibilityState!=="hidden"&&!prefersLess?.matches;
  }
  function frameTick(now){
   raf=0;
   if(!canRun()){active=false;return;}
   // 12.5 samples/second. The orbit remains CSS-driven at full native FPS.
   if(now-lastSample>=80){
    lastSample=now;
    const a=gold.getBoundingClientRect(),b=dark.getBoundingClientRect();
    const hit=contact(a,b,threshold);
    if(hit){
     if(!near&&now-lastBurst>950){
      burst(hit);
      lastBurst=now;
     }
     near=true;
    }else{
     const dx=(a.left+a.width/2)-(b.left+b.width/2);
     const dy=(a.top+a.height/2)-(b.top+b.height/2);
     if(dx*dx+dy*dy>(threshold*1.5)**2)near=false;
    }
   }
   raf=root.requestAnimationFrame(frameTick);
  }
  function sync(){
   if(!canRun()){
    if(raf){root.cancelAnimationFrame(raf);raf=0;}
    active=false;near=false;
    return;
   }
   if(!active){
    active=true;
    lastSample=-Infinity;
    raf=root.requestAnimationFrame(frameTick);
   }
  }
  const resizeObserver=typeof root.ResizeObserver==="function"
   ?new root.ResizeObserver(measure):null;
  resizeObserver?.observe(frame);
  measure();
  const observer=typeof root.IntersectionObserver==="function"
   ?new root.IntersectionObserver(entries=>{
     visible=entries.some(entry=>entry.isIntersecting);
     sync();
    },{threshold:0}):null;
  observer?.observe(frame);
  const onVisibility=()=>sync();
  const onResize=()=>{measure();sync();};
  const onPageShow=()=>sync();
  const onPageHide=()=>{
   if(raf){root.cancelAnimationFrame(raf);raf=0;}
   active=false;near=false;
  };
  doc.addEventListener("visibilitychange",onVisibility);
  root.addEventListener("resize",onResize,{passive:true});
  root.addEventListener("pageshow",onPageShow);
  root.addEventListener("pagehide",onPageHide);
  prefersLess?.addEventListener?.("change",sync);
  sync();

  // Release references if the document is replaced, e.g. on full navigation.
  root.addEventListener("pagehide",()=>{
   if(clearTimer){root.clearTimeout(clearTimer);clearTimer=0;}
   impact.classList.remove("is-active");
  });
 }
 if(doc.readyState==="loading")doc.addEventListener("DOMContentLoaded",install,{once:true});
 else install();
})(typeof window==="undefined"?null:window);
