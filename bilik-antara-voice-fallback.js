(function(){
"use strict";
/* Recording fallback, NOT Gemini Live. Only enabled after an explicit Live
 * failure. Audio lives in memory and is sent only on user request. */
const $=id=>document.getElementById(id);
const panel=$("voiceFallback"),start=$("voiceFallbackStart"),stop=$("voiceFallbackStop"),
  speak=$("voiceFallbackSpeak"),status=$("voiceFallbackStatus");
if(!panel||!start||!stop||!speak||!status)return;
let stream=null,recorder=null,timer=null,chunks=[],reply="",sendOnStop=false,busy=false;
const set=t=>{status.textContent=String(t||"").slice(0,2800);};
function cleanup(){
 if(timer){clearTimeout(timer);timer=null;}
 if(stream){stream.getTracks().forEach(track=>track.stop());stream=null;}
 recorder=null;
}
function showFallback(){
 if(!window.MediaRecorder||!navigator.mediaDevices?.getUserMedia){
  set("Rakaman sandaran tidak disokong pelayar ini.");return;
 }
 panel.hidden=false;
 set("Voice Live belum tersedia. Mod sandaran boleh merakam soalan maksimum 20 saat jika kau memilihnya.");
}
window.addEventListener("ba:voice-live-failed",showFallback);
function readReply(){
 if(!reply||!window.speechSynthesis||!window.SpeechSynthesisUtterance){
  set("Jawapan teks tersedia. Bacaan suara tidak disokong pada pelayar ini.");return;
 }
 try{
  window.speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(reply.slice(0,2400));
  utterance.lang="ms-MY";utterance.rate=1;utterance.pitch=.95;
  const voices=window.speechSynthesis.getVoices();
  const voice=voices.find(v=>/^ms[-_]/i.test(v.lang)&&/male|lelaki/i.test(v.name))
    ||voices.find(v=>/^ms[-_]/i.test(v.lang));
  if(voice)utterance.voice=voice;
  window.speechSynthesis.speak(utterance);
 }catch(_){set("Jawapan teks tersedia, tetapi pelayar gagal membacakannya.");}
}
speak.addEventListener("click",readReply);
function base64(bytes){
 let out="";
 for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(out);
}
async function submit(blob){
 if(!blob||blob.size<32||blob.size>2500000){set("Rakaman terlalu pendek atau besar. Maksimum 20 saat.");return;}
 busy=true;start.disabled=true;stop.disabled=true;
 set("Menghantar rakaman kepada Gemini untuk menjawab soalan…");
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),28000);
 try{
  const mime=(blob.type||"audio/webm").split(";")[0].toLowerCase();
  if(!["audio/webm","audio/mp4","audio/ogg"].includes(mime))
   throw Error("Format audio tidak disokong pelayar atau backend.");
  const b64=base64(new Uint8Array(await blob.arrayBuffer()));
  const res=await fetch("/.netlify/functions/bilik-antara",{
   method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
   signal:controller.signal,body:JSON.stringify({
    question:"Dengar rakaman suara ini dan jawab soalan pengguna dalam Bahasa Melayu Malaysia santai. Jangan mereka kandungan audio yang tidak jelas. Jawab terus dengan ringkas. Ini suara sandaran, bukan Voice Live.",
    media:{mimeType:mime,name:"rakaman-suara",data:b64}
   })
  });
  const body=await res.json().catch(()=>({}));
  if(!res.ok||typeof body.reply!=="string"||!body.reply.trim())throw Error(body.error||"Tiada jawapan suara.");
  reply=body.reply.trim();
  set("Jawapan AI: "+reply);
  speak.hidden=!window.speechSynthesis;speak.disabled=!window.speechSynthesis;
  if(!speak.disabled)readReply();
 }catch(e){
  set(e.name==="AbortError"?"Rakaman mengambil masa terlalu lama untuk diproses.":
    "Tak dapat memproses rakaman: "+String(e.message||e).slice(0,170));
 }finally{clearTimeout(timeout);busy=false;start.disabled=false;}
}
function endRecording(send){
 if(!recorder||recorder.state!=="recording")return;
 sendOnStop=Boolean(send);stop.disabled=true;
 try{recorder.stop();}catch(_){cleanup();start.disabled=false;}
}
start.addEventListener("click",async()=>{
 if(recorder||busy)return;
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){
  set("Pelayar tidak menyokong rakaman. Cuba fungsi Cakap.");return;
 }
 reply="";speak.hidden=true;speak.disabled=true;
 try{
  stream=await navigator.mediaDevices.getUserMedia({
   audio:{echoCancellation:true,noiseSuppression:true,channelCount:1},video:false
  });
  const types=["audio/webm;codecs=opus","audio/mp4","audio/ogg;codecs=opus","audio/webm"];
  const type=types.find(x=>MediaRecorder.isTypeSupported(x))||"";
  recorder=new MediaRecorder(stream,type?{mimeType:type,audioBitsPerSecond:32000}:{audioBitsPerSecond:32000});
  chunks=[];sendOnStop=false;
  recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
  recorder.onstop=()=>{
   const blob=new Blob(chunks,{type:recorder?.mimeType||type||"audio/webm"});
   const shouldSend=sendOnStop;chunks=[];cleanup();
   start.disabled=false;stop.disabled=true;
   if(shouldSend)submit(blob);else set("Rakaman dibatalkan. Tiada audio dihantar.");
  };
  recorder.onerror=()=>{sendOnStop=false;set("Pelayar gagal merakam audio.");cleanup();start.disabled=false;};
  recorder.start(1000);
  start.disabled=true;stop.disabled=false;
  set("Sedang merakam. Tekan Henti & hantar apabila selesai. Maksimum 20 saat.");
  timer=setTimeout(()=>endRecording(true),20000);
 }catch(e){
  cleanup();start.disabled=false;
  set(e.name==="NotAllowedError"?"Mikrofon tidak dibenarkan. Berikan kebenaran pada pelayar.":
    "Rakaman tidak dapat dimulakan: "+String(e.message||e).slice(0,130));
 }
});
stop.addEventListener("click",()=>endRecording(true));
window.addEventListener("pagehide",()=>{
 if(recorder?.state==="recording")endRecording(false);
 cleanup();try{window.speechSynthesis?.cancel();}catch(_){}
});
})();