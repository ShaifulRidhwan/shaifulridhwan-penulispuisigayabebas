(function(){
"use strict";
/* Opt-in voice recording next to Send. Separate from real-time Live.
   Nothing is captured until microphone button is pressed. Audio stays in
   memory and is sent only when user presses Stop & Send (or 20s limit). */
const $=id=>document.getElementById(id);
const panel=$("voiceFallback"),min=$("voiceFallbackMinimize"),start=$("voiceFallbackStart"),
 stop=$("voiceFallbackStop"),retry=$("voiceFallbackRetry"),speak=$("voiceFallbackSpeak"),
 status=$("voiceFallbackStatus"),live=$("voiceLive");
if(!panel||!min||!start||!stop||!retry||!speak||!status)return;
let stream=null,recorder=null,timer=null,chunks=[],reply="",sendOnStop=false,busy=false,lastBlob=null;
const statusText=x=>{status.textContent=String(x||"").slice(0,2600);};
function collapse(value){
 panel.hidden=false;
 panel.classList.toggle("is-collapsed",value);
 min.setAttribute("aria-expanded",String(!value));
 min.setAttribute("aria-label",value?"Buka panel suara":"Minimumkan panel suara");
 min.textContent=value?"Buka":"Minimumkan";
}
function hint(message,opened=false){collapse(!opened);statusText(message);}
min.addEventListener("click",()=>collapse(!panel.classList.contains("is-collapsed")));
window.addEventListener("ba:voice-live-failed",()=>{
 if(!recorder&&!busy)hint("Voice Live tidak tersedia. Kau masih boleh merakam soalan melalui mikrofon di sebelah Hantar.",false);
});
function cleanup(){
 if(timer){clearTimeout(timer);timer=null;}
 if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
 recorder=null;
}
function toggleRecording(isRecording){
 start.hidden=isRecording;start.disabled=isRecording||busy||Boolean(live?.getAttribute("aria-pressed")==="true");
 start.setAttribute("aria-pressed",String(isRecording));
 stop.hidden=!isRecording;stop.disabled=!isRecording;
}
function base64(bytes){
 let output="";
 for(let i=0;i<bytes.length;i+=8192)output+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(output);
}
function readReply(){
 if(!reply||!window.speechSynthesis||!window.SpeechSynthesisUtterance){
  statusText("Jawapan teks tersedia tetapi bacaan suara tidak disokong pada pelayar ini.");return;
 }
 try{
  window.speechSynthesis.cancel();
  const utterance=new window.SpeechSynthesisUtterance(reply.slice(0,2400));
  utterance.lang="ms-MY";utterance.rate=1;utterance.pitch=.95;
  const voices=window.speechSynthesis.getVoices();
  const voice=voices.find(v=>/^ms[-_]/i.test(v.lang)&&/male|lelaki/i.test(v.name))
   ||voices.find(v=>/^ms[-_]/i.test(v.lang));
  if(voice)utterance.voice=voice;
  window.speechSynthesis.speak(utterance);
 }catch(_){statusText("Jawapan teks tersedia, tetapi suara bacaan tidak berjaya.");}
}
speak.addEventListener("click",readReply);
async function submitAudio(blob){
 if(!blob||blob.size<32||blob.size>2400000){
  hint("Rakaman kosong atau terlalu besar. Cuba kurang daripada 20 saat.",true);return;
 }
 busy=true;toggleRecording(false);start.disabled=true;retry.disabled=true;
 hint("Sedang fahami audio dan sediakan jawapan…",true);
 const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),20000);
 try{
  const mime=(blob.type||"audio/webm").split(";")[0].toLowerCase();
  if(!["audio/webm","audio/mp4","audio/ogg"].includes(mime))throw Error("Format audio tidak disokong.");
  const data=base64(new Uint8Array(await blob.arrayBuffer()));
  const res=await fetch("/.netlify/functions/bilik-antara",{
   method:"POST",credentials:"same-origin",cache:"no-store",
   headers:{"Content-Type":"application/json"},signal:ctl.signal,
   body:JSON.stringify({
    voiceFallback:true,
    question:"Jawab soalan dalam audio dengan ringkas, jelas dan dalam Bahasa Melayu Malaysia santai. Jika audio tidak jelas, minta pengguna ulang.",
    media:{mimeType:mime,name:"rakaman-suara",data}
   })
  });
  const result=await res.json().catch(()=>({}));
  if(!res.ok||typeof result.reply!=="string"||!result.reply.trim()){
   const error=String(result.error||"Tiada jawapan AI.");
   const failure=new Error(error);failure.http=res.status;throw failure;
  }
  reply=result.reply.trim();
  statusText("Jawapan AI: "+reply);
  speak.hidden=!window.speechSynthesis;speak.disabled=!window.speechSynthesis;
  lastBlob=null;retry.hidden=true;
  if(!speak.disabled)readReply();
 }catch(e){
  const transient=e?.name==="AbortError"||[502,503,504,429].includes(e?.http);
  hint(e?.name==="AbortError"?"AI mengambil masa terlalu lama. Cuba lagi tanpa rakam semula.":
   "Rakaman belum dapat diproses: "+String(e.message||e).slice(0,160)+
   (transient?" Tekan Cuba lagi tanpa merakam semula.":""),
   true);
  retry.textContent="Cuba lagi tanpa rakam semula";retry.hidden=!transient;retry.disabled=!transient;
 }finally{clearTimeout(timeout);busy=false;toggleRecording(false);}
}
function finish(send){
 if(!recorder||recorder.state!=="recording")return;
 sendOnStop=send;stop.disabled=true;
 try{recorder.stop();}catch(_){cleanup();toggleRecording(false);}
}
start.addEventListener("click",async()=>{
 if(recorder||busy)return;
 if(live?.getAttribute("aria-pressed")==="true"){
  hint("Tamatkan sesi Voice Live dahulu sebelum merakam soalan.",false);return;
 }
 if(!window.MediaRecorder||!navigator.mediaDevices?.getUserMedia){
  hint("Pelayar tidak menyokong rakaman. Cuba fungsi Cakap jadi teks dalam panel suara.",true);return;
 }
 hint("Meminta kebenaran mikrofon…",true);
 reply="";lastBlob=null;retry.hidden=true;retry.disabled=true;retry.textContent="Cuba lagi tanpa rakam semula";speak.hidden=true;speak.disabled=true;
 try{
  stream=await navigator.mediaDevices.getUserMedia({
   audio:{echoCancellation:true,noiseSuppression:true,channelCount:1},video:false
  });
  const types=["audio/webm;codecs=opus","audio/mp4","audio/ogg;codecs=opus","audio/webm"];
  const type=types.find(t=>window.MediaRecorder.isTypeSupported?.(t))||"";
  recorder=new window.MediaRecorder(stream,type?{mimeType:type,audioBitsPerSecond:32000}:{audioBitsPerSecond:32000});
  chunks=[];sendOnStop=false;
  recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
  recorder.onstop=()=>{
   const blob=new Blob(chunks,{type:recorder?.mimeType||type||"audio/webm"});
   const shouldSend=sendOnStop;chunks=[];cleanup();toggleRecording(false);
   if(shouldSend){lastBlob=blob;submitAudio(blob);}
   else {lastBlob=blob;retry.hidden=false;retry.disabled=false;retry.textContent="Hantar rakaman";hint("Had rakaman 20 saat dicapai. Tekan Hantar rakaman untuk menghantar. Audio belum dihantar.",true);}
  };
  recorder.onerror=()=>{sendOnStop=false;cleanup();toggleRecording(false);hint("Pelayar gagal merakam audio.",true);};
  recorder.start(700);toggleRecording(true);
  statusText("Sedang merakam… tekan butang berhenti di sebelah Hantar untuk menghantar. Maksimum 20 saat.");
  timer=setTimeout(()=>finish(false),20000); // Never upload a recording automatically when the time limit ends.
 }catch(e){
  cleanup();toggleRecording(false);
  hint(e?.name==="NotAllowedError"?"Kebenaran mikrofon ditolak. Benarkan akses mikrofon untuk laman ini.":
   "Rakaman tidak dapat dimulakan: "+String(e.message||e).slice(0,140),true);
 }
});
stop.addEventListener("click",()=>finish(true));
retry.addEventListener("click",()=>{if(lastBlob&&!busy)submitAudio(lastBlob);});
window.addEventListener("pagehide",()=>{
 if(recorder?.state==="recording")finish(false);
 cleanup();lastBlob=null;
 try{window.speechSynthesis?.cancel?.();}catch(_){}
});
toggleRecording(false);
})();
