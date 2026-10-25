(function(){
"use strict";
/* Bilik Antara voice: opt-in dictation, browser read-aloud, and Gemini Live.
   Never persists raw audio, never reveals the normal Gemini API key. */
const $=id=>document.getElementById(id);
const dictate=$("voiceDictate"),liveButton=$("voiceLive"),notice=$("voiceNotice");
const panel=$("voicePanel"),status=$("voiceStatus"),transcript=$("voiceTranscript");
const stopButton=$("voiceStop"),micButton=$("voiceMuteMic"),speakerButton=$("voiceMuteSpeaker");
const waveform=$("voiceWave"),input=$("input"),chat=$("chat");
if(!dictate||!liveButton||!notice||!panel||!status||!transcript||!stopButton||!micButton||!speakerButton||!input||!chat)return;
const ENDPOINT="/.netlify/functions/bilik-antara-live-token";
const SOCKET_BASE="wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=";
const MAX_SESSION=10*60*1000;
let recognizer=null,dictating=false,readUtterance=null,liveGeneration=0;
let socket=null,mediaStream=null,micContext=null,micNode=null,micSource=null,micSink=null,playContext=null;
let liveActive=false,liveReady=false,micEnabled=true,speakerEnabled=true;
let startAbort=null,sessionTimer=null,nextAudioTime=0,playSources=new Set(),lastTurn=null;
const speechAPI=window.SpeechRecognition||window.webkitSpeechRecognition;
const sayStatus=(value)=>{status.textContent=value;};
const showNotice=(message)=>{notice.textContent=String(message||"").slice(0,230);notice.hidden=!message;};
const setWave=(value)=>{waveform.style.setProperty("--voice-intensity",String(Math.max(.08,Math.min(1,value||0))));};
const setButtonState=()=>{
  liveButton.setAttribute("aria-pressed",liveActive?"true":"false");
  liveButton.disabled=liveActive;
  liveButton.textContent=liveActive?"● Voice sedang aktif":"✦ Voice Live";
  panel.hidden=!liveActive;
  dictate.disabled=liveActive||!speechAPI;
  micButton.textContent=micEnabled?"Tutup mikrofon":"Buka mikrofon";
  micButton.setAttribute("aria-pressed",micEnabled?"true":"false");
  speakerButton.textContent=speakerEnabled?"Senyapkan suara":"Hidupkan suara";
  speakerButton.setAttribute("aria-pressed",speakerEnabled?"true":"false");
};
function canTalk(){return !!window.speechSynthesis&&typeof window.SpeechSynthesisUtterance==="function";}
function pickBrowserVoice(){
  const voices=window.speechSynthesis.getVoices();
  const male=v=>/(?:\\bmale\\b|lelaki|\\bman\\b)/i.test(v.name)&&!/female|woman|perempuan/i.test(v.name);
  return voices.find(v=>/^ms[-_](MY|BN)/i.test(v.lang)&&male(v))||
    voices.find(v=>/^ms([_-]|$)/i.test(v.lang)&&male(v))||
    voices.find(v=>/^id([_-]|$)/i.test(v.lang)&&male(v))||
    voices.find(v=>/^ms([_-]|$)/i.test(v.lang))||
    voices.find(v=>/^id([_-]|$)/i.test(v.lang))||null;
}
function stopReading(){if(canTalk())window.speechSynthesis.cancel();readUtterance=null;}
function speak(text){
  if(!canTalk())return;
  const clean=String(text||"").replace(/https?:\/\/\S+/g,"pautan sumber").trim().slice(0,3800);
  if(!clean)return;
  stopReading();
  const utter=new SpeechSynthesisUtterance(clean);
  utter.lang="ms-MY";utter.rate=.98;utter.pitch=.85;utter.volume=1;
  const voice=pickBrowserVoice();
  if(voice)utter.voice=voice;
  readUtterance=utter;
  utter.onend=()=>{if(readUtterance===utter)readUtterance=null;};
  utter.onerror=()=>{if(readUtterance===utter)readUtterance=null;};
  window.speechSynthesis.speak(utter);
}
function extractMessage(node){
  const bubble=node.querySelector(".bubble");
  if(!bubble)return "";
  const clone=bubble.cloneNode(true);
  clone.querySelectorAll("details,.msg-sources,.voice-read,button,pre").forEach(el=>el.remove());
  return String(clone.textContent||"").replace(/\s+/g," ").trim();
}
function equipRead(node){
  if(!node.matches(".message.ai")||node.querySelector(".voice-read")||node.querySelector(".typing"))return;
  const bubble=node.querySelector(".bubble");
  if(!bubble)return;
  const text=extractMessage(node);
  if(!text)return;
  const button=document.createElement("button");
  button.type="button";button.className="voice-read";button.textContent="◖)) Dengar";
  button.setAttribute("aria-label","Dengarkan jawapan ini");
  button.addEventListener("click",()=>{
    if(!canTalk()){button.textContent="Suara pelayar tidak disokong";return;}
    if(readUtterance){stopReading();return;}
    speak(text);
  });
  bubble.appendChild(button);
}
chat.querySelectorAll(".message.ai").forEach(n=>equipRead(n));
const observer=new MutationObserver(mutations=>{
  for(const m of mutations)for(const n of m.addedNodes){
    if(n.nodeType!==1)continue;
    if(n.matches&&n.matches(".message.ai"))equipRead(n);
    if(n.querySelectorAll)n.querySelectorAll(".message.ai").forEach(x=>equipRead(x));
  }
});
observer.observe(chat,{childList:true,subtree:true});
if(!speechAPI){
  dictate.disabled=true;dictate.title="Dikte tidak disokong oleh pelayar ini. Gunakan Voice Live jika tersedia.";
}
function closeDictation(){
  if(recognizer){try{recognizer.stop();}catch(e){}}
  recognizer=null;dictating=false;
  dictate.textContent="🎙 Dikte";
  dictate.setAttribute("aria-pressed","false");
}
function startDictation(){
  if(!speechAPI){return;}
  if(dictating){closeDictation();return;}
  if(liveActive)return;
  stopReading();
  const recognition=new speechAPI();
  recognizer=recognition;
  const initial=input.value.trim();
  recognition.lang="ms-MY";recognition.continuous=true;recognition.interimResults=true;
  recognition.onstart=()=>{
    dictating=true;dictate.textContent="■ Henti dikte";
    dictate.setAttribute("aria-pressed","true");
  };
  recognition.onresult=(event)=>{
    if(recognizer!==recognition)return;
    let heard="",interim="";
    for(let i=0;i<event.results.length;i++){
      const item=event.results[i];const segment=String(item[0]&&item[0].transcript||"");
      if(item.isFinal)heard+=segment+" ";else interim+=segment;
    }
    input.value=[initial,(heard+interim).trim()].filter(Boolean).join(" ").slice(0,1600);
    input.dispatchEvent(new Event("input",{bubbles:true}));
  };
  recognition.onerror=(event)=>{
    const error=String(event.error||"");
    if(error==="not-allowed"||error==="service-not-allowed")dictate.title="Benarkan akses mikrofon dalam tetapan pelayar.";
  };
  recognition.onend=()=>{
    if(recognizer===recognition)closeDictation();
  };
  try{recognition.start();}
  catch(e){closeDictation();}
}
dictate.addEventListener("click",startDictation);
function stopAudioQueue(){
  for(const src of playSources){try{src.stop();}catch(e){}}
  playSources.clear();nextAudioTime=0;
}
async function closeLive(reason){
  liveGeneration++;
  liveReady=false;liveActive=false;
  if(startAbort){startAbort.abort();startAbort=null;}
  if(sessionTimer){clearTimeout(sessionTimer);sessionTimer=null;}
  if(socket){const ws=socket;socket=null;ws.onclose=null;ws.onerror=null;ws.onmessage=null;try{ws.close(1000,"Sesi tamat");}catch(e){}}
  stopAudioQueue();
  if(micNode){try{micNode.disconnect();micNode.port.onmessage=null;}catch(e){}micNode=null;}
  if(micSource){try{micSource.disconnect();}catch(e){}micSource=null;}
  if(micSink){try{micSink.disconnect();}catch(e){}micSink=null;}
  if(mediaStream){mediaStream.getTracks().forEach(t=>t.stop());mediaStream=null;}
  const closingMic=micContext,closingPlayback=playContext;
  micContext=null;playContext=null;
  if(closingMic)try{await closingMic.close();}catch(e){}
  if(closingPlayback)try{await closingPlayback.close();}catch(e){}
  lastTurn=null;
  setWave(0);setButtonState();
  if(reason)liveButton.title=reason;
}
function bytesBase64(pcm){
  const bytes=new Uint8Array(pcm);
  let binary="";
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary);
}
function appendTranscript(role,segment){
  const text=String(segment||"").trim();
  if(!text)return;
  const isNew=!lastTurn||lastTurn.role!==role||lastTurn.finished;
  if(isNew){
    const line=document.createElement("p");
    line.className="voice-line";
    const label=document.createElement("strong");
    label.textContent=role==="user"?"Kau: ":"Aku: ";
    line.appendChild(label);
    const words=document.createElement("span");line.appendChild(words);
    transcript.appendChild(line);
    lastTurn={role,line,words,text:"",finished:false};
  }
  if(text.startsWith(lastTurn.text)&&lastTurn.text.length>0)lastTurn.text=text;
  else if(!lastTurn.text.endsWith(text))lastTurn.text=(lastTurn.text+" "+text).trim();
  lastTurn.text=lastTurn.text.slice(-2800);
  lastTurn.words.textContent=lastTurn.text;
  while(transcript.children.length>36)transcript.firstElementChild.remove();
  transcript.scrollTop=transcript.scrollHeight;
}
function decodePcm(data,rate){
  const raw=atob(data);if(!raw.length)return null;
  const frames=Math.floor(raw.length/2);
  if(!frames||frames>24000*30)return null;
  const buffer=playContext.createBuffer(1,frames,rate);
  const ch=buffer.getChannelData(0);
  for(let i=0;i<frames;i++){
    let v=raw.charCodeAt(i*2)|(raw.charCodeAt(i*2+1)<<8);
    if(v&0x8000)v-=0x10000;
    ch[i]=v/32768;
  }
  return buffer;
}
function queueAudio(data,mime){
  if(!speakerEnabled||!playContext||!data)return;
  const match=String(mime||"").match(/rate=(\d+)/);
  const rate=match?Number(match[1]):24000;
  if(rate<8000||rate>48000)return;
  try{
    const buffer=decodePcm(data,rate);
    if(!buffer)return;
    const now=playContext.currentTime;
    if(nextAudioTime-now>3.5)return; // avoid minutes of queued audio on slow devices
    const node=playContext.createBufferSource();
    node.buffer=buffer;node.connect(playContext.destination);
    node.onended=()=>{playSources.delete(node);try{node.disconnect();}catch(e){}};
    const when=Math.max(now+.035,nextAudioTime||0);
    node.start(when);nextAudioTime=when+buffer.duration;playSources.add(node);
    panel.classList.add("voice-speaking");
  }catch(e){sayStatus("Audio suara tidak dapat dimainkan pada pelayar ini.");}
}
function onServerMessage(payload){
  if(payload.setupComplete){liveReady=true;sayStatus("Bersambung. Cakap sahaja, aku sedang mendengar.");return;}
  if(payload.goAway){sayStatus("Sesi Voice hampir tamat.");}
  const c=payload.serverContent;
  if(!c)return;
  if(c.interrupted){stopAudioQueue();panel.classList.remove("voice-speaking");if(lastTurn)lastTurn.finished=true;}
  if(c.inputTranscription&&c.inputTranscription.text){
    appendTranscript("user",c.inputTranscription.text);
    sayStatus("Mendengar…");
  }
  if(c.outputTranscription&&c.outputTranscription.text){
    appendTranscript("assistant",c.outputTranscription.text);
    sayStatus("Aku sedang menjawab…");
  }
  for(const part of (c.modelTurn&&c.modelTurn.parts)||[]){
    if(part.inlineData&&part.inlineData.data&&String(part.inlineData.mimeType||"").startsWith("audio/")){
      queueAudio(part.inlineData.data,part.inlineData.mimeType);
    }
  }
  if(c.turnComplete){
    if(lastTurn)lastTurn.finished=true;
    panel.classList.remove("voice-speaking");
    sayStatus("Aku sedang mendengar. Kau boleh mencelah bila-bila masa.");
  }
}
async function startLive(){
  if(liveActive)return;
  if(!window.isSecureContext||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||
     !(window.AudioContext||window.webkitAudioContext)||!window.AudioWorkletNode||!window.WebSocket){
    liveButton.title="Voice Live memerlukan HTTPS dan pelayar yang menyokong Web Audio.";
    const message="Pelayar ini tidak menyokong Voice Live.";
    sayStatus(message);showNotice(message);return;
  }
  closeDictation();stopReading();showNotice("");
  liveActive=true;liveReady=false;micEnabled=true;speakerEnabled=true;
  lastTurn=null;transcript.replaceChildren();panel.classList.remove("voice-speaking");
  setButtonState();sayStatus("Meminta kebenaran mikrofon…");
  const generation=++liveGeneration;
  try{
    // Request microphone while we still have a direct user gesture.
    const stream=await navigator.mediaDevices.getUserMedia({
      audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},
      video:false
    });
    if(generation!==liveGeneration){stream.getTracks().forEach(t=>t.stop());return;}
    mediaStream=stream;
    const Audio=window.AudioContext||window.webkitAudioContext;
    micContext=new Audio({latencyHint:"interactive"});
    playContext=new Audio({latencyHint:"interactive"});
    await Promise.all([micContext.resume(),playContext.resume()]);
    await micContext.audioWorklet.addModule("./bilik-antara-pcm-worklet.js");
    if(generation!==liveGeneration)return;
    sayStatus("Menyambung ke Gemini Live…");
    const controller=new AbortController();startAbort=controller;
    const res=await fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},
      body:"{}",signal:controller.signal,credentials:"same-origin",cache:"no-store"});
    const body=await res.json().catch(()=>({}));
    if(!res.ok||!body.token||!body.model)throw Error(body.error||"Token Voice tidak tersedia.");
    if(generation!==liveGeneration)return;
    const ws=new WebSocket(SOCKET_BASE+encodeURIComponent(body.token));
    socket=ws;
    ws.onopen=()=>{
      if(generation!==liveGeneration)return;
      ws.send(JSON.stringify({setup:{
        model:"models/"+body.model,
        generationConfig:{
          responseModalities:["AUDIO"],
          speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:"Charon"}}}
        },
        inputAudioTranscription:{},
        outputAudioTranscription:{},
        systemInstruction:{parts:[{text:[
          "Kau Bilik Antara, kecerdasan buatan ciptaan Shaiful Ridhwan.",
          "WAJIB gunakan kata ganti diri pertama AKU, bukan SAYA, sepanjang sesi.",
          "Gunakan Bahasa Melayu Malaysia moden yang santai. Panggil pengguna KAU.",
          "Jangan baca seperti pembaca berita. Bercakap semula jadi, ringkas, jelas dan tenang.",
          "Kritik hujah secara tajam tetapi hormat; jangan menghina individu.",
          "Bezakan bukti dengan andaian dan akui apabila kau tidak pasti.",
          "Dalam hal kesihatan, kesedihan atau kecemasan, bersikap empati tanpa sindiran.",
          "Jangan mereka fakta, petikan, sumber atau maklumat peribadi.",
          "Beri ruang pengguna mencelah. Dengar dahulu sebelum membalas.",
          "Mulakan respons dengan inti; tidak perlu memperkenalkan diri berulang kali."
        ].join(" ")}]}
      }}));
      micSource=micContext.createMediaStreamSource(mediaStream);
      micNode=new AudioWorkletNode(micContext,"antara-pcm");
      micSink=micContext.createGain();micSink.gain.value=0;
      micSource.connect(micNode);micNode.connect(micSink);micSink.connect(micContext.destination);
      micNode.port.onmessage=(event)=>{
        if(generation!==liveGeneration||!micEnabled||ws.readyState!==WebSocket.OPEN||!liveReady)return;
        if(ws.bufferedAmount>900000)return;
        const {pcm,level}=event.data||{};
        if(!(pcm instanceof ArrayBuffer))return;
        setWave((level||0)*4.6);
        ws.send(JSON.stringify({realtimeInput:{audio:{
          data:bytesBase64(pcm),mimeType:"audio/pcm;rate=16000"
        }}}));
      };
      sayStatus("Sambungan dibuat. Menunggu Gemini…");
      sessionTimer=setTimeout(()=>{sayStatus("Had sesi 10 minit dicapai.");closeLive("Had 10 minit.");},MAX_SESSION);
    };
    ws.onmessage=(event)=>{
      if(generation!==liveGeneration)return;
      if(typeof event.data!=="string")return;
      try{onServerMessage(JSON.parse(event.data));}catch(e){/* skip malformed chunk */}
    };
    ws.onerror=()=>{if(generation===liveGeneration)sayStatus("Sambungan Voice terganggu.");};
    ws.onclose=(event)=>{
      if(generation!==liveGeneration)return;
      const message=event.code===1000?"Sesi tamat.":"Sambungan Gemini Live terputus.";
      sayStatus(message);closeLive(message);
      if(event.code!==1000)showNotice(message+" Cuba lagi selepas semak sambungan.");
    };
  }catch(e){
    const message=e&&e.name==="NotAllowedError"?
      "Mikrofon tidak dibenarkan. Aktifkan kebenaran mikrofon untuk laman ini.":
      e&&e.name==="NotFoundError"?"Tiada mikrofon dikesan.":
      String(e&&e.message||"Voice Live gagal disambung.").slice(0,180);
    sayStatus(message);
    await closeLive(message);
    showNotice(message);
  }
}
liveButton.addEventListener("click",startLive);
stopButton.addEventListener("click",()=>closeLive("Sesi Voice dihentikan."));
micButton.addEventListener("click",()=>{
  micEnabled=!micEnabled;
  if(mediaStream)mediaStream.getAudioTracks().forEach(t=>{t.enabled=micEnabled;});
  if(!micEnabled)setWave(0);
  setButtonState();
  sayStatus(micEnabled?"Mikrofon aktif. Aku sedang mendengar.":"Mikrofon dimatikan.");
});
speakerButton.addEventListener("click",()=>{
  speakerEnabled=!speakerEnabled;
  if(!speakerEnabled)stopAudioQueue();
  setButtonState();
  sayStatus(speakerEnabled?"Suara AI dihidupkan.":"Suara AI disenyapkan.");
});
window.addEventListener("pagehide",()=>{closeDictation();closeLive();stopReading();});
document.addEventListener("visibilitychange",()=>{
  if(document.hidden&&liveActive)closeLive("Sesi dihentikan apabila laman ditinggalkan.");
});
setWave(0);setButtonState();
})();
