/* AKSARA Code Workspace: private in-tab snippets for four supported languages. */
(function(){
"use strict";
const bridge=window.BilikAntaraBridge,engine=window.AksaraCodeRuntime;
if(!bridge||!engine)return;
const ext={javascript:".js",python:".py",typescript:".ts",sql:".sql"};
const languageOf=name=>Object.keys(ext).find(k=>name.toLowerCase().endsWith(ext[k]))||null;
let files=[{name:"main.js",language:"javascript",code:""}],index=0;
const dialog=document.createElement("dialog");
dialog.id="codeWorkspaceDialog";dialog.className="multi-ai-dialog code-workspace-dialog";
dialog.innerHTML=[
 '<div class="multi-ai-head"><div><strong>AKSARA Code Workspace</strong><p>Snippet dalam tab ini. Tidak disimpan pada server, tidak dihantar ke AI dan tidak dijalankan automatik.</p></div><button type="button" id="cwClose" aria-label="Tutup">×</button></div>',
 '<div class="cw-body"><label for="cwFiles">Fail</label><select id="cwFiles"></select><div class="cw-tools"><button id="cwAdd" type="button">+ Fail</button><button id="cwDelete" type="button">Buang</button><button id="cwImport" type="button">Import</button><input type="file" accept=".js,.py,.ts,.sql" id="cwUpload" hidden/></div><label for="cwEditor">Editor</label><textarea id="cwEditor" rows="12" spellcheck="false"></textarea><p id="cwInfo" role="status" aria-live="polite"></p></div>',
 '<div class="multi-ai-actions cw-actions"><button type="button" id="cwUse">Gunakan di chatbox</button><button type="button" id="cwExport">Eksport JSON</button></div>'
].join("");
document.body.appendChild(dialog);
const $=id=>dialog.querySelector("#"+id),select=$("cwFiles"),editor=$("cwEditor"),info=$("cwInfo");
const style=document.createElement("style");
style.textContent=[
'.code-workspace-dialog .cw-body{display:grid;gap:8px;margin-top:14px;font:500 12px "DM Sans",sans-serif}',
'.code-workspace-dialog .cw-body label{color:#ead6b9;font-weight:600}',
'.code-workspace-dialog :is(select,textarea){box-sizing:border-box;width:100%;border:1px solid rgba(232,205,161,.3);background:rgba(8,15,25,.3);color:#f2e9dd;padding:10px;border-radius:11px}',
'.code-workspace-dialog textarea{font:12px/1.55 ui-monospace,Consolas,monospace;min-height:165px;max-height:34dvh;resize:vertical}',
'.code-workspace-dialog .cw-tools,.code-workspace-dialog .cw-actions{display:flex;gap:7px;flex-wrap:wrap}',
'.code-workspace-dialog :is(.cw-tools,.cw-actions) button{flex:1 1 auto;border:1px solid rgba(232,205,161,.3);border-radius:10px;background:rgba(255,255,255,.04);color:#ebd8bb;padding:10px;font:600 11px "DM Sans",sans-serif;cursor:pointer}',
'.code-workspace-dialog #cwInfo{margin:0;color:#bdb4a8;font-size:11px;line-height:1.5}'
].join("\n");document.head.appendChild(style);
function save(){files[index].code=editor.value.slice(0,12000);}
function render(){
 select.replaceChildren();files.forEach((f,i)=>{const o=document.createElement("option");o.value=i;o.textContent=f.name;select.append(o);});
 select.value=String(index);editor.value=files[index].code;info.textContent=files.length+" fail sementara · tiada auto-simpan";
}
function add(name,code=""){
 const lang=languageOf(name);
 if(!lang||!/^[A-Za-z0-9_.-]{1,70}\.(js|ts|py|sql)$/i.test(name))throw Error("Hanya fail .js, .ts, .py atau .sql.");
 if(files.length>=12||code.length>12000)throw Error("Had 12 fail, maksimum 12,000 aksara setiap fail.");
 if(files.some(f=>f.name.toLowerCase()===name.toLowerCase()))throw Error("Nama fail sudah wujud.");
 save();files.push({name,language:lang,code});index=files.length-1;render();
}
editor.addEventListener("input",save);
select.addEventListener("change",()=>{save();index=Number(select.value);render();});
$("cwAdd").addEventListener("click",()=>{
 const extension=ext[files[index].language];
 let n=files.length+1,name="snippet-"+n+extension;
 while(files.some(f=>f.name===name))name="snippet-"+(++n)+extension;
 try{add(name);}catch(e){info.textContent=e.message;}
});
$("cwDelete").addEventListener("click",()=>{
 if(!confirm("Buang "+files[index].name+" daripada tab ini?"))return;
 files.splice(index,1);if(!files.length)files=[{name:"main.js",language:"javascript",code:""}];
 index=Math.min(index,files.length-1);render();
});
$("cwImport").addEventListener("click",()=>$("cwUpload").click());
$("cwUpload").addEventListener("change",async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{if(file.size>24000)throw Error("Fail terlalu besar.");add(file.name,await file.text());}
 catch(error){info.textContent="Import gagal: "+error.message;}
 e.target.value="";
});
$("cwUse").addEventListener("click",()=>{
 save();const f=files[index];if(!f.code.trim()){info.textContent="Masukkan kod dahulu.";return;}
 const fence=String.fromCharCode(96).repeat(3);
 bridge.fill(fence+f.language+"\n"+f.code.trim()+"\n"+fence);
 dialog.close(); // Must press Jalankan Kod separately.
});
$("cwExport").addEventListener("click",()=>{
 save();const blob=new Blob([JSON.stringify({format:"aksara-workspace-v1",files},null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="AKSARA-Code-Workspace.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 info.textContent="Fail JSON dieksport atas tindakan pengguna.";
});
$("cwClose").addEventListener("click",()=>dialog.close());
dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});
window.addEventListener("aksara:code-workspace-open",()=>{render();if(!dialog.open)dialog.showModal();});
window.addEventListener("ba:cleared",()=>{files=[{name:"main.js",language:"javascript",code:""}];index=0;if(dialog.open)dialog.close();});
window.AksaraCodeWorkspace=Object.freeze({version:"1.0",fileCount:()=>files.length});
})();
