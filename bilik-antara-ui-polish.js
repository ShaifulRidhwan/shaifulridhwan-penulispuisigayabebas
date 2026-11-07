/* Aksara UI Polish v2: presentation-only controls.
 * Do not access the microphone, Gemini Live transport, token broker, or terminal runtime.
 * Native selects remain authoritative, hidden behind accessible glass pickers. */
(function(){
 "use strict";
 const $=id=>document.getElementById(id);
 const live=$("voiceLive");
 const term=$("aksaraAITerminal");
 const previewOnly=new URLSearchParams(location.search).get("voice-preview")==="1";
 // Load last in document order, after the optional V4.5 stylesheet.
 // Classic rollback still gets glass permission and Terminal dialogs.
 const applySkin=()=>{
  const sheet=document.createElement("link");
  sheet.rel="stylesheet";sheet.href="bilik-antara-ui-polish.css?v=2";
  document.head.appendChild(sheet);
 };
 if(document.readyState!=="complete")document.addEventListener("DOMContentLoaded",applySkin,{once:true});
 else applySkin();


 function microphonePreflight(){
  if(!live||!window.HTMLDialogElement||previewOnly)return;
  const modal=document.createElement("dialog");
  modal.id="aksaraMicPermission";
  modal.className="aksara-glass-prompt";
  modal.setAttribute("aria-labelledby","aksaraMicTitle");
  modal.setAttribute("aria-describedby","aksaraMicDescription");
  modal.innerHTML=[
   '<div class="aksara-glass-prompt-head"><span class="aksara-glass-mic-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false"><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5.5 10.5v1.6a6.5 6.5 0 0 0 13 0v-1.6M12 18.6V22m-4 0h8"/></svg></span><div><strong id="aksaraMicTitle">Aktifkan mikrofon</strong><small>AKSARA · VOICE CHAT</small></div></div>',
   '<p id="aksaraMicDescription">Aksara perlukan izin mikrofon untuk mendengar kau. Audio hanya dihantar ke Gemini Live apabila sesi suara diaktifkan.</p>',
   '<p class="aksara-glass-prompt-hint" id="aksaraMicHint">Brave akan minta kebenaran selepas kau tekan Aktifkan Mikrofon. Dialog keselamatan browser tidak boleh diubah.</p>',
   '<div class="aksara-glass-prompt-actions"><button type="button" id="aksaraMicCancel">Batal</button><button type="button" id="aksaraMicContinue">Aktifkan Mikrofon</button></div>'
  ].join("");
  document.body.appendChild(modal);
  const cancel=$("aksaraMicCancel"),proceed=$("aksaraMicContinue"),hint=$("aksaraMicHint");
  let permission="unknown",passThrough=false;
  const queryPermission=()=>{
   if(!navigator.permissions?.query)return;
   navigator.permissions.query({name:"microphone"}).then(status=>{
    permission=status.state;
    status.onchange=()=>{permission=status.state;};
   }).catch(()=>{});
  };
  queryPermission();
  const close=()=>{if(modal.open)modal.close();};
  cancel.addEventListener("click",close);
  modal.addEventListener("click",event=>{if(event.target===modal)close();});
  modal.addEventListener("close",()=>{if(!live.disabled)live.focus({preventScroll:true});});
  live.addEventListener("click",event=>{
   if(passThrough){passThrough=false;return;}
   if(permission==="granted"||live.disabled)return;
   event.preventDefault();
   event.stopImmediatePropagation();
   hint.textContent=permission==="denied"?
    "Akses pernah disekat. Benarkan mikrofon melalui tetapan tapak Brave, kemudian cuba lagi.":
    "Brave akan memaparkan dialog kebenaran sebenar selepas kau tekan Aktifkan Mikrofon.";
   if(!modal.open)modal.showModal();
  },{capture:true});
  proceed.addEventListener("click",()=>{
   close();
   // Reuse the genuine original Voice Live click handlers in the same user gesture.
   // No mock permissions, no microphone request or token call from this component.
   passThrough=true;
   live.click();
   passThrough=false;
   queryPermission();
  });
 }

 function terminalGlassPickers(){
  if(!term||!window.HTMLDialogElement)return;
  const picker=document.createElement("dialog");
  picker.id="aksaraTerminalGlassPicker";
  picker.className="aksara-glass-prompt aksara-terminal-picker";
  picker.setAttribute("aria-labelledby","aksaraPickerTitle");
  picker.innerHTML='<div class="aksara-glass-picker-head"><strong id="aksaraPickerTitle">Pilih contoh kod</strong><button id="aksaraPickerClose" type="button" aria-label="Tutup pilihan">Tutup</button></div><div id="aksaraPickerItems" class="aksara-glass-picker-list" role="listbox"></div>';
  document.body.appendChild(picker);
  const title=$("aksaraPickerTitle"),list=$("aksaraPickerItems");
  let activeButton=null;
  const closePicker=()=>{if(picker.open)picker.close();};
  $("aksaraPickerClose").addEventListener("click",closePicker);
  picker.addEventListener("click",event=>{if(event.target===picker)closePicker();});
  picker.addEventListener("close",()=>{
   if(activeButton&&term.open)activeButton.focus({preventScroll:true});
   activeButton?.setAttribute("aria-expanded","false");
   activeButton=null;
  });
  const attach=(selectId,buttonId,heading)=>{
   const native=$(selectId);
   if(!native||!native.parentElement)return;
   native.classList.add("ait-native-select");
   native.tabIndex=-1;
   native.setAttribute("aria-hidden","true");
   const button=document.createElement("button");
   button.id=buttonId;button.type="button";
   button.className="ait-glass-select";
   button.setAttribute("aria-haspopup","dialog");
   button.setAttribute("aria-controls",picker.id);
   button.setAttribute("aria-expanded","false");
   const value=document.createElement("span");
   value.className="ait-glass-select-label";
   const chevron=document.createElement("span");
   chevron.className="ait-glass-chevron";chevron.textContent="⌄";
   chevron.setAttribute("aria-hidden","true");
   button.append(value,chevron);
   native.after(button);
   const fieldLabel=native.parentElement?.querySelector('label[for="'+selectId+'"]');
   if(fieldLabel){
    fieldLabel.id=selectId+"Label";
    fieldLabel.htmlFor=buttonId;
    button.setAttribute("aria-labelledby",fieldLabel.id+" "+buttonId);
   }else button.setAttribute("aria-label",heading);
   const refresh=()=>{
    const selected=native.options[native.selectedIndex];
    value.textContent=selected?.textContent||"Pilih";
   };
   native.addEventListener("change",refresh);
   new MutationObserver(refresh).observe(native,{childList:true,subtree:true,attributes:true,attributeFilter:["selected"]});
   refresh();
   button.addEventListener("click",()=>{
    activeButton=button;
    title.textContent=heading;
    list.replaceChildren();
    for(const option of native.options){
     const item=document.createElement("button");
     item.type="button";item.className="aksara-glass-picker-option";
     item.setAttribute("role","option");
     item.setAttribute("aria-selected",String(option.value===native.value));
     const text=document.createElement("span");text.textContent=option.textContent;
     const tick=document.createElement("span");tick.setAttribute("aria-hidden","true");
     tick.textContent=option.value===native.value?"✓":"";
     item.append(text,tick);
     item.addEventListener("click",()=>{
      native.value=option.value;
      native.dispatchEvent(new Event("change",{bubbles:true}));
      refresh();
      closePicker();
     });
     list.appendChild(item);
    }
    button.setAttribute("aria-expanded","true");
    if(!picker.open)picker.showModal();
    (list.querySelector('[aria-selected="true"]')||list.querySelector("button"))?.focus({preventScroll:true});
   });
  };
  attach("aitFile","aitFileGlass","Pilih fail");
  attach("aitExampleSelect","aitExampleGlass","Pilih contoh kod");
  term.addEventListener("close",closePicker);
 }
 microphonePreflight();
 terminalGlassPickers();
})();