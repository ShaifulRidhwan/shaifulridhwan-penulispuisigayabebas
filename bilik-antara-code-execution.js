/* RUNTIME ANTARA: decorative modal only. The sandbox stays isolated in Code Runtime. */
(function(root){
"use strict";
const modal=document.createElement("dialog");
modal.id="runtimeAntaraDialog";modal.className="runtime-antara";modal.hidden=true;
modal.setAttribute("aria-labelledby","runtimeAntaraTitle");
modal.setAttribute("aria-describedby","runtimeAntaraStatus");
modal.innerHTML=[
 '<div class="runtime-antara__wrap">',
  '<div class="runtime-antara__head">',
   '<div><div class="runtime-antara__eyebrow">AKSARA CODE ENGINE</div><h2 class="runtime-antara__title" id="runtimeAntaraTitle">RUNTIME ANTARA</h2></div>',
   '<span class="runtime-antara__language" id="runtimeAntaraLanguage">JavaScript</span>',
  '</div>',
  '<div class="runtime-antara__scene" aria-hidden="true">',
   '<canvas id="runtimeAntaraCanvas"></canvas><span class="runtime-antara__axis"></span>',
   '<div class="runtime-antara__core"><svg viewBox="0 0 40 40"><path d="M12 11 4 20l8 9M28 11l8 9-8 9M23 8l-6 24"/></svg></div>',
   '<div class="runtime-antara__legend"><span>CAHAYA</span><span>GELAP</span></div>',
  '</div>',
  '<div class="runtime-antara__details">',
   '<div class="runtime-antara__stage"><span class="runtime-antara__status" id="runtimeAntaraStatus" role="status" aria-live="polite">Membina sandbox…</span><span class="runtime-antara__secure">SANDBOX · NO AI</span></div>',
   '<div class="runtime-antara__track" aria-hidden="true"><div class="runtime-antara__fill"></div></div>',
   '<div class="runtime-antara__foot"><span class="runtime-antara__note">Kod diproses dalam runtime terasing.</span><button type="button" class="runtime-antara__stop" id="runtimeAntaraStop">Henti</button></div>',
  '</div>',
 '</div>'
].join("");
document.body.appendChild(modal);
const stage=modal.querySelector("#runtimeAntaraStatus");
const stop=modal.querySelector("#runtimeAntaraStop");
const badge=modal.querySelector("#runtimeAntaraLanguage");
const canvas=modal.querySelector("#runtimeAntaraCanvas");
const ctx=canvas.getContext("2d",{alpha:true});
const reduced=()=>root.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
let active=null,raf=0,columns=[],lastFrame=0,sceneWidth=1,sceneHeight=1;
const glyphs="01<>/{ }ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function layout(){
 if(!ctx)return;
 const box=canvas.getBoundingClientRect(),scale=Math.min(1.5,root.devicePixelRatio||1);
 sceneWidth=Math.max(1,box.width);sceneHeight=Math.max(1,box.height);
 canvas.width=Math.round(sceneWidth*scale);canvas.height=Math.round(sceneHeight*scale);
 ctx.setTransform(scale,0,0,scale,0,0);
 const count=Math.min(40,Math.ceil(sceneWidth/16));
 columns=Array.from({length:count},(_,i)=>({
  x:(i+.5)*sceneWidth/count,
  y:Math.random()*sceneHeight,
  velocity:26+Math.random()*60,
  phase:Math.random()*6,
  text:glyphs[Math.floor(Math.random()*glyphs.length)]
 }));
}
function draw(now){
 if(!active||!ctx||reduced())return;
 raf=root.requestAnimationFrame(draw);
 if(now-lastFrame<48)return;
 const elapsed=lastFrame?Math.min(0.08,(now-lastFrame)/1000):0.05;
 lastFrame=now;
 ctx.clearRect(0,0,sceneWidth,sceneHeight);
 ctx.font="12px ui-monospace, Consolas, monospace";
 for(const col of columns){
  col.y+=col.velocity*elapsed;
  if(col.y>sceneHeight+18){col.y=-16;col.x=Math.max(0,Math.min(sceneWidth,col.x+(Math.random()-.5)*12));}
  const gold=col.x<sceneWidth/2;
  ctx.fillStyle=gold?"rgba(239,186,104,.53)":"rgba(104,168,238,.51)";
  ctx.fillText(col.text,col.x,col.y);
  if(Math.random()<.035)col.text=glyphs[Math.floor(Math.random()*glyphs.length)];
  ctx.fillStyle=gold?"rgba(239,186,104,.15)":"rgba(104,168,238,.15)";
  ctx.fillText(col.text,col.x,col.y-19);
  ctx.fillText(col.text,col.x,col.y-38);
 }
}
function close(){
 const session=active;
 active=null;
 if(raf){root.cancelAnimationFrame(raf);raf=0;}
 lastFrame=0;
 if(modal.open)modal.close();
 modal.hidden=true;
 if(session?.focus&&session.focus.isConnected&&typeof session.focus.focus==="function")session.focus.focus({preventScroll:true});
}
function open(language,onStop){
 if(active)close();
 active={onStop,focus:document.activeElement};
 badge.textContent=language==="python"?"Python":"JavaScript";
 stage.textContent="Membina sandbox…";
 modal.hidden=false;
 modal.showModal();
 // The visual countdown is an animation, not a claim of compilation progress.
 const bar=modal.querySelector(".runtime-antara__fill");
 bar.style.animation="none";void bar.offsetWidth;bar.style.animation="";
 if(ctx&&!reduced()){layout();lastFrame=0;raf=root.requestAnimationFrame(draw);}
 stop.focus();
 return Object.freeze({
  update(message){if(active)stage.textContent=String(message||"Menjalankan kod…").slice(0,100);},
  close
 });
}
stop.addEventListener("click",()=>{if(active?.onStop)active.onStop();});
modal.addEventListener("cancel",event=>{event.preventDefault();if(active?.onStop)active.onStop();});
root.addEventListener("resize",()=>{if(active&&ctx&&!reduced())layout();});
root.AksaraRuntimeOverlay=Object.freeze({open,isOpen:()=>!!active,close});
})(window);
