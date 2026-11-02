/* Studio Antara · Status Model & Penjanaan v2
 * Bukti ialah hasil permintaan sebenar. Memilih model tidak bermaksud bersambung.
 * Data hanya berada dalam memori tab, tiada prompt/imej/rahsia disalin ke log.
 */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root?.document){root.StudioStatusV2=api;api.mount(root);}
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const MODELS=Object.freeze(["schnell","klein","ovh"]);
 const NAMES=Object.freeze({schnell:"FLUX.1 Schnell",klein:"FLUX.2 Klein",ovh:"OVHcloud SDXL Beta"});
 const TTL=600000;
 function create(clock=()=>Date.now()){
  const histories=new Map(),savedByModel=new Map();let selected="schnell",current=null;
  const normalize=x=>MODELS.includes(x)?x:"schnell";
  function event(item={}){
   const stage=String(item.stage||"");
   if(stage==="pilih"){selected=normalize(item.model);return snapshot();}
   const model=normalize(item.model||selected);
   if(stage==="mula"){current={model,started:clock(),stage:"menjana"};savedByModel.set(model,"belum_diuji");}
   else if(stage==="siap"){
    const entry={model,stage:"siap",at:clock(),
     durationMs:Number.isFinite(item.durationMs)?Math.max(0,Math.round(item.durationMs)):null};
    histories.set(model,entry);current=null;
   }else if(["gagal","dihentikan","terhad"].includes(stage)){
    histories.set(model,{model,stage,at:clock(),durationMs:null});
    current=null;
   }else if(stage==="disimpan")savedByModel.set(model,"berjaya");
   else if(stage==="gagal_simpan")savedByModel.set(model,"gagal");
   return snapshot();
  }
  function snapshot(){
   const last=histories.get(selected)||null,age=last?Math.max(0,clock()-last.at):null;
   return {selected,modelName:NAMES[selected],active:current?{...current}:null,
    status:current?.model===selected?"menjana":!last?"belum_diuji":
     age>TTL?"bukti_lama":last.stage,
    last:last?{...last}:null,age,saved:savedByModel.get(selected)||"belum_diuji"};
  }
  return Object.freeze({event,snapshot});
 }
 function mount(win){
  const doc=win.document,form=doc.getElementById("imageForm"),select=doc.getElementById("imageModel"),
   near=doc.getElementById("generationStatus");
  if(!form||!select||!near)return null;
  const state=create();
  const panel=doc.createElement("details");panel.id="studioStatusV2";panel.className="studio-status-v2";
  const summary=doc.createElement("summary");summary.textContent="Status model & penjanaan";
  const body=doc.createElement("div");body.id="studioStatusV2Body";body.setAttribute("role","status");
  panel.append(summary,body);near.after(panel);
  const style=doc.createElement("style");style.textContent=[
   ".studio-status-v2{margin:10px 0 1px;border:1px solid rgba(226,195,150,.23);border-radius:12px;background:rgba(12,20,33,.22);color:#e7ddca}",
   ".studio-status-v2 summary{cursor:pointer;padding:10px 12px;font:600 12px/1.4 'DM Sans',sans-serif}",
   "#studioStatusV2Body{white-space:pre-line;font:400 11px/1.6 'DM Sans',sans-serif;padding:0 12px 12px;color:#d2c7b7}"
  ].join("\n");doc.head.append(style);
  const names={belum_diuji:"Belum diuji",menjana:"Sedang menjana",siap:"Berjaya dijana",
   gagal:"Permintaan gagal",dihentikan:"Dihentikan",terhad:"Had penyedia dilaporkan",bukti_lama:"Bukti lama"};
  function render(){
   const s=state.snapshot();
   const active=s.active?" · Percubaan aktif: "+NAMES[s.active.model]:"";
   const saved=s.saved==="berjaya"?"Berjaya":s.saved==="gagal"?"Gagal":"Belum disahkan";
   body.textContent="Model dipilih: "+s.modelName+
    "\nStatus model: "+(names[s.status]||"Belum diuji")+active+
    "\nSejarah setempat (hasil terkini): "+(s.last?new Date(s.last.at).toLocaleTimeString("ms-MY"):"Tiada")+
    "\nSimpan hasil: "+saved+
    "\nStatus berdasarkan percubaan sebenar, bukan semakan sambungan langsung. Model lain tidak diuji secara automatik.";
   panel.dataset.status=s.status;
  }
  select.addEventListener("change",()=>{state.event({stage:"pilih",model:select.value});render();});
  win.addEventListener("studio:status",e=>{state.event(e.detail);render();});
  state.event({stage:"pilih",model:select.value});render();
  win.StudioStatusV2UI=Object.freeze({snapshot:state.snapshot});
  return state;
 }
 return Object.freeze({create,mount,MODELS,TTL});
});
