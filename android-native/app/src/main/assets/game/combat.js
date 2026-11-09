(function(root){
const moves={light:{wind:.10,active:.12,recovery:.22,damage:9,range:95},heavy:{wind:.28,active:.15,recovery:.40,damage:19,range:112},special:{wind:.2,active:.18,recovery:.4,damage:24,range:340}};
class Combat {
 constructor(hero='cahaya',difficulty=1){this.fighters=[this.fighter(260,hero),this.fighter(700,hero==='cahaya'?'gelap':'cahaya')];this.time=90;this.elapsed=0;this.difficulty=difficulty;this.result=null;this.aiClock=0;this.events=[];}
 fighter(x,id){return {x,y:430,vy:0,hp:100,id,facing:x<480?1:-1,state:'idle',phase:0,cooldown:0,hit:false};}
 attack(f,kind){if(!moves[kind]||!['idle','walk','jump'].includes(f.state)||kind==='special'&&f.cooldown>0)return;f.state=kind;f.phase=0;f.hit=false;if(kind==='special')f.cooldown=5;}
 step(dt,input={},ai=true){if(this.result)return;dt=Math.min(dt,.0334);this.elapsed+=dt;this.time=Math.max(0,90-this.elapsed);this.events=[];
 if(ai){this.aiClock-=dt;if(this.aiClock<=0){this.aiClock=[.6,.35,.18][this.difficulty];const b=this.fighters[1],p=this.fighters[0],d=Math.abs(b.x-p.x);this.aiInput={axis:d>70?Math.sign(p.x-b.x):0,attack:d<90?(this.difficulty===2?'heavy':'light'):d<330&&this.difficulty>0?'special':null,jump:this.difficulty===2&&p.state==='special'};}}
 this.fighters.forEach((f,i)=>{const c=i===0?input:(ai?this.aiInput||{}:input.enemy||{}),o=this.fighters[1-i];f.cooldown=Math.max(0,f.cooldown-dt);f.phase+=dt;f.facing=o.x>=f.x?1:-1;
 if(f.state==='hit'&&f.phase>.25)f.state='idle';
 if(['idle','walk','jump'].includes(f.state)){if(c.jump&&f.y===430){f.vy=-530;f.state='jump';}if(c.attack)this.attack(f,c.attack);if(['idle','walk','jump'].includes(f.state)){f.x+=(c.axis||0)*(f.id==='cahaya'?245:205)*dt;f.state=f.y<430?'jump':c.axis?'walk':'idle';}}
 f.vy+=1300*dt;f.y=Math.min(430,f.y+f.vy*dt);if(f.y===430)f.vy=0;f.x=Math.max(40,Math.min(920,f.x));
 const m=moves[f.state];if(m){if(!f.hit&&f.phase>=m.wind&&f.phase<m.wind+m.active&&Math.abs(f.x-o.x)<m.range&&Math.abs(f.y-o.y)<85&&o.hp>0){f.hit=true;o.hp=Math.max(0,o.hp-m.damage*(f.id==='gelap'?1.1:1));o.state=o.hp?'hit':'death';o.phase=0;o.x=Math.max(40,Math.min(920,o.x+f.facing*28));this.events.push({x:o.x,y:o.y-65,kind:f.state});}if(f.phase>=m.wind+m.active+m.recovery)f.state=f.y<430?'jump':'idle';}
 });
 const [p,b]=this.fighters;if(Math.abs(p.x-b.x)<50&&Math.abs(p.y-b.y)<95){const dir=p.x<=b.x?1:-1;p.x-=dir*2;b.x+=dir*2;}
 if(!p.hp||!b.hp||this.time<=0)this.result=p.hp===b.hp?'SERI':p.hp>b.hp?'MENANG':'KALAH';
 }
}root.AksaraCombat={Combat,moves};if(typeof module!=='undefined')module.exports=root.AksaraCombat;
})(typeof window!=='undefined'?window:globalThis);
