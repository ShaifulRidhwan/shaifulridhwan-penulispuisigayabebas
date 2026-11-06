/* Shared glass confirmation and text prompt UI for Bilik Antara. */
(function(root){
"use strict";
let queue=Promise.resolve();
function element(tag,className,text){
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(text!==undefined)node.textContent=text;
 return node;
}
const style=element("style");
style.textContent=[
 '.aksara-glass-dialog{box-sizing:border-box;width:min(430px,calc(100vw - 28px));max-height:calc(100dvh - 32px);overflow:auto;margin:auto;padding:0;border:1px solid rgba(227,198,151,.33);border-radius:20px;background:rgba(10,16,28,.97);color:#f1e5d5;color-scheme:dark;box-shadow:0 24px 85px rgba(0,0,0,.7),inset 0 1px rgba(255,255,255,.07);font:500 14px/1.6 "DM Sans",system-ui,sans-serif;backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px)}',
 '.aksara-glass-dialog::backdrop{background:rgba(1,4,11,.78);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px)}',
 '.aksara-glass-dialog__body{padding:24px 22px 19px;display:grid;gap:14px}',
 '.aksara-glass-dialog__heading{margin:0;font:600 18px/1.3 "Space Grotesk","DM Sans",sans-serif;letter-spacing:.01em;color:#f6e4c5}',
 '.aksara-glass-dialog__text{margin:0;color:#d3d7e2;white-space:pre-wrap;overflow-wrap:anywhere}',
 '.aksara-glass-dialog__field{box-sizing:border-box;width:100%;min-height:44px;border:1px solid rgba(224,203,169,.3);border-radius:12px;background:rgba(255,255,255,.05);padding:10px 12px;color:#fff;font:inherit}',
 '.aksara-glass-dialog__field:focus-visible,.aksara-glass-dialog__action:focus-visible{outline:2px solid #e8c88e;outline-offset:3px}',
 '.aksara-glass-dialog__actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:10px}',
 '.aksara-glass-dialog__action{min-width:96px;min-height:44px;border-radius:12px;border:1px solid rgba(229,204,169,.27);background:rgba(255,255,255,.05);color:#e9e1d4;font:600 13px "DM Sans",sans-serif;padding:10px 16px;cursor:pointer}',
 '.aksara-glass-dialog__action--primary{border-color:rgba(238,205,152,.55);background:rgba(173,125,61,.23);color:#ffedcc}',
 '@media(prefers-reduced-motion:no-preference){.aksara-glass-dialog[open]{animation:aksara-glass-in .16s ease-out}@keyframes aksara-glass-in{from{opacity:.45;transform:translateY(9px)}to{opacity:1;transform:translateY(0)}}}'
].join("");
(document.head||document.documentElement).appendChild(style);
function open(options={}){
 return new Promise(resolve=>{
  const type=options.type==="prompt"?"prompt":"confirm";
  const dialog=element("dialog","aksara-glass-dialog");
  const panel=element("form","aksara-glass-dialog__body");
  panel.method="dialog";
  const heading=element("h2","aksara-glass-dialog__heading",String(options.title||"Pengesahan"));
  heading.id="aksaraGlassTitle";
  dialog.setAttribute("aria-labelledby",heading.id);
  const message=element("p","aksara-glass-dialog__text",String(options.message||""));
  dialog.setAttribute("aria-describedby","aksaraGlassMessage");
  message.id="aksaraGlassMessage";
  panel.append(heading,message);
  let field=null;
  if(type==="prompt"){
   field=element("input","aksara-glass-dialog__field");
   field.type="text";field.autocomplete="off";field.spellcheck=false;
   field.maxLength=100;
   field.setAttribute("aria-label",String(options.label||options.title||"Nama fail"));
   field.value=String(options.defaultValue||"").slice(0,100);
   panel.appendChild(field);
  }
  const actions=element("div","aksara-glass-dialog__actions");
  const cancel=element("button","aksara-glass-dialog__action",String(options.cancelText||"Batal"));
  cancel.type="submit";cancel.value="cancel";
  const ok=element("button","aksara-glass-dialog__action aksara-glass-dialog__action--primary",String(options.confirmText||"Teruskan"));
  ok.type="submit";ok.value="ok";
  actions.append(cancel,ok);panel.appendChild(actions);dialog.appendChild(panel);
  const previous=document.activeElement;
  let settled=false;
  function finish(value){
   if(settled)return;
   settled=true;dialog.remove();
   if(previous?.isConnected&&typeof previous.focus==="function")previous.focus({preventScroll:true});
   resolve(value);
  }
  dialog.addEventListener("close",()=>finish(dialog.returnValue==="ok"?(type==="prompt"?field.value:true):(type==="prompt"?null:false)),{once:true});
  dialog.addEventListener("cancel",()=>{dialog.returnValue="cancel";});
  dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close("cancel");});
  document.body.appendChild(dialog);
  try{dialog.showModal();cancel.focus({preventScroll:true});}
  catch(_){finish(type==="prompt"?null:false);}
 });
}
function enqueue(options){const next=queue.then(()=>open(options));queue=next.then(()=>{},()=>{});return next;}
root.AksaraDialog=Object.freeze({
 confirm:(options)=>enqueue({...options,type:"confirm"}),
 prompt:(options)=>enqueue({...options,type:"prompt"})
});
})(typeof window!=="undefined"?window:null);
