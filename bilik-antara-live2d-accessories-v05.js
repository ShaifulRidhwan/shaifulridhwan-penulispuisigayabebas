/* AKSARA Live2D accessory cohesion v0.5.
 * Genuine independent Pixi sprites with damped secondary motion, NOT native
 * Cubism ornament physics. Leave existing headwear unchanged if unsafe.
 */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.AksaraLive2DAccessoriesV05=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,Number.isFinite(x)?x:0));
 function integrate(body,target,dt,hz){
  // Critically damped mass spring, no overextension.
  const f=2*Math.PI*hz;
  body.vel=clamp(body.vel+(target-body.x)*f*f*dt-2*.87*f*body.vel*dt,-.8,.8);
  body.x+=body.vel*dt;
  return body.x;
 }
 function partExists(core,id){
  if(!core||typeof core.setPartOpacityById!=="function")return false;
  const ids=core.parts?.ids;
  if(Array.isArray(ids)||typeof ids?.includes==="function")return ids.includes(id);
  if(typeof core.getPartIndex==="function")return core.getPartIndex(id)>=0;
  return false;
 }
 function create({PIXI,app,model,base="./assets/live2d/aksara/accessories/"}={}){
  let active=false,reason="not-loaded",last=0;
  const objects=[],core=model?.internalModel?.coreModel;
  const originalPart="PartHeadAccessories";
  async function loadTexture(name){
   const url=base+name;
   const texture=PIXI.Texture.from(url);
   if(texture.baseTexture.valid)return texture;
   await new Promise((resolve,reject)=>{
    const bt=texture.baseTexture;
    const timer=setTimeout(()=>reject(Error("Accessory PNG load timeout")),8000);
    bt.once("loaded",()=>{clearTimeout(timer);resolve();});
    bt.once("error",()=>{clearTimeout(timer);reject(Error("Accessory PNG missing"));});
   });
   return texture;
  }
  async function init(){
   if(!PIXI?.Texture?.from||!app?.stage||!model){reason="renderer-unavailable";return false;}
   if(!partExists(core,originalPart)){reason="cubism-headwear-part-unavailable";return false;}
   let data;
   try{
    const res=await fetch(base+"accessories.json",{credentials:"same-origin"});
    if(!res.ok)throw Error("Accessory metadata missing");
    data=await res.json();
    if(!Array.isArray(data.canvas)||data.canvas.length!==2)throw Error("Invalid accessory metadata");
    for(const name of ["sun","moon"]){
     const item=data.sprites?.[name];
     if(!item||!Array.isArray(item.bounds)||item.bounds.length!==4)throw Error("Missing "+name+" sprite");
     const texture=await loadTexture(item.file);
     const sprite=new PIXI.Sprite(texture);
     sprite.anchor.set(.5,.5);
     sprite.renderable=false;
     app.stage.addChild(sprite);
     objects.push({name,sprite,bounds:item.bounds,canvas:data.canvas,
       swing:{x:0,vel:0},drift:{x:0,vel:0}});
    }
    active=true;reason="ready";refresh();
    for(const obj of objects)obj.sprite.renderable=true;
    return true;
   }catch(error){
    reason=String(error.message||error);destroy();return false;
   }
  }
  function refresh(now=0,values={}){
   if(!active)return;
   const scaleW=Math.max(1,model.width);
   const scaleH=Math.max(1,model.height);
   const [cw,ch]=objects[0].canvas;
   const dx=Number(values.ParamAngleX||0),dz=Number(values.ParamAngleZ||0);
   const dt=last?clamp((now-last)/1000,0.005,.04):1/60;
   last=now;
   for(let i=0;i<objects.length;i++){
    const item=objects[i],sprite=item.sprite;
    const [x0,y0,x1,y1]=item.bounds;
    const ratio=scaleW/cw;
    const middleX=(x0+x1)*.5/cw,middleY=(y0+y1)*.5/ch;
    const sign=i===0?1:-1;
    const desiredAngle=clamp((-dz*.0021+dx*.0011)*sign,-.028,.028);
    const desiredDrift=clamp((-dz*.50+dx*.28)*sign,-5,5);
    const angle=integrate(item.swing,desiredAngle,dt,i===0?1.85:1.50);
    const shift=integrate(item.drift,desiredDrift,dt,i===0?1.55:1.35);
    sprite.width=Math.max(1,(x1-x0)*ratio);
    sprite.height=Math.max(1,(y1-y0)*(scaleH/ch));
    sprite.position.set(model.position.x+(middleX-(model.anchor?.x??.5))*scaleW+shift,
       model.position.y+(middleY-(model.anchor?.y??.5))*scaleH);
    sprite.rotation=angle;
   }
   // Hide original headwear after all overlay parts are loaded and aligned.
   try{core.setPartOpacityById(originalPart,0);}
   catch(_){reason="headwear-hide-failed";destroy();}
  }
  function destroy(){
   active=false;
   try{if(partExists(core,originalPart))core.setPartOpacityById(originalPart,1);}catch(_){}
   for(const o of objects){o.sprite.parent?.removeChild(o.sprite);o.sprite.destroy({texture:false,baseTexture:false});}
   objects.length=0;
  }
  return Object.freeze({init,refresh,destroy,snapshot:()=>({active,reason,sprites:objects.length})});
 }
 return Object.freeze({create,integrate,partExists});
});