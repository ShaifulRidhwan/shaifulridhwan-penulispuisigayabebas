let controlSettings;try{controlSettings=AksaraInput.normalize(JSON.parse(localStorage.getItem('aksara-eclipse-controls')||'{}'));}catch{controlSettings=AksaraInput.normalize();}
const controls=new AksaraInput.InputState(controlSettings);
const stickZone=document.querySelector('#stick-zone'),stickVisual=document.querySelector('#stick'),knob=document.querySelector('#knob');
function saveControls(){try{localStorage.setItem('aksara-eclipse-controls',JSON.stringify(controlSettings));}catch{}applyControls();}
function applyControls(){controls.settings=controlSettings;const s=document.documentElement.style;s.setProperty('--stick-size',96*controlSettings.joystickSize/100+'px');s.setProperty('--button-size',62*controlSettings.buttonSize/100+'px');s.setProperty('--control-opacity',controlSettings.opacity/100);s.setProperty('--button-label-size',Math.max(8,Math.min(10,controlSettings.buttonSize/10))+'px');s.setProperty('--offset-x',controlSettings.offsetX+'px');s.setProperty('--offset-y',controlSettings.offsetY+'px');const a=document.querySelector('#actions'),z=stickZone,hud=document.querySelector('#hud');if(a&&z){s.setProperty('--offset-x',Math.min(controlSettings.offsetX,Math.max(0,a.offsetLeft-z.offsetLeft-z.offsetWidth-8))+'px');s.setProperty('--offset-y',Math.min(controlSettings.offsetY,Math.max(0,a.offsetTop-hud.offsetTop-hud.offsetHeight-8))+'px');}}
applyControls();
function haptic(action){if(controlSettings.haptics)window.AksaraHaptics?.postMessage(action);}
function stickCenter(){const r=stickZone.getBoundingClientRect();return{x:r.left+Math.min(85,r.width/2),y:r.bottom-Math.min(80,r.height/2)};}
function drawStick(){const s=controls.stick;stickVisual.classList.toggle('active',!!s&&!paused);stickVisual.classList.toggle('fixed',!s&&!controlSettings.floating&&!paused);if(!s&&!controlSettings.floating){const c=stickCenter();stickVisual.style.left=c.x+'px';stickVisual.style.top=c.y+'px';}if(s){stickVisual.style.left=s.x+'px';stickVisual.style.top=s.y+'px';knob.style.transform=`translate(${s.dx}px,${s.dy}px)`;}else knob.style.transform='translate(0,0)';for(const b of document.querySelectorAll('[data-action]'))b.classList.toggle('pressed',[...controls.pointers.values()].some(p=>p.action===b.dataset.action));}
function capture(e,action){if(action==='stick'&&controlSettings.floating&&e.clientY<innerHeight*.6)return;if(paused||!controls.down(e.pointerId,action,e.clientX,e.clientY,stickCenter()))return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);if(action!=='stick')haptic(action);drawStick();}
stickZone.addEventListener('pointerdown',e=>capture(e,'stick'));
for(const b of document.querySelectorAll('[data-action]'))b.addEventListener('pointerdown',e=>capture(e,b.dataset.action));
window.addEventListener('pointermove',e=>{controls.move(e.pointerId,e.clientX,e.clientY);drawStick();});
window.addEventListener('pointerup',e=>{controls.up(e.pointerId);drawStick();});
window.addEventListener('pointercancel',e=>{controls.cancel(e.pointerId);drawStick();});
window.addEventListener('lostpointercapture',e=>{controls.up(e.pointerId);drawStick();});
window.addEventListener('keydown',e=>{if(!paused&&['ArrowLeft','ArrowRight','ArrowUp','z','x','c','Escape'].includes(e.key))e.preventDefault();if(e.key==='Escape')pause();else controls.key(e.key,true);});
window.addEventListener('keyup',e=>controls.key(e.key,false));
const settingsPanel=document.querySelector('#settings');
for(const field of settingsPanel.querySelectorAll('[name]')){field[field.type==='checkbox'?'checked':'value']=controlSettings[field.name];field.addEventListener('input',()=>{controlSettings=AksaraInput.normalize({...controlSettings,[field.name]:field.type==='checkbox'?field.checked:field.value});saveControls();if(field.name==='graphics'&&typeof scene!=='undefined'&&scene?.presentation){scene.presentation.adaptLow=false;scene.presentation.lowWindows=0;}controls.reset();drawStick();});}
document.querySelector('#settings-open').onclick=()=>{pause();settingsPanel.hidden=false;document.querySelector('#menu').style.display='none';};
document.querySelector('#settings-close').onclick=()=>{settingsPanel.hidden=true;document.querySelector('#menu').style.display='grid';};
document.querySelector('#settings-reset').onclick=()=>{controlSettings=AksaraInput.normalize();saveControls();if(typeof scene!=='undefined'&&scene?.presentation){scene.presentation.adaptLow=false;scene.presentation.lowWindows=0;}for(const f of settingsPanel.querySelectorAll('[name]'))f[f.type==='checkbox'?'checked':'value']=controlSettings[f.name];};

window.addEventListener('resize',()=>{controls.reset();applyControls();drawStick();});
