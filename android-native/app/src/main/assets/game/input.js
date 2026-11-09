/* Pointer ownership is independent of DOM rendering and combat authority. */
(function(root){
const defaults={joystickSize:100,buttonSize:100,opacity:75,floating:true,haptics:true,deadZone:.18,offsetX:0,offsetY:0,graphics:'medium'};
function normalize(s={}){const out={...defaults};for(const k of ['joystickSize','buttonSize'])out[k]=Math.max(70,Math.min(140,+s[k]||defaults[k]));out.opacity=Math.max(30,Math.min(100,+s.opacity||75));out.deadZone=Math.max(.08,Math.min(.4,+s.deadZone||.18));for(const k of ['offsetX','offsetY'])out[k]=Math.max(0,Math.min(60,+s[k]||0));for(const k of ['floating','haptics'])if(typeof s[k]==='boolean')out[k]=s[k];if(['low','medium','high'].includes(s.graphics))out.graphics=s.graphics;return out;}
class InputState {
 constructor(settings={}){this.settings=normalize(settings);this.pointers=new Map();this.keys=new Set();this.queue=[];this.stick=null;this.suspended=true;}
 down(id,action,x=0,y=0,center=null){if(this.suspended||this.pointers.has(id))return false;if(action==='stick'){if(this.stick)return false;const origin=this.settings.floating?{x,y}:center||{x,y};this.stick={id,x:origin.x,y:origin.y,dx:0,dy:0};this.pointers.set(id,{action});this.move(id,x,y);return true;}if(!['light','heavy','jump','special'].includes(action))return false;this.pointers.set(id,{action});if(action!=='jump'){this.queue.push({action,until:performance.now()+160});this.queue=this.queue.slice(-8);}return true;}
 move(id,x,y){if(this.suspended||this.stick?.id!==id)return;const r=48*this.settings.joystickSize/100,dx=x-this.stick.x,dy=y-this.stick.y,n=Math.max(1,Math.hypot(dx,dy)/r);this.stick.dx=dx/n;this.stick.dy=dy/n;}
 up(id){this.pointers.delete(id);if(this.stick?.id===id)this.stick=null;}
 cancel(id){this.up(id);this.queue=[];}
 reset(){this.pointers.clear();this.keys.clear();this.queue=[];this.stick=null;}
 suspend(){this.suspended=true;this.reset();}
 resume(){this.reset();this.suspended=false;}
 key(key,down){if(this.suspended)return;if(down)this.keys.add(key);else this.keys.delete(key);}
 sample(fighter=null,now=performance.now()){
  if(this.suspended)return {axis:0,jump:false,attack:null};
  const held=[...this.pointers.values()].map(p=>p.action),r=48*this.settings.joystickSize/100;
  const axis=this.keys.has('ArrowLeft')?-1:this.keys.has('ArrowRight')?1:this.stick&&Math.abs(this.stick.dx)/r>=this.settings.deadZone?Math.sign(this.stick.dx):0;
  this.queue=this.queue.filter(q=>q.until>=now);
  const ready=!fighter||['idle','walk','jump'].includes(fighter.state);
  let attack=ready&&this.queue.length?this.queue.shift().action:null;
  if(!attack)attack=[...held].reverse().find(a=>['light','heavy','special'].includes(a))||(['z','x','c'].find(k=>this.keys.has(k))&&{z:'light',x:'heavy',c:'special'}[['z','x','c'].find(k=>this.keys.has(k))])||null;
  return {axis,jump:held.includes('jump')||this.keys.has('ArrowUp'),attack};
 }
}
root.AksaraInput={InputState,defaults,normalize};if(typeof module!=='undefined')module.exports=root.AksaraInput;
})(typeof window!=='undefined'?window:globalThis);
