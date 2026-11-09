const input={axis:0};let scene,match=new AksaraCombat.Combat(),paused=true,audio,started=false;
function sound(){try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.setValueAtTime(180,audio.currentTime);o.frequency.exponentialRampToValueAtTime(45,audio.currentTime+.12);g.gain.setValueAtTime(.08,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.15);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.16);}catch{}}
function pause(){paused=true;if(typeof controls!=='undefined'){controls.suspend();drawStick();}input.axis=0;input.jump=false;input.attack=null;document.querySelector('#menu').style.display='grid';document.querySelector('#message').textContent='Dijeda · sambung atau mula semula';document.querySelector('#start').textContent=started?'Sambung':'Mula pertarungan';audio?.suspend().catch(()=>{});}
window.aksaraPause=pause;document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('blur',pause);
document.querySelector('#pause').onclick=pause;document.querySelector('#restart').onclick=()=>{started=false;match=new AksaraCombat.Combat(document.querySelector('#hero').value,+document.querySelector('#difficulty').value);document.querySelector('#start').textContent='Mula pertarungan';};document.querySelector('#start').onclick=()=>{if(!window.gameDiagnostics.ready)return;started=true;controls.resume();drawStick();scene?.presentation?.resetTiming();if(!match||match.result||document.querySelector('#start').textContent!=='Sambung'){match=new AksaraCombat.Combat(document.querySelector('#hero').value,+document.querySelector('#difficulty').value);}paused=false;document.querySelector('#menu').style.display='none';sound();};
class Arena extends Phaser.Scene {
 preload(){
  this.load.atlas('warriors','eclipse-warriors.png','eclipse-warriors.json');
  this.load.atlas('walkers','eclipse-walk.png','eclipse-walk.json');
  this.load.image('eclipse-arena','eclipse-arena.png');
  this.load.on('loaderror',file=>window.gameFailure('Aset gagal: '+file.key));
 }
 create(){
  console.info('AKSARA scene create');scene=this;
  this.game.canvas.addEventListener('webglcontextlost',()=>window.gameFailure('WebGL terhenti'));
  this.presentation=new EclipsePresentation(this);this.input.addPointer(5);
  const fit=()=>{const w=this.scale.width,h=this.scale.height,z=Math.min(w/960,h/540);
   this.cameras.main.setZoom(z).setScroll(480-w/(2*z),270-h/(2*z));
   const cover=Math.max(w/z/1672,h/z/941)*1.04;
   this.presentation.bg.setDisplaySize(1672*cover,941*cover);
  };this.scale.on('resize',fit);fit();
 }
 update(t,ms){
  if(!match)return;
  if(!paused){Object.assign(input,controls.sample(match.fighters[0]));match.step(ms/1000,input);}
  this.presentation.update(match,ms/1000,!paused);
  if(!paused)for(const e of match.events){sound();this.cameras.main.shake(e.kind==='heavy'?100:65,e.kind==='heavy'?.003:.0015);}
  match.events=[];
  if(match.result&&!paused){paused=true;controls.suspend();drawStick();document.querySelector('#menu').style.display='grid';document.querySelector('#message').textContent=match.result+' · '+match.fighters[0].id.toUpperCase();document.querySelector('#start').textContent='Main semula';}
 }
}
const renderer=new URLSearchParams(location.search).get('renderer');
const game=new Phaser.Game({type:renderer==='canvas'?Phaser.CANVAS:Phaser.AUTO,parent:'game',width:960,height:540,backgroundColor:'#080c19',scale:{mode:Phaser.Scale.RESIZE},scene:Arena,audio:{noAudio:true},fps:{target:60}});

const viewport=document.querySelector('#game');
new ResizeObserver(()=>{if(scene&&game.canvas&&viewport.clientWidth>0&&viewport.clientHeight>0)game.scale.refresh();}).observe(viewport);
game.events.on(Phaser.Core.Events.POST_RENDER,()=>{
 const d=window.gameDiagnostics,c=game.canvas,r=c.getBoundingClientRect();
 d.frames++;d.width=r.width;d.height=r.height;d.renderer=game.renderer.type===Phaser.CANVAS?'canvas':'webgl';
 if(!d.ready&&!d.error&&scene&&r.width>0&&r.height>0&&c.width>0&&c.height>0){
  d.ready=true;console.info('AKSARA first frame '+JSON.stringify(d));
  const b=document.querySelector('#start');b.disabled=false;b.textContent='Mula pertarungan';
 }
});
game.events.on('contextlost',()=>window.gameFailure('Konteks grafik hilang'));

window.aksaraInsets=(l,t,r,b)=>{for(const [key,value] of Object.entries({left:l,top:t,right:r,bottom:b}))document.documentElement.style.setProperty(`--safe-${key}`,value+"px");};
