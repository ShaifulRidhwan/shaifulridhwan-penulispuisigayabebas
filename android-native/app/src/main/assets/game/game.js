const input={axis:0};let scene,match=new AksaraCombat.Combat(),paused=true,audio,started=false;
let progress=AksaraCampaign.read(localStorage),chapterIndex=0,dialogueIndex=0,noteUntil=0,saveClock=0,accumulator=0;
const $=id=>document.getElementById(id);
function sound(kind='light'){
 if(typeof controlSettings!=='undefined'&&!controlSettings.sound)return;
 try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});
 const frequencies={light:260,heavy:100,special:440,block:710,break:80,perfect:880,jump:150,round:523,victory:660,finisher:65,phase:110,step:70,defeat:85};
 const duration=['special','round','victory','phase'].includes(kind)?.5:.13;
 const o=audio.createOscillator(),g=audio.createGain();o.type=['block','break'].includes(kind)?'square':'triangle';o.frequency.setValueAtTime(frequencies[kind]||180,audio.currentTime);o.frequency.exponentialRampToValueAtTime(kind==='victory'?990:45,audio.currentTime+duration);g.gain.setValueAtTime(.045,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};}catch{}
}
function persist(){if(started&&!match.result)progress.resume={match:match.snapshot(),chapter:chapterIndex};else progress.resume=null;const ok=AksaraCampaign.write(localStorage,progress);if(!ok)$('progress').textContent='Simpanan tidak tersedia pada peranti ini';return ok;}
function showProgress(){
 $('progress').textContent=`${progress.xp} cahaya · Pangkat ${progress.best} · `+AksaraCampaign.unlocks.map(u=>`${u.name} (${progress.xp>=u.xp?'dibuka':progress.xp+'/'+u.xp})`).join(' · ');
 [...$('chapter').options].forEach((o,i)=>o.disabled=i>0&&!progress.completed.includes(i-1));
 $('chapter').style.display=$('mode').value==='story'?'block':'none';$('drill').style.display=$('mode').value==='training'?'block':'none';
}
function pause(){paused=true;audio?.suspend().catch(()=>{});window.AksaraAudio?.postMessage('stop');if(typeof controls!=='undefined'){controls.suspend();drawStick();}input.axis=0;input.jump=false;input.attack=null;
 if(!$('cinematic').hidden)return;
 $('menu').style.display='grid';$('message').textContent='Dijeda · sambung atau mula semula';$('start').textContent=started?'Sambung':'Mula pertarungan';audio?.suspend().catch(()=>{});persist();}
window.aksaraPause=pause;document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('blur',pause);
$('pause').onclick=pause;
function beginFight(){ accumulator=0;window.AksaraAudio?.postMessage('start'); $('cinematic').hidden=true;started=true;controls.resume();drawStick();scene?.presentation?.resetTiming();paused=false;$('menu').style.display='none';sound('round');persist();}
function dialogue(){const ch=AksaraCampaign.chapters[chapterIndex],line=ch.lines[dialogueIndex];$('chapter-title').textContent=ch.title;$('speaker').textContent=line[0];$('dialogue').textContent=line[1];scene?.tweens.add({targets:scene.presentation.sprites[dialogueIndex%2],alpha:{from:.4,to:1},duration:450});}
$('dialogue-next').onclick=()=>{if(++dialogueIndex>=AksaraCampaign.chapters[chapterIndex].lines.length)beginFight();else dialogue();};$('dialogue-skip').onclick=beginFight;
function newMatch(){const mode=$('mode').value;chapterIndex=+$('chapter').value;const ch=AksaraCampaign.chapters[chapterIndex];match=new AksaraCombat.Combat(mode==='story'?ch.hero:$('hero').value,+$('difficulty').value,{mode,drill:$('drill').value,boss:mode==='story'&&!!ch.boss,abilities:AksaraCampaign.unlocks.filter(u=>progress.xp>=u.xp).map(u=>u.id)});started=true;
 if(mode==='story'){paused=true;controls.suspend();$('menu').style.display='none';$('cinematic').hidden=false;dialogueIndex=0;dialogue();}else beginFight();}
$('restart').onclick=()=>{started=false;newMatch();};
$('home').onclick=()=>{persist();started=false;paused=true;controls.suspend();$('menu').style.display='grid';$('message').textContent='Pilih mod dan pejuang.';$('start').textContent='Mula pertarungan';showProgress();};
$('mode').onchange=showProgress;
$('start').onclick=()=>{if(!window.gameDiagnostics.ready)return;if(started&&!match.result)beginFight();else newMatch();};
if(progress.resume){try{match=AksaraCombat.Combat.restore(progress.resume.match);chapterIndex=progress.resume.chapter||0;started=true;$('mode').value=match.options.mode;$('chapter').value=chapterIndex;$('message').textContent='Pertarungan tersimpan · sambung selepas memuatkan';}catch{progress.resume=null;}}
showProgress();
function finishMatch(){paused=true;controls.suspend();drawStick();const ranking=AksaraCampaign.rank(match);if(match.options.mode!=='training'){progress.matches++;progress.xp+=match.result==='MENANG'?45:15;if('DCBAS'.indexOf(ranking)>'DCBAS'.indexOf(progress.best))progress.best=ranking;if(match.result==='MENANG'&&match.options.mode==='story'&&!progress.completed.includes(chapterIndex))progress.completed.push(chapterIndex);}
 persist();showProgress();$('menu').style.display='grid';$('message').textContent=`${match.result} · ${match.wins.join(' — ')} · Pangkat ${ranking} · Combo ${match.stats.maxCombo}`+(match.options.mode==='story'&&match.result==='MENANG'?' · '+AksaraCampaign.chapters[chapterIndex].ending:'');$('start').textContent='Main semula';sound(match.result==='MENANG'?'victory':'defeat');}
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
  if(!paused){accumulator=Math.min(.2,accumulator+ms/1000);const events=[];while(accumulator>=1/60){Object.assign(input,controls.sample(match.hitstop>0?{state:"hit"}:match.fighters[0]));match.step(1/60,input,match.options.mode!=='training'||match.options.drill==='sparring');events.push(...match.events);accumulator-=1/60;}match.events=events;saveClock+=ms;if(saveClock>2000){persist();saveClock=0;}}
  this.presentation.update(match,ms/1000,!paused);
  if(!paused&&match.fighters.some(f=>f.state==='walk')&&t-(this.lastStep||0)>360){sound('step');this.lastStep=t;}
  if(!paused)for(const e of match.events){sound(e.kind);if(e.damage){noteUntil=performance.now()+500;$('combat-note').textContent=`−${e.damage} · ${match.fighters[0].combo>1?match.fighters[0].combo+' HIT':''}`;this.cameras.main.shake(e.kind==='heavy'||e.kind==='finisher'?85:40,e.kind==='heavy'?.002:.001);haptic(e.kind==='heavy'?'heavy':'light');}
   if(['perfect','break','finisher','phase'].includes(e.kind)){noteUntil=performance.now()+1200;$('combat-note').textContent={perfect:'PERFECT DODGE · COUNTER',break:'GUARD BREAK',finisher:'FINISHER',phase:'GERHANA · FASA '+match.bossPhase}[e.kind];}
  }
  if(performance.now()>noteUntil)$('combat-note').textContent=match.options.mode==='training'?'TRAINING · LIGHT + LIGHT + HEAVY · Guard: LIGHT + HEAVY · Dodge: undur + JUMP':'';
  $('round-banner').textContent=paused?'':match.roundState==='INTRO'?`RONDE ${match.round} · BERSEDIA`:match.roundState==='INTERMISSION'?`${match.roundWinner===0?'CAHAYA ANDA':match.roundWinner===1?'LAWAN':'SERI'} · ${match.wins.join(' : ')}`:'';
  match.events=[];
  if(match.result&&!paused)finishMatch();
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
  const b=document.querySelector('#start');b.disabled=false;b.textContent=started?'Sambung':'Mula pertarungan';
 }
});
game.events.on('contextlost',()=>window.gameFailure('Konteks grafik hilang'));

window.aksaraInsets=(l,t,r,b)=>{for(const [key,value] of Object.entries({left:l,top:t,right:r,bottom:b}))document.documentElement.style.setProperty(`--safe-${key}`,value+"px");};

if(window.AksaraAudio)window.AksaraAudio.onmessage=e=>{if(e.data==='denied')audio?.suspend().catch(()=>{});};
