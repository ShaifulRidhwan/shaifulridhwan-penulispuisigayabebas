/* Fixed-step, serializable combat authority. No DOM, wall clock or random global state. */
(function(root){
const moves={
 light:{wind:.16,active:.10,recovery:.27,damage:4,range:98,stun:.19,push:15},
 heavy:{wind:.40,active:.14,recovery:.55,damage:9,range:123,stun:.33,push:42},
 special:{wind:.62,active:.20,recovery:.72,damage:18,range:245,stun:.40,push:65}
};
const balance={hp:100,speed:172,roundSeconds:90,energyCost:60,dodgeCooldown:1.2,guardMax:100};
const difficulties=[{reaction:.58,rest:1.15,read:.25},{reaction:.34,rest:.85,read:.65},{reaction:.22,rest:.62,read:.9}];
const states=['IDLE','APPROACH','REPOSITION','ATTACK','DEFEND','EVADE','COUNTERATTACK','RECOVER','SPECIAL','STUNNED'];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
class Combat {
 constructor(hero='cahaya',difficulty=1,options={}){
  this.options={mode:'arcade',boss:false,abilities:[],...options};this.hero=hero;this.difficulty=clamp(difficulty,0,2);this.seed=options.seed||771;
  this.wins=[0,0];this.round=1;this.roundState='INTRO';this.transition=1.4;this.elapsed=0;this.totalTime=0;this.result=null;this.events=[];this.hitstop=0;
  this.stats={damage:0,taken:0,blocks:0,dodges:0,maxCombo:0};this.resetRound();
 }
 fighter(x,id){return {x,y:430,vy:0,hp:100,id,facing:x<480?1:-1,state:'idle',phase:0,cooldown:0,hit:false,energy:0,guard:100,dodgeCD:0,shield:0,counter:0,combo:0,comboUntil:0,lastAttack:null,repeats:0,invulnerable:0,chain:0};}
 resetRound(){this.fighters=[this.fighter(260,this.hero),this.fighter(700,this.hero==='cahaya'?'gelap':'cahaya')];this.time=balance.roundSeconds;this.roundElapsed=0;this.aiClock=0;this.aiState='IDLE';this.aiInput={};this.aiRest=0;this.aiTurn=0;this.bossPhase=1;this.hitstop=0;}
 random(){this.seed=(Math.imul(1664525,this.seed)+1013904223)>>>0;return this.seed/4294967296;}
 ready(f){return ['idle','walk','jump','guard'].includes(f.state);}
 attack(f,kind){
  const cancelling=kind==='special'&&f.hit&&f.state==='light'&&f.phase>=moves.light.wind+moves.light.active;
  if(!moves[kind]||(!this.ready(f)&&!cancelling)||kind==='special'&&(f.cooldown>0||f.energy<balance.energyCost))return false;
  const chain=f.comboUntil>=this.elapsed?f.chain:0;
  f.finisher=kind==='heavy'&&chain>=2;f.air=f.y<425;f.state=kind;f.phase=0;f.hit=false;
  f.repeats=f.lastAttack===kind?f.repeats+1:0;f.lastAttack=kind;
  if(kind==='special'){f.protected=false;f.energy-=balance.energyCost;f.cooldown=8;}
  return true;
 }
 decide(){
  const [p,b]=this.fighters,d=Math.abs(b.x-p.x),toward=Math.sign(p.x-b.x),cfg=difficulties[this.difficulty],pm=moves[p.state];
  const recovery=pm&&p.phase>pm.wind+pm.active,threat=pm&&p.phase<pm.wind+pm.active&&d<pm.range+35;
  let state='IDLE',c={axis:0};const read=this.random()<cfg.read;
  if(b.state==='hit'||b.state==='break')state='STUNNED';
  else if(!this.ready(b)||this.aiRest>0)state='RECOVER';
  else if(threat&&read){if((p.state==='heavy'||p.state==='special'||p.repeats>1)&&b.dodgeCD<=0){state='EVADE';c={axis:-toward,dodge:true};}else{state='DEFEND';c.guard=true;}}
  else if((b.x<90||b.x>870)&&d>140){state='REPOSITION';c.axis=b.x<480?1:-1;}
  else if(recovery&&read&&d<120){state='COUNTERATTACK';c.attack='light';}
  else if(b.hp<30&&d<100&&this.aiTurn%3===0){state='REPOSITION';c.axis=-toward;}
  else if(b.energy>=60&&b.cooldown<=0&&d>110&&d<240&&(this.aiTurn%3===0||this.bossPhase===3)){state='SPECIAL';c.attack='special';}
  else if(d>105){state='APPROACH';c.axis=toward;}
  else if(this.aiTurn%5===0){state='REPOSITION';c.axis=-toward;}
  else {state='ATTACK';c.attack=p.state==='guard'||this.aiTurn%3===0?'heavy':'light';if(this.options.boss&&this.bossPhase===2&&this.aiTurn%2===0)c.jump=true;}
  this.aiTurn++;this.aiState=state;this.aiInput=c;this.aiClock=cfg.reaction*(this.options.boss&&this.bossPhase===3?.8:1);
 }
 step(dt,input={},ai=true){
  this.events=[];if(this.result)return;dt=clamp(dt,0,.0334);this.totalTime+=dt;
  if(this.roundState!=='FIGHT'){
   this.transition-=dt;if(this.transition<=0){if(this.roundState==='INTERMISSION'){this.round++;this.resetRound();this.roundState='INTRO';this.transition=1.4;}else{this.roundState='FIGHT';this.events.push({kind:'round',x:480,y:220});}}return;
  }
  if(this.hitstop>0){this.hitstop=Math.max(0,this.hitstop-dt);return;}
  this.elapsed+=dt;this.roundElapsed+=dt;this.time=this.options.mode==='training'?90:Math.max(0,90-this.roundElapsed);
  this.aiRest=Math.max(0,this.aiRest-dt);this.aiClock-=dt;
  if(ai&&this.aiClock<=0)this.decide();
  if(this.options.boss){const hp=this.fighters[1].hp,phase=hp<30?3:hp<65?2:1;if(phase>this.bossPhase){this.bossPhase=phase;this.aiInput={};this.aiRest=1;this.events.push({kind:'phase',x:480,y:210});}}
  const commands=[input,ai?this.aiInput:input.enemy||{}];
  this.fighters.forEach((f,i)=>{
   const c=commands[i]||{},o=this.fighters[1-i];f.phase+=dt;for(const key of ['cooldown','dodgeCD','shield','counter','invulnerable'])f[key]=Math.max(0,f[key]-dt);
   if(!moves[f.state]&&f.state!=='dodge')f.facing=o.x>=f.x?1:-1;
   if(f.state==='hit'&&f.phase>=f.stun||f.state==='break'&&f.phase>=.9)f.state='idle';
   if(f.state==='dodge'){f.x+=f.dodgeDir*330*dt;if(f.phase>=.34)f.state='idle';}
   if(this.ready(f)){
    if(c.dodge&&f.dodgeCD<=0&&f.y===430){f.state='dodge';f.phase=0;f.dodgeDir=c.axis||-f.facing;f.dodgeCD=balance.dodgeCooldown;f.invulnerable=f.id==='gelap'?.29:.23;f.perfect=false;}
    else if(c.guard&&f.y===430){f.state='guard';f.guard=Math.max(0,f.guard-dt*3);}
    else {
     if(f.state==='guard')f.state='idle';
     if(c.jump&&f.y===430){f.vy=-490;f.state='jump';this.events.push({kind:'jump',x:f.x,y:f.y});}
     if(c.attack&&this.attack(f,c.attack)&&i===1){this.aiRest=difficulties[this.difficulty].rest;this.aiInput={};}
     if(this.ready(f)){f.x+=(c.axis||0)*balance.speed*(f.id==='gelap'?1.06:1)*dt;f.state=f.y<430?'jump':c.axis?'walk':'idle';}
    }
   }else if(c.attack==='special')this.attack(f,'special');
   if(f.state!=='guard')f.guard=Math.min(100,f.guard+dt*14);
   f.vy+=1300*dt;f.y=Math.min(430,f.y+f.vy*dt);if(f.y===430)f.vy=0;f.x=clamp(f.x,40,920);
  });
  // Resolve attacks after both players move; locked facing permits whiff punishment.
  this.fighters.forEach((f,i)=>{
   const o=this.fighters[1-i],m=moves[f.state];if(!m)return;
   if(!f.hit&&f.phase>=m.wind&&f.phase<m.wind+m.active){
    if(f.state==='special'&&f.id==='cahaya'&&!f.protected){f.shield=2.8;f.hp=Math.min(100,f.hp+4);f.protected=true;}
    const distance=(o.x-f.x)*f.facing,range=m.range+(f.finisher?16:0);
    if(distance>=-22&&distance<range&&Math.abs(f.y-o.y)<(f.air?115:85)&&o.hp>0){
     f.hit=true;
     if(o.invulnerable>0){if(o.phase<.15&&!o.perfect){o.perfect=true;o.counter=1.1;if(this.options.abilities.includes('shadow')&&i===1)o.dodgeCD=Math.max(0,o.dodgeCD-.25);o.energy=Math.min(100,o.energy+14);if(i===1)this.stats.dodges++;this.events.push({kind:'perfect',x:o.x,y:o.y-90});}}
     else {
      const blocked=o.state==='guard'&&o.facing===-f.facing;let damage=m.damage+(f.finisher?5:0)+(f.air?1:0)+(f.counter>0?5:0);
      if(f.state==='special'&&f.id==='gelap'){damage+=4;f.hp=Math.max(1,f.hp-3);}
      if(blocked){o.guard-=f.state==='heavy'?55:f.state==='special'?65:18;damage*=o.id==='cahaya'?.10:.18;o.energy=Math.min(100,o.energy+(o.id==='cahaya'?12:8));if(i===1)this.stats.blocks++;}
      if(o.shield>0)damage*=.55;
      damage=Math.round(damage*10)/10;o.hp=Math.max(0,o.hp-damage);f.energy=Math.min(100,f.energy+(f.id==='gelap'?12:9));o.energy=Math.min(100,o.energy+4);
      if(!blocked||o.guard<=0){o.state=o.hp?(blocked?'break':'hit'):'death';o.phase=0;o.stun=m.stun;o.chain=0;o.x=clamp(o.x+f.facing*m.push,40,920);}
      f.chain=f.comboUntil>=this.elapsed?f.chain+1:1;f.comboUntil=this.elapsed+1.1;f.combo=f.chain;if(f.counter>0&&i===0&&this.options.abilities.includes('radiant'))f.energy=Math.min(100,f.energy+4);f.counter=0;
      if(i===0){this.stats.damage+=damage;this.stats.maxCombo=Math.max(this.stats.maxCombo,f.chain);}else this.stats.taken+=damage;
      this.hitstop=blocked?.025:f.finisher?.085:f.state==='heavy'?.065:.035;
      this.events.push({x:o.x,y:o.y-65,kind:blocked?(o.guard<=0?'break':'block'):f.finisher?'finisher':f.state,damage});
     }
    }
   }
   if(f.phase>=m.wind+m.active+m.recovery){f.state=f.y<430?'jump':'idle';f.protected=false;}
  });
  const [p,b]=this.fighters;if(Math.abs(p.x-b.x)<48&&Math.abs(p.y-b.y)<95&&p.state!=='dodge'&&b.state!=='dodge'){const sign=p.x<=b.x?1:-1,over=(48-Math.abs(p.x-b.x))/2;p.x=clamp(p.x-sign*over,40,920);b.x=clamp(b.x+sign*over,40,920);}
  if(this.options.mode==='training'){for(const f of this.fighters){if(f.hp<=0){f.hp=100;f.state='idle';}f.energy=Math.min(100,f.energy+dt*20);}return;}
  if(!p.hp||!b.hp||this.time<=0){const winner=p.hp===b.hp?-1:p.hp>b.hp?0:1;if(winner>=0)this.wins[winner]++;this.roundWinner=winner;
   if(this.wins.some(n=>n>=2)||this.round>=5){this.result=this.wins[0]===this.wins[1]?'SERI':this.wins[0]>this.wins[1]?'MENANG':'KALAH';this.roundState='RESULT';}
   else{this.roundState='INTERMISSION';this.transition=2.2;}
  }
 }
 snapshot(){return JSON.parse(JSON.stringify(this));}
 static restore(data){if(!data||data.version&&data.version!==3||!Array.isArray(data.fighters)||data.fighters.length!==2)throw Error('Invalid match save');if(!data.fighters.every(f=>['x','y','hp','energy','phase'].every(k=>Number.isFinite(f[k])))||!Array.isArray(data.wins)||!['INTRO','FIGHT','INTERMISSION','RESULT'].includes(data.roundState))throw Error('Corrupt match save');const c=new Combat(data.hero,data.difficulty,data.options);Object.assign(c,data);c.events=[];c.aiInput={};return c;}
}
root.AksaraCombat={Combat,moves,balance,difficulties,states};if(typeof module!=='undefined')module.exports=root.AksaraCombat;
})(typeof window!=='undefined'?window:globalThis);
