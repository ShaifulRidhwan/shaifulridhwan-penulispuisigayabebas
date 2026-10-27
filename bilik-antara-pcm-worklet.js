"use strict";
// Mobile microphone -> 16 kHz mono 16-bit signed PCM for Gemini Live.
// Anti-alias area averaging replaces the old nearest-neighbour conversion.
// Each 640-sample chunk is 40 ms, keeping latency low without JS copies of
// long recordings. Audio is never captured until Voice Live is started.
class AntaraPcmProcessor extends AudioWorkletProcessor {
  constructor(){
    super();
    this.pcm=new Int16Array(640);
    this.index=0;
    this.windowSamples=sampleRate/16000;
    this.windowFill=0;
    this.integral=0;
    this.power=0;
  }
  process(inputs){
    const channel=inputs[0]&&inputs[0][0];
    if(!channel)return true;
    for(let i=0;i<channel.length;i++){
      const value=Math.max(-1,Math.min(1,Number(channel[i])||0));
      let remaining=1;
      while(remaining>1e-7){
        const take=Math.min(remaining,this.windowSamples-this.windowFill);
        this.integral+=value*take;
        this.windowFill+=take;
        remaining-=take;
        if(this.windowFill>=this.windowSamples-1e-7){
          const average=Math.max(-1,Math.min(1,this.integral/this.windowSamples));
          this.pcm[this.index++]=Math.round(average<0?average*32768:average*32767);
          this.power+=average*average;
          this.integral=0;this.windowFill=0;
          if(this.index===640){
            this.port.postMessage({pcm:this.pcm.buffer,level:Math.sqrt(this.power/640)},[this.pcm.buffer]);
            this.pcm=new Int16Array(640);this.index=0;this.power=0;
          }
        }
      }
    }
    return true;
  }
}
registerProcessor("antara-pcm",AntaraPcmProcessor);
