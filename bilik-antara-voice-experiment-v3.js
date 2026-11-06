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
  /* Existing GLB renderer and DOM handlers are retained. */
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
  const liveText=el("span","voice-x-live-text","VOICE LIVE");
  live.append(dot,liveText);
  const timer=el("span","voice-x-timer","00:00");
  timer.setAttribute("aria-label","Tempoh sesi suara");
  const metrics=el("div","voice-x-metrics");
  metrics.append(live,timer);
  head.insertBefore(metrics,actions);
  /* The original identity element contains the pre-existing style trigger.
     Leave it mounted, and add a dedicated, typographically consistent brand. */
  const brand=el("div","voice-v4-brand");
  const mark=el("span","voice-v4-brand-mark");
  mark.setAttribute("aria-hidden","true");
  mark.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5l2.1 7.4 7.4 2.1-7.4 2.1-2.1 7.4-2.1-7.4-7.4-2.1 7.4-2.1L12 2.5Z"/><path d="M18.6 3.8v3.8m-1.9-1.9h3.8"/></svg>';
  const wordmark=el("span","voice-v4-wordmark");
  wordmark.append(el("strong","","AKSARA"),el("small","","VOICE CHAT"));
  brand.append(mark,wordmark);
  head.insertBefore(brand,metrics);
  const originalIdentity=head.querySelector(".voice-live-label");
  if(originalIdentity)originalIdentity.classList.add("voice-v4-original-identity");
  const main=el("div","voice-x-main");
  const hero=el("div","voice-x-hero voice-v4-hero");
  hero.setAttribute("aria-label","Avatar Voice Chat Aksara");
  const aside=el("aside","voice-x-aside");
  aside.setAttribute("aria-label","Tetapan Voice Chat");
  /* A still of the existing GLB avatar, only until WebGL is ready. */
  const fallback=el("img","voice-x-avatar-fallback");
  fallback.src="bilik-antara-chat-portrait.png?v=1";
  fallback.alt="";
  fallback.decoding="async";
  fallback.setAttribute("aria-hidden","true");
  stage.append(fallback);
  hero.append(stage);
  if(wave)hero.append(wave);
  hero.append(dock);
  const sectionTitle=el("h2","voice-x-heading","Tetapan suara");
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
  main.append(hero,aside);
  const footer=el("div","voice-x-footer voice-v4-control-deck");
  footer.setAttribute("role","group");
  footer.setAttribute("aria-label","Kawalan sesi suara");
  footer.append(controls);
  const footerEnd=el("button","voice-x-end","Tamatkan sesi");
  footerEnd.type="button";
  footerEnd.setAttribute("aria-label","Tamatkan sesi Voice Chat");
  footerEnd.addEventListener("click",()=>stop.click());
  const speaker=document.getElementById("voiceMuteSpeaker");
  const mic=document.getElementById("voiceMuteMic");
  /* One sequence across every viewport: mic / end / speaker. */
  if(mic)controls.append(mic);
  controls.append(footerEnd);
  if(speaker)controls.append(speaker);
  panel.append(main,footer);
  /* Internal diagnostics stay available but do not occupy the call UI. */
  const diagnostics=panel.querySelector("#voiceObserveV2");
  if(diagnostics){diagnostics.open=false;diagnostics.hidden=true;}
  /* Explicit UI preview for this experimental branch. The Cloudflare preview
     may not have the Gemini Live token broker, and UI testing must never request
     microphone access or claim a live connection. &voice-live=1 opts into the
     existing Live handler for separate integration testing. */
  const liveButton=document.getElementById("voiceLive");
  const previewOnly=new URLSearchParams(location.search).get("voice-live")!=="1";
  let previewOpen=false;
  const previewStatus="Pratonton reka bentuk sahaja. Mikrofon dan Gemini Live tidak diaktifkan.";
  function closePreview(){
    if(!previewOpen)return;
    previewOpen=false;
    panel.hidden=true;
    panel.classList.remove("is-minimized");
    liveButton?.setAttribute("aria-pressed","false");
    liveButton?.setAttribute("aria-expanded","false");
    liveButton?.removeAttribute("data-voice-preview");
    for(const control of [mic,speaker])if(control)control.disabled=false;
    document.body.classList.remove("voice-focus");
  }
  function openPreview(event){
    if(!previewOnly)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(previewOpen)return;
    previewOpen=true;
    panel.hidden=false;
    panel.classList.remove("is-minimized");
    panel.dataset.voicePhase="idle";
    liveButton?.setAttribute("aria-pressed","true");
    liveButton?.setAttribute("aria-expanded","true");
    liveButton?.setAttribute("data-voice-preview","true");
    document.body.classList.add("voice-focus");
    const phaseLabel=document.getElementById("voicePhaseLabel");
    if(phaseLabel)phaseLabel.textContent="Pratonton";
    const status=document.getElementById("voiceStatus");
    if(status)status.textContent=previewStatus;
    for(const control of [mic,speaker]){
      if(!control)continue;
      control.disabled=true;
      control.title="Kawalan audio hanya aktif dalam panggilan sebenar";
    }
    /* Preserve the original GLB loading path for the UI preview. */
    import("./bilik-antara-avatar.js?v=14").catch(()=>{
      stage.classList.add("avatar-unavailable");
    });
    refresh();
  }
  if(previewOnly&&liveButton){
    liveButton.addEventListener("click",openPreview,{capture:true});
    /* Intercept the original close handler in this UI-only preview.
       The custom central end button delegates to this same original button. */
    stop.addEventListener("click",event=>{
      if(!previewOpen)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closePreview();
    },{capture:true});
    document.addEventListener("keydown",event=>{
      if(event.key==="Escape"&&previewOpen)closePreview();
    });
    window.addEventListener("pagehide",closePreview,{once:true});
  }
  const refresh=()=>{
    if(panel.hidden)return;
    if(previewOpen){
      live.dataset.connected="false";
      liveText.textContent="PRATONTON UI";
      timer.textContent="00:00";
      hero.dataset.phase="idle";
      panel.dataset.voiceV4Connected="false";
      return;
    }
    const d=window.BilikAntaraVoiceDiagnostics?.snapshot?.();
    const connected=Boolean(d?.connected);
    const phase=panel.dataset.voicePhase||"idle";
    live.dataset.connected=connected?"true":"false";
    const next=connected?"TERSAMBUNG":phase==="error"?"TERPUTUS":phase==="connecting"?"MENYAMBUNG":"VOICE LIVE";
    if(liveText.textContent!==next)liveText.textContent=next;
    const seconds=Math.max(0,Number(d?.elapsedSeconds)||0);
    const mm=String(Math.floor(seconds/60)).padStart(2,"0");
    const ss=String(seconds%60).padStart(2,"0");
    timer.textContent=mm+":"+ss;
    /* No fake status or raw diagnostics in Voice Chat. Internal snapshot only informs the simple status and timer. */
    hero.dataset.phase=phase;
    panel.dataset.voiceV4Connected=connected?"true":"false";
  };
  refresh();
  const observer=new MutationObserver(refresh);
  observer.observe(panel,{attributes:true,attributeFilter:["hidden","class","data-voice-phase"]});
  const interval=window.setInterval(()=>{if(!document.hidden)refresh();},1000);
  window.addEventListener("pagehide",()=>{window.clearInterval(interval);observer.disconnect();},{once:true});
})();