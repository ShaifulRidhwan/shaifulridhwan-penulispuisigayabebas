/* Bilik Antara performance diagnostics. Opt-in only via ?perf=1.
   Uses local browser measurements; no telemetry is transmitted. */
(()=>{
 "use strict";
 if(document.getElementById("ba-perf-hud"))return;
 const hud=document.createElement("aside");
 hud.id="ba-perf-hud";
 hud.setAttribute("aria-label","Diagnostik kelancaran Bilik Antara");
 hud.style.cssText="position:fixed;left:10px;bottom:10px;z-index:2147483600;width:min(288px,calc(100vw - 20px));padding:10px 12px;border-radius:14px;border:1px solid rgba(246,220,173,.35);background:rgba(7,12,20,.88);color:#f4e7cc;font:12px/1.5 system-ui,sans-serif;box-shadow:0 8px 35px rgba(0,0,0,.45);pointer-events:auto;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)";
 const heading=document.createElement("div");heading.textContent="Prestasi Bilik Antara";
 heading.style.cssText="font-weight:700;letter-spacing:.03em;margin-bottom:6px";
 const output=document.createElement("pre");output.style.cssText="white-space:pre-wrap;word-break:break-word;font:11px/1.55 ui-monospace,monospace;margin:0 0 7px";
 output.textContent="Mengukur frame dan pemuatan…";
 const foot=document.createElement("small");foot.textContent="FPS anggaran daripada requestAnimationFrame, bukan ujian GPU/Lighthouse.";
 foot.style.cssText="display:block;color:#c1b6a3;font-size:10px;line-height:1.4";
 const actions=document.createElement("div");actions.style.cssText="display:flex;gap:6px;margin-top:8px";
 const copy=document.createElement("button");copy.type="button";copy.textContent="Salin bacaan";
 const close=document.createElement("button");close.type="button";close.textContent="Tutup";
 for(const button of [copy,close])button.style.cssText="border:1px solid rgba(240,217,180,.35);border-radius:8px;padding:5px 9px;background:rgba(255,240,210,.08);color:#fff0d2;font:inherit;cursor:pointer";
 actions.append(copy,close);hud.append(heading,output,foot,actions);document.body.append(hud);
 let running=true,raf=0,interval=0,previous=0,lcp=0,cls=0,longTasks=0,longTaskMs=0,longestEvent=0;
 const samples=[],observers=[],maxAge=6000;
 const observe=(type,handler,extra={})=>{
  try{
   const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())handler(entry);});
   observer.observe({type,buffered:true,...extra});observers.push(observer);
  }catch(_){}
 };
 observe("largest-contentful-paint",entry=>{lcp=entry.renderTime||entry.loadTime||entry.startTime;});
 observe("longtask",entry=>{longTasks++;longTaskMs+=entry.duration;});
 observe("layout-shift",entry=>{if(!entry.hadRecentInput)cls+=entry.value;});
 observe("event",entry=>{longestEvent=Math.max(longestEvent,entry.duration||0);},{durationThreshold:16});
 function frame(now){
  if(!running)return;
  if(!document.hidden&&previous&&now-previous<500){
   samples.push({time:now,gap:now-previous});
   while(samples.length&&samples[0].time<now-maxAge)samples.shift();
  }
  previous=now;
  raf=requestAnimationFrame(frame);
 }
 document.addEventListener("visibilitychange",()=>{previous=0;samples.length=0;});
 function stats(){
  const gaps=samples.map(s=>s.gap).sort((a,b)=>a-b);
  const count=gaps.length,span=count>1?(samples[count-1].time-samples[0].time)/1000:0;
  const fps=span>0?Math.round((count-1)/span):null;
  const p95=count?gaps[Math.min(count-1,Math.ceil(count*.95)-1)]:null;
  const middle=count?gaps[Math.floor(count/2)]:null;
  const slow=count&&middle?gaps.filter(d=>d>middle*1.5).length:0;
  return {
   fps:fps,frameP95Ms:p95===null?null:Math.round(p95*10)/10,
   slowFrames:slow,framesSampled:count,lcpSeconds:lcp?Math.round(lcp/100)/10:null,
   maxInteractionMs:longestEvent?Math.round(longestEvent):null,
   longTasks,longTaskMs:Math.round(longTaskMs),cls:Math.round(cls*1000)/1000,
   viewport:window.innerWidth+"x"+window.innerHeight,dpr:window.devicePixelRatio||1
  };
 }
 function paint(){
  const s=stats();
  output.textContent=[
   "FPS (rAF): "+(s.fps??"…")+"  |  p95: "+(s.frameP95Ms??"…")+" ms",
   "Frame lewat: "+s.slowFrames+" / "+s.framesSampled,
   "LCP: "+(s.lcpSeconds??"…")+" s  |  CLS: "+s.cls,
   "Tugas panjang: "+s.longTasks+" ("+s.longTaskMs+" ms)",
   "Interaksi maks.: "+(s.maxInteractionMs??"…")+" ms",
   "Skrin: "+s.viewport+" @"+s.dpr+"x"
  ].join("\n");
 }
 copy.addEventListener("click",async()=>{
  const result={page:location.pathname,measuredAt:new Date().toISOString(),...stats(),note:"diagnostic rAF; bukan Lighthouse atau GPU FPS"};
  try{await navigator.clipboard.writeText(JSON.stringify(result,null,2));copy.textContent="Disalin";
  }catch(_){copy.textContent="Gagal salin";}
 });
 close.addEventListener("click",()=>{
  running=false;cancelAnimationFrame(raf);clearInterval(interval);
  for(const o of observers)o.disconnect();hud.remove();
 });
 raf=requestAnimationFrame(frame);interval=setInterval(paint,1800);paint();
})();
