"use strict";
// Dedicated capture processor; 16 kHz mono signed PCM chunks for Gemini Live.
// Runs only while the user has explicitly started a Voice Live session.
class AntaraPcmProcessor extends AudioWorkletProcessor {
  constructor(){
    super();
    this.pcm=new Int16Array(1600);
    this.index=0;
    this.phase=0;
    this.peak=0;
  }
  process(inputs){
    const channel=inputs[0]&&inputs[0][0];
    if(!channel)return true;
    const ratio=16000/sampleRate;
    for(let i=0;i<channel.length;i++){
      const value=Math.max(-1,Math.min(1,channel[i]||0));
      this.phase+=ratio;
      this.peak=Math.max(this.peak,Math.abs(value));
      if(this.phase>=1){
        this.phase-=1;
        this.pcm[this.index++]=Math.round(value<0?value*32768:value*32767);
        if(this.index===1600){
          this.port.postMessage({pcm:this.pcm.buffer,level:this.peak},[this.pcm.buffer]);
          this.pcm=new Int16Array(1600);this.index=0;this.peak=0;
        }
      }
    }
    return true;
  }
}
registerProcessor("antara-pcm",AntaraPcmProcessor);
