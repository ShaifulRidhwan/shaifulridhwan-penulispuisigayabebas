/* AKSARA Thinking Mode · Paparan Status v2
 * Status kawalan gaya Cahaya/Gelap, bukan akses kepada reasoning dalaman model.
 * Hanya metadata mod, keadaan permintaan dan masa disimpan dalam memori tab.
 */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root?.document){root.AksaraThinkingStatus=api;api.mount(root);}
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const nama=mode=>mode==="gelap"?"Gelap":"Cahaya";
 const sah=mode=>mode==="cahaya"||mode==="gelap";
 function create(initialMode="cahaya",clock=()=>Date.now()){
  let dipilih=nama(initialMode),semasa=null,terakhir=null,revision=0;
  const salin=value=>value?{...value}:null;
  function pilih(mode){
   dipilih=nama(mode);return snapshot();
  }
  function mula(mode){
   // Mod disalin pada masa Hantar; pilihan selepas itu untuk permintaan berikutnya.
   const id=++revision;
   semasa={id,mode:nama(mode),start:clock(),hasil:null};
   return id;
  }
  function hasil(kind){
   if(!semasa)return false;
   if(["selesai","gagal","dihentikan"].includes(kind)){semasa.hasil=kind;return true;}
   return false;
  }
  function tamat(){
   if(!semasa)return false;
   terakhir={mode:semasa.mode,hasil:semasa.hasil||"tidak_disahkan",
    start:semasa.start,end:clock()};
   semasa=null;return true;
  }
  function setSemula(mode=dipilih){
   dipilih=nama(mode);semasa=null;terakhir=null;revision++;
   return snapshot();
  }
  function snapshot(){
   return {dipilih,semasa:salin(semasa),terakhir:salin(terakhir),
    berbeza:!!semasa&&semasa.mode!==dipilih};
  }
  return Object.freeze({pilih,mula,hasil,tamat,setSemula,snapshot});
 }
 function mount(root){
  const dialog=root.document.getElementById("thoughtModeDialog"),
   button=root.document.getElementById("thoughtMode");
  if(!dialog||!button||!root.BilikAntaraThought)return null;
  const state=create(root.BilikAntaraThought.getMode());
  const style=root.document.createElement("style");
  style.textContent=[
   '.thought-mode-dialog .thought-status-v2{padding:11px 12px;margin:0 0 12px;border-radius:12px;border:1px solid rgba(226,197,150,.2);background:rgba(9,15,28,.18);display:grid;gap:7px}',
   '.thought-mode-dialog .thought-status-v2-title{font:650 11px/1.3 "Space Grotesk",sans-serif;color:#e7d7b7;letter-spacing:.02em}',
   '.thought-mode-dialog .thought-status-v2-line{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;font:500 11px/1.4 "DM Sans",sans-serif;color:#c9bdaf}',
   '.thought-mode-dialog .thought-status-v2-line strong{color:#e9e2d7;font-weight:600;text-align:right;max-width:65%;overflow-wrap:anywhere}',
   '.thought-mode-dialog .thought-status-v2-note{font:400 10.5px/1.5 "DM Sans",sans-serif;color:#bbb3a8;margin:2px 0 0}',
   '.thought-mode-dialog .thought-status-v2-line[data-result="gagal"] strong{color:#eda9a0}',
   '.thought-mode-dialog .thought-status-v2-line[data-result="dihentikan"] strong{color:#e5c995}',
   '@media(max-width:420px){.thought-mode-dialog .thought-status-v2{padding:10px}.thought-mode-dialog .thought-status-v2-line{font-size:10.5px}}'
  ].join("\n");
  root.document.head.appendChild(style);
  const box=root.document.createElement("section");
  box.id="thoughtModeStatus";
  box.className="thought-status-v2";
  box.setAttribute("aria-label","Status mod pemikiran");
  const title=root.document.createElement("div");
  title.className="thought-status-v2-title";title.textContent="STATUS MOD";
  function line(label,id){
   const outer=root.document.createElement("div");
   outer.className="thought-status-v2-line";
   const key=root.document.createElement("span");
   key.textContent=label;
   const value=root.document.createElement("strong");value.id=id;
   outer.append(key,value);box.append(outer);
   return {outer,value};
  }
  box.append(title);
  const picked=line("Mod dipilih","thoughtModeStatusSelected");
  const current=line("Permintaan semasa","thoughtModeStatusCurrent");
  const last=line("Permintaan terakhir","thoughtModeStatusLast");
  const note=root.document.createElement("p");
  note.className="thought-status-v2-note";
  note.textContent="Cahaya/Gelap mengubah pendekatan jawapan. Tahap penaakulan model ditentukan secara adaptif oleh sistem; paparan ini bukan bukti tahap tersebut.";
  box.append(note);
  dialog.querySelector(".thought-mode-list")?.insertAdjacentElement("beforebegin",box);
  const statuses={selesai:"Selesai",gagal:"Gagal",dihentikan:"Dihentikan",tidak_disahkan:"Tidak dapat disahkan"};
  function render(){
   // Restore/history can change the mode without firing the user-change event.
   state.pilih(root.BilikAntaraThought.getMode());
   const s=state.snapshot();
   picked.value.textContent=s.dipilih;
   current.value.textContent=s.semasa?("Sedang dijawab · "+s.semasa.mode):"Tiada permintaan aktif";
   current.outer.dataset.result=s.semasa?.hasil||"";
   last.value.textContent=s.terakhir?
    (statuses[s.terakhir.hasil]||"Tidak dapat disahkan")+" · "+s.terakhir.mode:"Belum ada dalam tab ini";
   last.outer.dataset.result=s.terakhir?.hasil||"";
   const diverged=s.berbeza?" · Pilihan baharu hanya untuk soalan berikutnya":"";
   const msg="Thinking Mode. Aktif: "+s.dipilih+
    (s.semasa?". Permintaan sedang dijawab dalam "+s.semasa.mode+diverged:
    s.terakhir?". Terakhir: "+(statuses[s.terakhir.hasil]||"Tidak dapat disahkan")+" dalam "+s.terakhir.mode:"");
   button.setAttribute("aria-label",msg);
   button.title=msg;
   button.dataset.permintaan=s.semasa?"sedang":s.terakhir?.hasil||"tiada";
   return s;
  }
  root.addEventListener("ba:thought-mode-changed",event=>{state.pilih(event.detail?.mode);render();});
  root.addEventListener("ba:thinking-request-start",event=>{
   if(!sah(event.detail?.mode))return;
   state.mula(event.detail.mode);render();
  });
  root.addEventListener("ba:answered",()=>{state.hasil("selesai");render();});
  root.addEventListener("ba:request-failed",()=>{state.hasil("gagal");render();});
  root.document.getElementById("stopBtn")?.addEventListener("click",()=>{
   state.hasil("dihentikan");render();
  },{capture:true});
  root.addEventListener("ba:ready-for-tools",()=>{if(state.tamat())render();});
  root.addEventListener("ba:cleared",()=>{state.setSemula(root.BilikAntaraThought.getMode());render();});
  dialog.addEventListener("close",render);
  // Capture changes from restored sessions that do not trigger a user-change event.
  const observer=new MutationObserver(()=>render());
  observer.observe(button,{attributes:true,attributeFilter:["data-mode"]});
  root.addEventListener("pagehide",()=>observer.disconnect(),{once:true});
  render();
  root.AksaraThinkingStatusUI=Object.freeze({snapshot:()=>state.snapshot()});
  return state;
 }
 return Object.freeze({create,mount,nama,sah});
});
