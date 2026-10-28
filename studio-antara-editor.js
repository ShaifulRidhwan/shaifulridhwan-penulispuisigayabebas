(function(){
"use strict";
/* Studio Antara: lightweight rich-text editing, with local-only drafts. */
const $=id=>document.getElementById(id);
const editor=$("richDocument"),title=$("docTitle"),saved=$("docSaved"),counts=$("docCounts");
if(!editor)return;
const KEY="aksara:studio:document-draft:v1";
const SAFE_TAGS=new Set(["P","DIV","BR","H1","H2","H3","BLOCKQUOTE","STRONG","B","EM","I","U","S","UL","OL","LI","A"]);
let dirty=false,saveTimer=null,changeCallback=()=>{};
function sanitize(markup){
 const parsed=new DOMParser().parseFromString(String(markup||""),"text/html");
 function walk(parent){
  for(const node of [...parent.childNodes]){
   if(node.nodeType===8){node.remove();continue;}
   if(node.nodeType!==1){if(node.nodeType!==3)node.remove();continue;}
   if(["SCRIPT","STYLE","SVG","MATH","IFRAME","OBJECT","FORM","IMG","VIDEO","AUDIO","INPUT","BUTTON","META"].includes(node.tagName)){node.remove();continue;}
   const safeHref=node.tagName==="A"&&/^https?:\/\//i.test(node.getAttribute("href")||"")?node.getAttribute("href"):null;
   walk(node);
   if(!SAFE_TAGS.has(node.tagName)){node.replaceWith(...[...node.childNodes]);continue;}
   const align=/^text-align:\\s*(left|center|right|justify)\\s*;?$/i.exec((node.getAttribute("style")||"").trim());
   for(const attr of [...node.attributes])node.removeAttribute(attr.name);
   if(align)node.style.textAlign=align[1].toLowerCase();
   if(node.tagName==="A"&&safeHref){node.setAttribute("href",safeHref);node.setAttribute("rel","noopener noreferrer");}
  }
 }
 walk(parsed.body);
 return parsed.body.innerHTML;
}
function getHTML(){return sanitize(editor.innerHTML);}
function getText(){return editor.innerText||editor.textContent||"";}
function setHTML(html){editor.innerHTML=sanitize(html);update(false);}
function setText(text){editor.replaceChildren();for(const p of String(text||"").split(/\n{2,}/)){const block=document.createElement("p");block.textContent=p.trim();editor.appendChild(block);}update(false);}
function update(edited=true){
 const text=getText().trim(),words=text?text.split(/\s+/u).length:0;
 counts.textContent=words+" perkataan · "+text.length+" aksara";
 if(edited){dirty=true;saved.textContent="Belum disimpan";clearTimeout(saveTimer);saveTimer=setTimeout(saveDraft,950);}
 changeCallback();
}
function saveDraft(){
 clearTimeout(saveTimer);
 const data={title:title.value,template:$("docTemplate").value,html:getHTML(),at:Date.now()};
 try{
  if(JSON.stringify(data).length>350000){saved.textContent="Draf terlalu besar untuk simpanan automatik";return false;}
  localStorage.setItem(KEY,JSON.stringify(data));dirty=false;saved.textContent="Disimpan pada peranti";return true;
 }catch(_){saved.textContent="Simpanan tidak tersedia";return false;}
}
function restoreDraft(){
 try{
  const data=JSON.parse(localStorage.getItem(KEY)||"null");
  if(!data||typeof data.html!=="string")return;
  title.value=String(data.title||"").slice(0,140);
  if(["report","letter","resume","proposal","notes"].includes(data.template))$("docTemplate").value=data.template;
  setHTML(data.html);dirty=false;saved.textContent="Draf dipulihkan dari peranti";
 }catch(_){}
}
function command(cmd,value){
 editor.focus();
 try{document.execCommand(cmd,false,value||null);}catch(_){}
 update();
}
$("docToolbar").addEventListener("mousedown",event=>{
 if(event.target.closest("button"))event.preventDefault();
});
$("docToolbar").addEventListener("click",event=>{
 const button=event.target.closest("[data-format]");if(!button)return;
 command(button.dataset.format);
});
$("docStyle").addEventListener("change",event=>{command("formatBlock",event.target.value);});
$("docLink").addEventListener("click",()=>{
 const url=window.prompt("URL pautan (https://…):","");
 if(url===null)return;
 if(!/^https?:\/\//i.test(url)){saved.textContent="Pautan mesti bermula dengan https:// atau http://";return;}
 command("createLink",url);
});
$("docClear").addEventListener("click",()=>{command("removeFormat");});
$("docSaveDraft").addEventListener("click",saveDraft);
$("docNew").addEventListener("click",()=>{
 if((getText().trim()||title.value.trim())&&!window.confirm("Mulakan dokumen baharu? Draf semasa pada peranti akan diganti."))return;
 editor.replaceChildren();title.value="";$("docTemplate").value="report";localStorage.removeItem(KEY);update(false);saved.textContent="Dokumen baharu";editor.focus();
});
$("docImport").addEventListener("click",()=>$("docFile").click());
$("docFile").addEventListener("change",async event=>{
 const file=event.target.files?.[0];event.target.value="";
 if(!file)return;
 if(file.size>500000){saved.textContent="Fail melebihi 500 KB";return;}
 if((getText().trim()||title.value.trim())&&!window.confirm("Gantikan isi dokumen dengan fail import?"))return;
 try{
  const data=await file.text();
  if(/\.html?$/i.test(file.name))setHTML(data);else setText(data);
  if(!title.value.trim())title.value=file.name.replace(/\.[^.]+$/,"").slice(0,140);
  saveDraft();
 }catch(_){saved.textContent="Gagal membaca fail"; }
});
editor.addEventListener("paste",event=>{
 const html=event.clipboardData?.getData("text/html");
 if(!html)return;
 event.preventDefault();
 const clean=sanitize(html);document.execCommand("insertHTML",false,clean);update();
});
editor.addEventListener("input",()=>update());
title.addEventListener("input",()=>{dirty=true;clearTimeout(saveTimer);saveTimer=setTimeout(saveDraft,950);});
$("docTemplate").addEventListener("change",()=>{clearTimeout(saveTimer);saveTimer=setTimeout(saveDraft,950);});
window.StudioRich={getHTML,getText,setHTML,setText,saveDraft,restoreDraft,onChange:fn=>{changeCallback=fn;}};
restoreDraft();update(false);
})();