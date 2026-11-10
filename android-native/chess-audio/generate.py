"""Original AKSARA chess sound design. No samples or third-party recordings."""
from pathlib import Path
import math, random, struct, wave
out=Path(__file__).resolve().parents[1]/'app/src/main/assets/chess'
out.mkdir(parents=True,exist_ok=True)
for name,freq,duration in [('light_step',660,.20),('shadow_step',165,.25),('capture',82.4,.34)]:
    rng=random.Random(19)
    samples=[]
    for i in range(int(24000*duration)):
        t=i/24000;envelope=(1-math.exp(-t*160))*math.exp(-t*14)
        tone=(math.sin(2*math.pi*freq*t)+.25*math.sin(2*math.pi*freq*2.01*t))*.28
        if name=='capture':tone+=rng.uniform(-1,1)*math.exp(-t*25)*.18
        samples.append(int(max(-1,min(1,tone*envelope))*32767))
    with wave.open(str(out/(name+'.wav')),'wb') as f:
        f.setparams((1,2,24000,len(samples),'NONE','not compressed'))
        f.writeframes(struct.pack('<'+'h'*len(samples),*samples))
