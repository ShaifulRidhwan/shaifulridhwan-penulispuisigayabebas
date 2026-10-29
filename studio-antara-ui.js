/* Accessible dark picker for Studio Antara; native selects remain the source of truth. */
(function(){
'use strict';
const selects=Array.from(document.querySelectorAll('.control-grid select'));
if(!selects.length)return;
const backdrop=document.createElement('div');
backdrop.className='studio-picker-backdrop';
backdrop.hidden=true;
backdrop.innerHTML='<div class="studio-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="studioPickerTitle"><div class="studio-picker-heading"><span id="studioPickerTitle"></span><button class="studio-picker-close" type="button" aria-label="Tutup pilihan">×</button></div><div class="studio-picker-options" role="group"></div></div>';
document.body.append(backdrop);
const heading=backdrop.querySelector('#studioPickerTitle');
const list=backdrop.querySelector('.studio-picker-options');
const closeButton=backdrop.querySelector('.studio-picker-close');
let active=null,trigger=null;
function nameFor(select){
 const label=document.querySelector('label[for="'+select.id+'"]');
 return label?.firstChild?.textContent.trim()||select.getAttribute('aria-label')||'Pilihan';
}
function sync(select){
 const btn=select._studioButton;
 if(!btn)return;
 btn.querySelector('span').textContent=select.selectedOptions[0]?.textContent||'Pilih';
 btn.disabled=select.disabled;
 btn.setAttribute('aria-label',nameFor(select)+': '+(select.selectedOptions[0]?.textContent||'Pilih'));
}
function close(){
 if(backdrop.hidden)return;
 backdrop.hidden=true;
 document.body.classList.remove('studio-picker-open');
 const prev=trigger;active=null;trigger=null;list.replaceChildren();
 prev?.focus({preventScroll:true});
}
function choose(value){
 if(!active||active.disabled)return;
 if(active.value!==value){
  active.value=value;
  active.dispatchEvent(new Event('change',{bubbles:true}));
 }
 sync(active);close();
}
function open(select){
 if(select.disabled)return;
 if(!backdrop.hidden)close();
 active=select;trigger=select._studioButton;
 heading.textContent=nameFor(select);
 list.replaceChildren();
 for(const option of select.options){
  if(option.disabled||option.hidden)continue;
  const button=document.createElement('button');
  button.type='button';button.className='studio-picker-option';
  button.textContent=option.textContent;
  button.setAttribute('aria-pressed',String(select.value===option.value));
  button.dataset.value=option.value;
  button.addEventListener('click',()=>choose(option.value));
  list.append(button);
 }
 if(!list.children.length){close();return;}
 backdrop.hidden=false;document.body.classList.add('studio-picker-open');
 (list.querySelector('[aria-pressed="true"]')||list.firstElementChild).focus({preventScroll:true});
}
for(const select of selects){
 const button=document.createElement('button');
 button.type='button';button.className='studio-picker-trigger';
 const caption=document.createElement('span');button.append(caption);
 select.classList.add('native-select-hidden');
 select.after(button);select._studioButton=button;
 sync(select);
 button.addEventListener('click',()=>open(select));
 select.addEventListener('change',()=>sync(select));
 new MutationObserver(()=>sync(select)).observe(select,{attributes:true,attributeFilter:['disabled']});
}
closeButton.addEventListener('click',close);
backdrop.addEventListener('click',event=>{if(event.target===backdrop)close();});
document.addEventListener('keydown',event=>{
 if(backdrop.hidden)return;
 if(event.key==='Escape'){event.preventDefault();close();return;}
 const options=Array.from(list.querySelectorAll('button'));
 const focusable=[...options,closeButton];
 const index=focusable.indexOf(document.activeElement);
 if(event.key==='Tab'){
  if(event.shiftKey&&index<=0){event.preventDefault();focusable[focusable.length-1].focus();}
  else if(!event.shiftKey&&index===focusable.length-1){event.preventDefault();focusable[0].focus();}
 }else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
  event.preventDefault();
  const selected=options.indexOf(document.activeElement);
  const next=event.key==='Home'?0:event.key==='End'?options.length-1:event.key==='ArrowDown'?(selected+1+options.length)%options.length:(selected-1+options.length)%options.length;
  options[next]?.focus();
 }
});
})();
