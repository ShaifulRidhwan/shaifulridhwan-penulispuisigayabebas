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
  // Native Voice notices were left in .conversation, behind the immersive V4
  // overlay. Keep the exact original node and handler, but portal it to body
  // so token, permission and transport errors are visible during the call.
  const nativeNotice=document.getElementById("voiceNotice");
  if(nativeNotice)document.body.appendChild(nativeNotice);
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
  /* Brand matches Bilik Antara: no decorative third-party icon. */
  const brand=el("div","voice-v4-brand");
  const wordmark=el("span","voice-v4-wordmark");
  wordmark.append(el("strong","","AKSARA"),el("small","","VOICE CHAT"));
  brand.append(wordmark);
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
  /* Waveform belongs to the conversational status, not the avatar chest. */
  if(wave)dock.insertBefore(wave,dock.firstChild);
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
    volumeRow.append(el("span","voice-x-setting-label","Volume"));
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
  /* Production uses the existing Gemini Live handlers by default.
     The opt-in ?voice-preview=1 is a UI-only sandbox for screenshots. */
  const liveButton=document.getElementById("voiceLive");
  const previewOnly=new URLSearchParams(location.search).get("voice-preview")==="1";
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
    import("./bilik-antara-avatar.js?v=16").catch(()=>{
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
  // A timer is a connected call timer, not the duration of microphone/token setup.
  // Keep it running across brief transport reconnects, but reset for each new call.
  let firstConnectedAt=0;
  let lastSessionStartedAt=0;
  const refresh=()=>{
    if(panel.hidden){
      firstConnectedAt=0;
      lastSessionStartedAt=0;
      return;
    }
    if(previewOpen){
      firstConnectedAt=0;
      lastSessionStartedAt=0;
      live.dataset.connected="false";
      liveText.textContent="PRATONTON UI";
      timer.textContent="00:00";
      hero.dataset.phase="idle";
      panel.dataset.voiceV4Connected="false";
      return;
    }
    const d=window.BilikAntaraVoiceDiagnostics?.snapshot?.();
    const active=d?.sessionActive===true;
    const connected=active&&d?.connected===true;
    const startedAt=Math.max(0,Number(d?.startedAt)||0);
    if(!active||(startedAt&&startedAt!==lastSessionStartedAt)){
      firstConnectedAt=0;
    }
    lastSessionStartedAt=active?startedAt:0;
    if(connected&&!firstConnectedAt)firstConnectedAt=Date.now();
    const phase=panel.dataset.voicePhase||"idle";
    const offline=navigator.onLine===false;
    const next=!active?"SEDIA":
      phase==="paused"?"DIJEDA":
      offline&&!connected?"LUAR TALIAN":
      connected?"LIVE":
      phase==="error"?"GANGGUAN":
      (Number(d?.connections)||0)>0?"SAMBUNG SEMULA":"MENYAMBUNG";
    live.dataset.connected=connected?"true":"false";
    if(liveText.textContent!==next)liveText.textContent=next;
    const seconds=active&&firstConnectedAt?
      Math.max(0,Math.floor((Date.now()-firstConnectedAt)/1000)):0;
    const mm=String(Math.floor(seconds/60)).padStart(2,"0");
    const ss=String(seconds%60).padStart(2,"0");
    timer.textContent=mm+":"+ss;
    timer.setAttribute("aria-label","Tempoh sambungan Voice Chat "+mm+" minit "+ss+" saat");
    hero.dataset.phase=phase;
    panel.dataset.voiceV4Connected=connected?"true":"false";
    /* Keep native controls authoritative: their aria-pressed reflects the
       actual track/output state set by bilik-antara-voice.js. */
  };
  refresh();
  const observer=new MutationObserver(refresh);
  observer.observe(panel,{attributes:true,attributeFilter:["hidden","class","data-voice-phase"]});
  const interval=window.setInterval(()=>{if(!document.hidden)refresh();},1000);
  window.addEventListener("pagehide",()=>{window.clearInterval(interval);observer.disconnect();},{once:true});
})();