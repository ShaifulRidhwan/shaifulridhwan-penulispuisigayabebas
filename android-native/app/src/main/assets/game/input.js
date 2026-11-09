/* Pointer ownership is independent of DOM rendering and combat authority. */
(function(root){
const defaults={joystickSize:100,buttonSize:100,opacity:75,floating:true,haptics:true,sound:true,deadZone:.18,offsetX:0,offsetY:0,graphics:'medium'};
function normalize(s={}){const out={...defaults};for(const k of ['joystickSize','buttonSize'])out[k]=Math.max(70,Math.min(140,+s[k]||defaults[k]));out.opacity=Math.max(25,Math.min(100,+s.opacity||75));out.deadZone=Math.max(.08,Math.min(.4,+s.deadZone||.18));for(const k of ['offsetX','offsetY'])out[k]=Math.max(0,Math.min(60,+s[k]||0));for(const k of ['floating','haptics','sound'])if(typeof s[k]==='boolean')out[k]=s[k];if(['low','medium','high'].includes(s.graphics))out.graphics=s.graphics;return out;}
class InputState {
 constructor(settings={}){this.settings=normalize(settings);this.pointers=new Map();this.keys=new Set();this.queue=[];this.stick=null;this.suspended=true;}
 down(id,action,x=0,y=0,center=null){if(this.suspended||this.pointers.has(id))return false;if(action==='stick'){if(this.stick)return false;const origin=this.settings.floating?{x,y}:center||{x,y};this.stick={id,x:origin.x,y:origin.y,dx:0,dy:0};this.pointers.set(id,{action});this.move(id,x,y);return true;}if(!['light','heavy','jump','special'].includes(action))return false;this.pointers.set(id,{action});if(action!=='jump'){this.queue.push({action,until:performance.now()+300});this.queue=this.queue.slice(-8);}return true;}
 move(id,x,y){if(this.suspended||this.stick?.id!==id)return;const r=48*this.settings.joystickSize/100,dx=x-this.stick.x,dy=y-this.stick.y,n=Math.max(1,Math.hypot(dx,dy)/r);this.stick.dx=dx/n;this.stick.dy=dy/n;}
 up(id){this.pointers.delete(id);if(this.stick?.id===id)this.stick=null;}
 cancel(id){this.up(id);this.queue=[];}
 reset(){this.pointers.clear();this.keys.clear();this.queue=[];this.stick=null;}
 suspend(){this.suspended=true;this.reset();}
 resume(){this.reset();this.suspended=false;}
 key(key,down){if(this.suspended)return;if(down){if(!this.keys.has(key)&&['z','x','c'].includes(key))this.queue.push({action:{z:'light',x:'heavy',c:'special'}[key],until:performance.now()+300});this.keys.add(key);}else this.keys.delete(key);}
 sample(fighter=null,now=performance.now()){
  if(this.suspended)return {axis:0,jump:false,attack:null,guard:false,dodge:false};
  const held=[...this.pointers.values()].map(p=>p.action),r=48*this.settings.joystickSize/100;
  const axis=this.keys.has('ArrowLeft')?-1:this.keys.has('ArrowRight')?1:this.stick&&Math.abs(this.stick.dx)/r>=this.settings.deadZone?Math.sign(this.stick.dx):0;
  this.queue=this.queue.filter(q=>q.until>=now);
  const ready=!fighter||['idle','walk','jump','guard'].includes(fighter.state)||(fighter.state==='light'&&fighter.hit&&fighter.phase>=.26&&this.queue[0]?.action==='special');
  let attack=ready&&this.queue.length?this.queue.shift().action:null;
  const guard=(held.includes('light')||this.keys.has('z'))&&(held.includes('heavy')||this.keys.has('x'));
  const jump=held.includes('jump')||this.keys.has('ArrowUp');
  const dodge=!!fighter&&axis*fighter.facing<0&&jump;
  if(guard){attack=null;this.queue=[];}
  return {axis,jump:jump&&!dodge,attack,guard,dodge};
 }
}
root.AksaraInput={InputState,defaults,normalize};if(typeof module!=='undefined')module.exports=root.AksaraInput;
})(typeof window!=='undefined'?window:globalThis);
