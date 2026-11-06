"use strict";
/* No live Google credentials: this is an in-browser integration test of the
   ORIGINAL mic/speaker/end click handlers and UI state via a fake Live transport.
   The real provider remains untested. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const ROOT=process.env.AUDIT_BASE||"http://127.0.0.1:4177";

async function testViewport(browser,name,viewport) {
 const context=await browser.newContext({
  viewport,deviceScaleFactor:1,isMobile:name!=="desktop",hasTouch:name!=="desktop",
  permissions:["microphone"]
 });
 const page=await context.newPage();
 const errors=[];
 let tokenRequests=0;
 let tokenFailure=false;
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/.netlify/functions/bilik-antara-live-token",async route=>{
  tokenRequests++;
  await route.fulfill(tokenFailure?{status:503,contentType:"application/json",
    body:JSON.stringify({error:"Token Voice mock ditolak.",reason:"TOKEN_HTTP_503"})}:
    {status:200,contentType:"application/json",
    body:JSON.stringify({token:"browser-test-token",model:"gemini-2.0-flash-live"})});
 });
 await page.addInitScript(()=>{
  const state={tracks:[],sockets:[],gains:[],stopCount:0};
  class FakeTrack {
   kind="audio";enabled=true;stopped=false;
   getSettings(){return {echoCancellation:true,noiseSuppression:true};}
   addEventListener(){}
   stop(){this.stopped=true;state.stopCount++;}
  }
  const fakeMedia={
   getUserMedia:async()=>{
    const track=new FakeTrack();
    state.tracks.push(track);
    return {getAudioTracks:()=>[track],getTracks:()=>[track]};
   }
  };
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:fakeMedia});
  class FakeAudioContext{
   constructor(){
    this.currentTime=0;this.sampleRate=48000;this.destination={};
    this.state="running";this.audioWorklet={addModule:async()=>{}};
   }
   async resume(){this.state="running";}
   async suspend(){this.state="suspended";}
   async close(){this.state="closed";}
   addEventListener(){}
   createGain(){
    const gain={value:1,cancelScheduledValues(){},setTargetAtTime(v){this.value=v;}};
    state.gains.push(gain);
    return {gain,connect(){},disconnect(){}};
   }
   createAnalyser(){return {fftSize:512,smoothingTimeConstant:0,
    connect(){},disconnect(){},getFloatTimeDomainData(arr){arr.fill(0)},
    getByteTimeDomainData(arr){arr.fill(128)},getByteFrequencyData(arr){arr.fill(0)}};}
   createMediaStreamSource(){return {connect(){},disconnect(){}};}
   createBuffer(channels,length,rate){return {getChannelData:()=>new Float32Array(length),duration:length/rate};}
   createBufferSource(){return {buffer:null,connect(){},disconnect(){},
    start(){this.onended?.();},stop(){}};}
  }
  class FakeWorkletNode {
   constructor(){this.port={onmessage:null,postMessage(){}};}
   connect(){}disconnect(){}
  }
  class FakeSocket{
   static OPEN=1;static CONNECTING=0;static CLOSED=3;
   constructor(url){
    this.url=url;this.readyState=0;this.bufferedAmount=0;this.sent=[];
    state.sockets.push(this);
    setTimeout(()=>{
      if(this.readyState!==0)return;
      this.readyState=1;
      this.onopen?.({});
    },25);
   }
   send(raw){
    const msg=JSON.parse(raw);
    this.sent.push(msg);
    if(msg.setup){
      setTimeout(()=>{
       if(this.readyState===1)this.onmessage?.({data:JSON.stringify({setupComplete:{}})});
      },1150);
    }
   }
   close(){
    this.readyState=3;
    this.onclose?.({code:1000});
   }
   drop(){
    this.readyState=3;
    this.onclose?.({code:1006});
   }
  }
  Object.defineProperty(window,"AudioContext",{configurable:true,value:FakeAudioContext});
  Object.defineProperty(window,"AudioWorkletNode",{configurable:true,value:FakeWorkletNode});
  Object.defineProperty(window,"WebSocket",{configurable:true,value:FakeSocket});
  window.__voiceControlsTest=state;
 });
 try {
  await page.goto(ROOT+"/bilik-antara.html?voice-ui=3d",
    {waitUntil:"domcontentloaded",timeout:35000});
  await page.waitForSelector(".voice-v4-brand",{state:"attached",timeout:15000});
  assert.equal(new URL(page.url()).search,"?voice-ui=3d",name+" requires opt-in V4 Live");
  assert.equal(await page.locator("#voiceLive").getAttribute("data-voice-preview"),null,
    name+" default must never enter UI-only preview mode");
  const panel=page.locator("#voicePanel");
  assert.equal(await panel.isVisible(),false,name+" panel hidden before call");
  await page.locator("#voiceLive").click();
  await panel.waitFor({state:"visible",timeout:4500});
  await page.waitForFunction(()=>window.BilikAntaraVoiceDiagnostics?.snapshot()?.sessionActive===true);
  // Do not show 'connected' or advance the clock before setupComplete.
  await page.waitForTimeout(300);
  assert.equal(await page.locator(".voice-x-timer").innerText(),"00:00",name+" timer started before handshake");
  assert.notEqual(await page.locator(".voice-x-live-text").innerText(),"TERSAMBUNG",name+" false connected");
  await page.waitForFunction(()=>window.BilikAntaraVoiceDiagnostics?.snapshot()?.connected===true,null,{timeout:5000});
  await page.waitForFunction(()=>document.querySelector(".voice-x-live-text")?.textContent==="TERSAMBUNG",null,{timeout:2000});
  const initial=await page.locator(".voice-x-timer").innerText();
  assert.match(initial,/^\d{2,}:\d{2}$/,name+" clock format");
  await page.waitForFunction(()=>document.querySelector(".voice-x-timer")?.textContent!=="00:00",null,{timeout:4000});
  const secondsAt=await page.locator(".voice-x-timer").innerText();
  assert.ok(parseInt(secondsAt.split(":")[1],10)>=1,name+" clock not advancing after handshake");
  // Actual native microphone handler must change the audio track, not just a visual mask.
  await page.locator("#voiceMuteMic").click();
  let state=await page.evaluate(()=>({snap:BilikAntaraVoiceDiagnostics.snapshot(),
   track:__voiceControlsTest.tracks.at(-1),
   sent:__voiceControlsTest.sockets.at(-1).sent}));
  assert.equal(state.snap.micEnabled,false,name+" native mic flag");
  assert.equal(state.track.enabled,false,name+" actual media track wasn't muted");
  assert.equal(await page.locator("#voiceMuteMic").getAttribute("aria-pressed"),"false");
  assert.ok(state.sent.some(x=>x.realtimeInput?.audioStreamEnd===true),name+" mic stream end notification");
  await page.locator("#voiceMuteMic").click();
  state=await page.evaluate(()=>({snap:BilikAntaraVoiceDiagnostics.snapshot(),
   track:__voiceControlsTest.tracks.at(-1)}));
  assert.equal(state.snap.micEnabled,true,name+" mic not restored");
  assert.equal(state.track.enabled,true,name+" media track not restored");
  assert.equal(await page.locator("#voiceMuteMic").getAttribute("aria-pressed"),"true");

  await page.locator("#voiceMuteSpeaker").click();
  assert.equal((await page.evaluate(()=>BilikAntaraVoiceDiagnostics.snapshot())).speakerEnabled,false);
  assert.equal(await page.locator("#voiceMuteSpeaker").getAttribute("aria-pressed"),"false");
  await page.locator("#voiceMuteSpeaker").click();
  assert.equal((await page.evaluate(()=>BilikAntaraVoiceDiagnostics.snapshot())).speakerEnabled,true);
  assert.equal(await page.locator("#voiceMuteSpeaker").getAttribute("aria-pressed"),"true");

  await page.locator("#voiceVolume").evaluate(el=>{
    el.value="70";
    el.dispatchEvent(new Event("input",{bubbles:true}));
  });
  assert.equal(await page.locator("#voiceVolumeValue").innerText(),"70%");
  assert.equal((await page.evaluate(()=>BilikAntaraVoiceDiagnostics.snapshot())).volumeGain,0.7);

  const initialTrackCount=await page.evaluate(()=>__voiceControlsTest.tracks.length);
  await page.locator(".voice-x-end").click();
  await panel.waitFor({state:"hidden",timeout:5000});
  state=await page.evaluate(()=>({snap:BilikAntaraVoiceDiagnostics.snapshot(),
   stopped:__voiceControlsTest.tracks.at(-1)?.stopped,
   closed:__voiceControlsTest.sockets.at(-1)?.readyState}));
  assert.equal(state.snap.sessionActive,false,name+" end button left active session");
  assert.equal(state.snap.connected,false,name+" end button left connected");
  assert.equal(state.stopped,true,name+" end button didn't stop microphone stream");
  assert.equal(state.closed,3,name+" end button didn't close websocket");
  assert.equal(tokenRequests,1,name+" unexpected token count first call");

  // A new call must reset the timer and preserve existing native controls.
  await page.locator("#voiceLive").click();
  await panel.waitFor({state:"visible",timeout:5000});
  await page.waitForFunction(()=>__voiceControlsTest.tracks.length>1,null,{timeout:3000});
  assert.equal(await page.locator(".voice-x-timer").innerText(),"00:00",name+" timer didn't reset for second session");
  assert.equal(await page.locator("#voiceMuteMic").getAttribute("aria-pressed"),"true");
  assert.equal(await page.locator("#voiceMuteSpeaker").getAttribute("aria-pressed"),"true");
  await page.locator("#voiceStop").click();
  await panel.waitFor({state:"hidden",timeout:5000});
  assert.ok((await page.evaluate(()=>__voiceControlsTest.stopCount))>=2,name+" header X didn't stop mic");
  assert.equal(tokenRequests,2,name+" token count after two sessions");
  assert.equal((await page.evaluate(()=>BilikAntaraVoiceDiagnostics.snapshot())).sessionActive,false);
  assert.equal(await page.locator("#voiceLive").isEnabled(),true,name+" call button not restored");
  assert.deepEqual(errors,[],name+" JS errors "+errors.join("; "));
  console.log("Voice real-control mock "+name+" PASS: end, mic, speaker, volume, status, timer, restart.");
 }finally{await context.close();}
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  await testViewport(browser,"desktop",{width:1280,height:800});
  await testViewport(browser,"mobile",{width:390,height:844});
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
