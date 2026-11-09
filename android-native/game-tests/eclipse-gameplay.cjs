const {chromium,evidence,baseURL}=require('./test-env.cjs');const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const metrics=[];
for(const [w,h,renderer] of [[640,360,'canvas'],[844,390,'webgl'],[1080,486,'webgl'],[1280,800,'canvas']]){
 const p=await b.newPage({viewport:{width:w,height:h},hasTouch:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(baseURL+(renderer==='canvas'?'?renderer=canvas':''));await p.waitForFunction(()=>window.gameDiagnostics?.ready);await p.selectOption('#mode','training');await p.click('#start');await p.waitForFunction(()=>match.roundState==='FIGHT');assert(await p.locator('#stick').evaluate(e=>getComputedStyle(e).opacity>.5),'Joystick must be visible before first touch');
 const rect=await p.locator('canvas').boundingBox();assert(Math.abs(rect.width-w)<2&&Math.abs(rect.height-h)<2);assert.equal(rect.x,0);assert.equal(rect.y,0);
 assert(await p.evaluate(()=>{const camera=scene.cameras.main,bg=scene.presentation.bg.getBounds();return [[0,0],[innerWidth,0],[0,innerHeight],[innerWidth,innerHeight]].every(([x,y])=>{const world=camera.getWorldPoint(x,y);return bg.contains(world.x,world.y)})}),'Arena image must cover all camera corners, not merely canvas bounds');
 assert(await p.evaluate(()=>{const c=scene.cameras.main;return Math.abs(c.midPoint.x-480)<1&&Math.abs(c.midPoint.y-270)<1}),'Camera must remain centered after uniform zoom');
 // Real key input, simulation and rendered frames; no HP injection.
 await p.keyboard.down('ArrowRight');await p.waitForFunction(()=>Math.abs(match.fighters[0].x-match.fighters[1].x)<80);await p.keyboard.up('ArrowRight');
 for(const key of ['z','z','x']){await p.keyboard.press(key);await p.waitForTimeout(600);}
 await p.waitForFunction(()=>match.stats.damage>0);assert(await p.evaluate(()=>match.stats.maxCombo>=2));await p.screenshot({path:`${evidence}/v3-${w}-${renderer}.png`});
 await p.click('#pause');const saved=await p.evaluate(()=>match.snapshot());await p.reload();await p.waitForFunction(()=>gameDiagnostics.ready);assert(await p.evaluate(()=>paused&&started&&match.stats.damage>0));assert.equal(await p.evaluate(()=>match.round),saved.round);
 await p.click('#start');await p.click('#settings-open');await p.locator('[name=opacity]').evaluate(e=>{e.value=25;e.dispatchEvent(new Event('input'))});await p.click('#settings-close');await p.reload();await p.waitForFunction(()=>gameDiagnostics.ready);assert.equal(await p.evaluate(()=>controlSettings.opacity),25);
 metrics.push({viewport:[w,h],renderer,canvas:rect,diagnostics:await p.evaluate(()=>gameDiagnostics)});assert.deepEqual(errors,[]);await p.close();console.log('PASS viewport, combat inputs, combo, save/resume '+w);
}
// Story chapter completion uses deterministic accelerated simulation, not device-time evidence.
const p=await b.newPage();await p.goto(baseURL);await p.waitForFunction(()=>gameDiagnostics.ready);
for(let chapter=0;chapter<3;chapter++){
 await p.selectOption('#mode','story');await p.selectOption('#chapter',String(chapter));await p.click('#start');assert(await p.locator('#cinematic').isVisible());await p.click('#dialogue-next');await p.click('#dialogue-skip');
 const report=await p.evaluate(()=>{const phases=new Set();for(let n=0;n<40000&&!match.result;n++){const [a,b]=match.fighters,dist=Math.abs(a.x-b.x);match.step(1/60,{axis:dist>70?Math.sign(b.x-a.x):0,attack:n%36===0?'light':n%108===72?'heavy':null},false);phases.add(match.bossPhase);}return {result:match.result,phases:[...phases]};});
 assert.equal(report.result,'MENANG');if(chapter===2)assert.deepEqual(report.phases,[1,2,3]);await p.waitForFunction(()=>paused);assert(await p.evaluate(i=>progress.completed.includes(i),chapter));await p.click('#home');
}
await p.reload();await p.waitForFunction(()=>gameDiagnostics.ready);assert.deepEqual(await p.evaluate(()=>progress.completed),[0,1,2]);await p.screenshot({path:evidence+'/v3-story-completed.png'});await b.close();fs.writeFileSync(evidence+'/v3-browser-metrics.json',JSON.stringify(metrics,null,2));console.log('PASS three story chapters, boss phases, rewards and persistent unlocks');
})().catch(e=>{console.error(e);process.exit(1)});
