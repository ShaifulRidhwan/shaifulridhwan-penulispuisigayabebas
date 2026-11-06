/* AKSARA Voice Chat 3D experiment.
 * UI only: NEVER open sockets, media devices or modify playback, token, Aoede,
 * dialect routing, storage or the original 3D avatar renderer.
 * Gate: ?voice-ui=3d on experiment branch, leave baseline unchanged otherwise. */
(function(){
  "use strict";
  const panel=document.getElementById("voicePanel");
  const head=panel?.querySelector(".voice-panel-head");
  const actions=head?.querySelector(".voice-panel-head-actions");
  const stage=document.getElementById("voiceAvatarStage");
  const wave=document.getElementById("voiceWave");
  const dock=panel?.querySelector(".voice-dialogue-dock");
  const controls=panel?.querySelector(".voice-session-controls");
  const row=panel?.querySelector(".voice-style-row");
  const stop=document.getElementById("voiceStop");
  if(!panel||!head||!actions||!stage||!dock||!controls||!row||!stop)return;
  document.body.classList.add("aksara-voice-3d-experiment");
  panel.classList.add("voice-ui-experiment-v3");
  /* Moving existing elements preserves every listener and DOM id. */
  document.body.appendChild(panel);
  const el=(tag,cls,value)=>{
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(value!==undefined)node.textContent=value;
    return node;
  };
  const live=el("div","voice-x-live");
  live.setAttribute("role","status");
  const dot=el("span","voice-x-dot");dot.setAttribute("aria-hidden","true");
  const liveText=el("span","voice-x-live-text","MENYAMBUNG");
  live.append(dot,liveText);
  const timer=el("span","voice-x-timer","00:00");
  timer.setAttribute("aria-label","Tempoh sesi suara");
  const metrics=el("div","voice-x-metrics");
  metrics.append(live,timer);
  head.insertBefore(metrics,actions);
  const name=head.querySelector(".voice-live-name");
  if(name)name.textContent="AKSARA Voice Chat";
  const main=el("div","voice-x-main");
  const hero=el("div","voice-x-hero");
  const aside=el("aside","voice-x-aside");
  aside.setAttribute("aria-label","Tetapan Voice Chat");
  hero.append(stage);
  if(wave)hero.append(wave);
  hero.append(dock);
  const sectionTitle=el("h2","voice-x-heading","Tetapan sesi");
  aside.append(sectionTitle);
  const style=el("div","voice-x-setting");
  style.append(el("span","voice-x-setting-label","Gaya bahasa"));
  const trigger=document.getElementById("voiceStyleTrigger");
  if(trigger){style.append(trigger);row.hidden=true;}
  else style.append(row);
  aside.append(style);
  const mode=document.getElementById("voiceModeBadge");
  if(mode){
    const modeRow=el("div","voice-x-setting");
    modeRow.append(el("span","voice-x-setting-label","Thinking Mode"),mode);
    aside.append(modeRow);
  }
  const volume=controls.querySelector(".voice-volume");
  if(volume){
    const volumeRow=el("div","voice-x-setting voice-x-volume");
    volumeRow.append(el("span","voice-x-setting-label","Kelantangan"));
    volumeRow.append(volume);
    aside.append(volumeRow);
  }
  const info=el("div","voice-x-identity");
  info.append(el("span","voice-x-info-dot"),el("span","","Wajah 3D asal · Suara Aoede"));
  aside.append(info);
  main.append(hero,aside);
  const footer=el("div","voice-x-footer");
  footer.setAttribute("role","group");
  footer.setAttribute("aria-label","Kawalan sesi suara");
  footer.append(controls);
  const footerEnd=el("button","voice-x-end","Tamatkan sesi");
  footerEnd.type="button";
  footerEnd.setAttribute("aria-label","Tamatkan sesi Voice Chat");
  footerEnd.addEventListener("click",()=>stop.click());
  const speaker=document.getElementById("voiceMuteSpeaker");
  if(speaker)controls.insertBefore(footerEnd,speaker);
  else controls.append(footerEnd);
  panel.append(main,footer);
  const refresh=()=>{
    if(panel.hidden)return;
    const d=window.BilikAntaraVoiceDiagnostics?.snapshot?.();
    const connected=Boolean(d?.connected);
    const phase=panel.dataset.voicePhase||"idle";
    live.dataset.connected=connected?"true":"false";
    const next=connected?"LIVE CONNECTED":phase==="error"?"TERPUTUS":phase==="connecting"?"MENYAMBUNG": "VOICE LIVE";
    if(liveText.textContent!==next)liveText.textContent=next;
    const seconds=Math.max(0,Number(d?.elapsedSeconds)||0);
    const mm=String(Math.floor(seconds/60)).padStart(2,"0");
    const ss=String(seconds%60).padStart(2,"0");
    timer.textContent=mm+":"+ss;
    /* No simulated microphone/speaking states. Read actual voice state. */
    hero.dataset.phase=phase;
  };
  refresh();
  const observer=new MutationObserver(refresh);
  observer.observe(panel,{attributes:true,attributeFilter:["hidden","class","data-voice-phase"]});
  const interval=window.setInterval(()=>{if(!document.hidden)refresh();},1000);
  window.addEventListener("pagehide",()=>{window.clearInterval(interval);observer.disconnect();},{once:true});
})();