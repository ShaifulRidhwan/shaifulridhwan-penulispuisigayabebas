(function(){
"use strict";
/*
 * Studio Antara structured editor (MIT Tiptap + ProseMirror).
 * Optional enhancement: old offline contenteditable workflow remains usable
 * whenever the CDN is unavailable. No document data is sent to the CDN.
 */
const $=id=>document.getElementById(id);
const root=$("richDocument"),bridge=window.StudioRich;
if(!root||!bridge)return;
const VERSION="3.31.3";
const BASE="https://cdn.jsdelivr.net/npm/";
const load=(name)=>import(BASE+name+"@"+VERSION+"/+esm");
const STORAGE="aksara:studio:document-draft:v1";
function plainToHTML(value){
 const box=document.createElement("div");
 for(const paragraph of String(value||"").split(/\n{2,}/)){
  const p=document.createElement("p");p.textContent=paragraph.trim();box.appendChild(p);
 }
 return box.innerHTML||"<p></p>";
}
async function start(){
 try{
  const [core,starter,tables,images,align]=await Promise.all([
   load("@tiptap/core"),load("@tiptap/starter-kit"),
   load("@tiptap/extension-table"),load("@tiptap/extension-image"),load("@tiptap/extension-text-align")
  ]);
  const Editor=core.Editor,Node=core.Node,StarterKit=starter.default||starter.StarterKit;
  const TableKit=tables.TableKit,ImageNode=images.Image||images.default;
  const TextAlign=align.TextAlign||align.default;
  if(!Editor||!StarterKit||!TableKit||!ImageNode||!TextAlign)throw Error("Komponen editor tidak lengkap");
  const PageBreak=Node.create({
   name:"pageBreak",group:"block",atom:true,selectable:true,priority:1000,
   parseHTML(){return [{tag:'hr[data-page-break="true"]'}];},
   renderHTML(){return ["hr",{"data-page-break":"true"}];},
   addCommands(){return {insertPageBreak:()=>({commands})=>commands.insertContent({type:"pageBreak"})};}
  });
  // Keep the original DOM content as the single source for migration.
  const starting=bridge.getHTML()||"<p></p>";
  const editor=new Editor({
   element:root,
   extensions:[
    StarterKit.configure({horizontalRule:false}),
    TableKit,
    ImageNode.configure({allowBase64:true,inline:true}),
    TextAlign.configure({types:["heading","paragraph"],alignments:["left","center","right","justify"]}),
    PageBreak
   ],
   content:starting,
   onUpdate:()=>{updateStatus();bridge.changed();}
  });
  let saving=false;
  function updateStatus(){
   const text=editor.getText().trim();
   const count=text?text.split(/\s+/u).length:0;
   $("docCounts").textContent=count+" perkataan · "+text.length+" aksara";
   $("docSaved").textContent="Belum disimpan";
  }
  function saveDraft(){
   if(saving)return false;
   saving=true;
   try{
    const data={title:$("docTitle").value,template:$("docTemplate").value,html:editor.getHTML(),at:Date.now()};
    if(JSON.stringify(data).length>1500000){$("docSaved").textContent="Draf terlalu besar untuk simpanan";return false;}
    localStorage.setItem(STORAGE,JSON.stringify(data));
    $("docSaved").textContent="Disimpan pada peranti";return true;
   }catch(_){$("docSaved").textContent="Simpanan tidak tersedia";return false;}
   finally{saving=false;}
  }
  // Mutate the existing adapter object because the advanced tools have a reference to it.
  bridge.getHTML=()=>editor.getHTML();
  bridge.getText=()=>editor.getText();
  bridge.setHTML=html=>editor.commands.setContent(bridgeSanitize(html));
  bridge.setText=text=>editor.commands.setContent(plainToHTML(text));
  bridge.saveDraft=saveDraft;
  let autosaveTimer=null;
  bridge.changed=()=>{
   updateStatus();window.StudioAntara?.render?.();
   clearTimeout(autosaveTimer);autosaveTimer=setTimeout(saveDraft,1100);
  };
  bridge.insertHTML=html=>editor.chain().focus().insertContent(bridgeSanitize(html)).run();
  bridge.editor=root;
  bridge.tiptap=editor;
  window.StudioTipTap={ready:true,editor,version:VERSION};

  function bridgeSanitize(html){
   // Legacy sanitizer remains the first boundary for external HTML imports.
   const temp=document.createElement("div");temp.innerHTML=String(html||"");
   // Drop executable elements and attributes before handing to the schema parser.
   temp.querySelectorAll("script,style,iframe,object,embed,svg,form,link,meta").forEach(n=>n.remove());
   temp.querySelectorAll("*").forEach(n=>{
    for(const attr of [...n.attributes]){
     if(/^on/i.test(attr.name))n.removeAttribute(attr.name);
     if(attr.name==="href"&&!/^https?:\/\//i.test(attr.value))n.removeAttribute(attr.name);
     if(attr.name==="src"&&!/^data:image\/(png|jpeg|webp);base64,/i.test(attr.value))n.removeAttribute(attr.name);
    }
   });
   return temp.innerHTML;
  }
  function applyFormat(cmd){
   const chain=editor.chain().focus();
   switch(cmd){
    case "bold":return chain.toggleBold().run();
    case "italic":return chain.toggleItalic().run();
    case "underline":return chain.toggleUnderline().run();
    case "insertOrderedList":return chain.toggleOrderedList().run();
    case "insertUnorderedList":return chain.toggleBulletList().run();
    case "justifyLeft":return chain.setTextAlign("left").run();
    case "justifyCenter":return chain.setTextAlign("center").run();
    case "justifyRight":return chain.setTextAlign("right").run();
    case "undo":return chain.undo().run();
    case "redo":return chain.redo().run();
    default:return false;
   }
  }
  // Capture toolbar events ahead of the legacy execCommand handler.
  const toolbar=$("docToolbar");
  toolbar.addEventListener("click",event=>{
   const button=event.target.closest("button[data-format]");
   if(!button)return;
   event.preventDefault();event.stopImmediatePropagation();
   applyFormat(button.dataset.format);
  },true);
  $("docStyle").addEventListener("change",event=>{
   event.stopImmediatePropagation();
   const style=event.target.value,chain=editor.chain().focus();
   if(style==="p")chain.setParagraph().run();
   else if(/^h[123]$/.test(style))chain.toggleHeading({level:Number(style.slice(1))}).run();
   else if(style==="blockquote")chain.toggleBlockquote().run();
  },true);
  $("docClear").addEventListener("click",event=>{
   event.preventDefault();event.stopImmediatePropagation();
   editor.chain().focus().unsetAllMarks().clearNodes().run();
  },true);
  $("docLink").addEventListener("click",event=>{
   event.preventDefault();event.stopImmediatePropagation();
   const input=window.prompt("URL pautan (https://…):","");
   if(input===null)return;
   if(!/^https?:\/\//i.test(input)){ $("docSaved").textContent="Pautan mesti bermula dengan http:// atau https://";return; }
   editor.chain().focus().setLink({href:input}).run();
  },true);
  // Legacy button handlers operate directly on contenteditable DOM.
  // Keep them from mutating ProseMirror's managed document.
  $("docNew").addEventListener("click",event=>{
   event.preventDefault();event.stopImmediatePropagation();
   if((editor.getText().trim()||$("docTitle").value.trim())&&!confirm("Mulakan dokumen baharu? Draf semasa akan diganti."))return;
   editor.commands.clearContent();$("docTitle").value="";$("docTemplate").value="report";
   try{localStorage.removeItem(STORAGE);}catch(_){}
   updateStatus();editor.commands.focus();
  },true);
  $("docFile").addEventListener("change",async event=>{
   event.stopImmediatePropagation();
   const file=event.target.files?.[0];event.target.value="";
   if(!file||file.size>500000){$("docSaved").textContent="Fail tidak sah atau lebih 500 KB.";return;}
   if(editor.getText().trim()&&!confirm("Gantikan dokumen dengan fail ini?"))return;
   try{
    const contents=await file.text();
    if(/\.html?$/i.test(file.name))bridge.setHTML(contents);
    else bridge.setText(contents);
    if(!$("docTitle").value.trim())$("docTitle").value=file.name.replace(/\.[^.]+$/,"").slice(0,140);
    saveDraft();
   }catch(_){$("docSaved").textContent="Gagal import fail.";}
  },true);
  // Structured tables and page breaks require model-aware insertion.
  $("docTable").addEventListener("click",event=>{
   event.preventDefault();event.stopImmediatePropagation();
   const rows=Number(prompt("Bilangan baris (1-15):","3"));
   if(!Number.isInteger(rows)||rows<1||rows>15)return;
   const cols=Number(prompt("Bilangan lajur (1-8):","3"));
   if(!Number.isInteger(cols)||cols<1||cols>8)return;
   editor.chain().focus().insertTable({rows,cols,withHeaderRow:true}).run();
  },true);
  $("docPageBreak").addEventListener("click",event=>{
   event.preventDefault();event.stopImmediatePropagation();
   editor.chain().focus().insertPageBreak().run();
  },true);
  // Replace-all as ProseMirror transactions, not raw text-node mutations.
  function matches(query){
   const output=[];
   if(!query)return output;
   editor.state.doc.descendants((node,pos)=>{
    if(!node.isText)return;
    const lower=(node.text||"").toLocaleLowerCase("ms-MY");
    const needle=query.toLocaleLowerCase("ms-MY");
    let at=lower.indexOf(needle);
    while(at>=0){output.push({from:pos+at,to:pos+at+query.length});at=lower.indexOf(needle,at+needle.length);}
   });
   return output;
  }
  for(const id of ["docFindNext","docReplaceOne","docReplaceAll"]){
   $(id).addEventListener("click",event=>{
    event.preventDefault();event.stopImmediatePropagation();
    const query=$("docFindText").value,all=matches(query);
    if(!query){$("docFindStatus").textContent="Masukkan teks carian.";return;}
    if(!all.length){$("docFindStatus").textContent="Tiada padanan.";return;}
    if(id==="docReplaceAll"){
     const replacement=$("docReplaceText").value;
     // Run from the last position so earlier offsets remain valid.
     let chain=editor.chain();
     for(const m of [...all].reverse())chain=chain.insertContentAt({from:m.from,to:m.to},replacement);
     chain.run();
     $("docFindStatus").textContent=all.length+" padanan diganti.";return;
    }
    const current=editor.state.selection.to;
    const target=all.find(m=>m.from>=current)||all[0];
    if(id==="docReplaceOne"){
     editor.chain().insertContentAt({from:target.from,to:target.to},$("docReplaceText").value).run();
     $("docFindStatus").textContent="Satu padanan diganti.";
    }else{
     editor.chain().focus().setTextSelection({from:target.from,to:target.to}).run();
     $("docFindStatus").textContent=all.length+" padanan dijumpai.";
    }
   },true);
  }
  root.removeAttribute("contenteditable");
  root.classList.add("tiptap-ready");
  $("docSaved").textContent="Enjin Tiptap aktif · Draf pada peranti";
  console.info("Studio Antara: Tiptap MIT engine ready");
 }catch(err){
  console.warn("Studio Antara: Tiptap not loaded, using legacy editor",err);
  $("docSaved").textContent="Editor asas aktif · Mod lanjutan tidak tersedia";
 }
}
start();
})();