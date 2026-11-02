/* AKSARA Code Workspace: private in-tab snippets and isolated HTML/CSS live preview. */
(function(){
"use strict";
const bridge=window.BilikAntaraBridge,engine=window.AksaraCodeRuntime;
if(!bridge||!engine)return;
const ext={javascript:".js",python:".py",typescript:".ts",sql:".sql",html:".html",css:".css",cpp:".cpp"};
const languageOf=name=>Object.keys(ext).find(k=>name.toLowerCase().endsWith(ext[k]))||null;
let files=[{name:"main.js",language:"javascript",code:""}],index=0;
const dialog=document.createElement("dialog");
dialog.id="codeWorkspaceDialog";dialog.className="multi-ai-dialog code-workspace-dialog";
dialog.innerHTML=[
 '<div class="multi-ai-head"><div><strong>AKSARA Code Workspace</strong><p>Snippet dalam tab ini. Tidak disimpan pada server, tidak dihantar ke AI dan tidak dijalankan automatik.</p></div><button type="button" id="cwClose" aria-label="Tutup">×</button></div>',
 '<div class="cw-body"><label for="cwFiles">Fail</label><select id="cwFiles"></select><div class="cw-tools"><button id="cwAdd" type="button">+ Fail</button><button id="cwDelete" type="button">Buang</button><button id="cwImport" type="button">Import</button><input type="file" accept=".js,.py,.ts,.sql,.html,.css,.cpp" id="cwUpload" hidden/></div><label for="cwEditor">Editor</label><textarea id="cwEditor" rows="12" spellcheck="false"></textarea><p id="cwInfo" role="status" aria-live="polite"></p></div>',
 '<div class="cw-preview" id="cwPreviewPanel"><div class="cw-preview-head"><strong>HTML / CSS · Live Preview</strong><div class="cw-preview-tools"><button type="button" id="cwMobile" aria-pressed="false">Mobile</button><button type="button" id="cwDesktop" aria-pressed="true">Desktop</button><button type="button" id="cwPreviewRefresh">Segar semula</button></div></div><p id="cwPreviewInfo" role="status" aria-live="polite">Tambah fail .html untuk melihat paparan.</p><div class="cw-preview-frame"><iframe id="cwPreviewFrame" title="HTML/CSS Live Preview (sandbox)" sandbox="" referrerpolicy="no-referrer"></iframe></div><p class="cw-preview-note">Preview setempat sahaja · JavaScript dan rangkaian dinyahaktifkan dalam preview v0.2.</p></div>',
 '<section class="cw-cpp" id="cwCppPanel" hidden><strong>C++20 · Clang WASM Console</strong><p>Compiler sebenar dimuatkan bila Run ditekan (~29 MB kali pertama). Kod kekal dalam sandbox browser.</p><label for="cwCppStdin">Standard input (cin), jika perlu</label><textarea id="cwCppStdin" rows="2" maxlength="4000" placeholder="Input untuk std::cin (pilihan)"></textarea><div class="cw-cpp-actions"><button type="button" id="cwCppRun">▶ Run C++</button><button type="button" id="cwCppStop" disabled>■ Henti</button></div><p id="cwCppStatus" role="status" aria-live="polite">Sedia untuk compile.</p><pre id="cwCppOutput" role="log" aria-live="polite">Output console akan muncul di sini.</pre></section>',
 '<div class="multi-ai-actions cw-actions"><button type="button" id="cwUse">Gunakan di chatbox</button><button type="button" id="cwExport">Eksport JSON</button></div>'
].join("");
document.body.appendChild(dialog);
const $=id=>dialog.querySelector("#"+id),select=$("cwFiles"),editor=$("cwEditor"),info=$("cwInfo"),cppPanel=$("cwCppPanel");
const style=document.createElement("style");
style.textContent=[
'.code-workspace-dialog .cw-body{display:grid;gap:8px;margin-top:14px;font:500 12px "DM Sans",sans-serif}',
'.code-workspace-dialog .cw-body label{color:#ead6b9;font-weight:600}',
'.code-workspace-dialog :is(select,textarea){box-sizing:border-box;width:100%;border:1px solid rgba(232,205,161,.3);background:rgba(8,15,25,.3);color:#f2e9dd;padding:10px;border-radius:11px}',
'.code-workspace-dialog textarea{font:12px/1.55 ui-monospace,Consolas,monospace;min-height:165px;max-height:34dvh;resize:vertical}',
'.code-workspace-dialog .cw-tools,.code-workspace-dialog .cw-actions{display:flex;gap:7px;flex-wrap:wrap}',
'.code-workspace-dialog :is(.cw-tools,.cw-actions) button{flex:1 1 auto;border:1px solid rgba(232,205,161,.3);border-radius:10px;background:rgba(255,255,255,.04);color:#ebd8bb;padding:10px;font:600 11px "DM Sans",sans-serif;cursor:pointer}',
'.code-workspace-dialog #cwInfo{margin:0;color:#bdb4a8;font-size:11px;line-height:1.5}',
'.code-workspace-dialog .cw-preview{display:grid;gap:9px;margin:14px 0;padding:12px;border-radius:13px;border:1px solid rgba(232,205,161,.22);background:rgba(5,10,19,.2)}',
'.code-workspace-dialog .cw-preview-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;font:600 12px "DM Sans",sans-serif;color:#ead6b9}',
'.code-workspace-dialog .cw-preview-tools{display:flex;gap:5px;flex-wrap:wrap}',
'.code-workspace-dialog .cw-preview-tools button{border:1px solid rgba(232,205,161,.27);border-radius:8px;background:rgba(255,255,255,.04);padding:7px 9px;color:#ebd8bb;cursor:pointer;font:600 10px "DM Sans",sans-serif}',
'.code-workspace-dialog .cw-preview-tools button[aria-pressed="true"]{background:rgba(209,172,117,.25);border-color:rgba(232,205,161,.6)}',
'.code-workspace-dialog .cw-preview-frame{display:flex;justify-content:center;align-items:stretch;min-height:220px;border-radius:10px;overflow:hidden;background:white}',
'.code-workspace-dialog .cw-preview-frame iframe{width:100%;height:245px;max-width:100%;border:0;background:white;transition:max-width .2s ease}',
'.code-workspace-dialog .cw-preview-frame.is-mobile iframe{max-width:375px}',
'.code-workspace-dialog :is(#cwPreviewInfo,.cw-preview-note){margin:0;color:#bdb4a8;font:500 11px/1.5 "DM Sans",sans-serif}',
'.code-workspace-dialog .cw-cpp[hidden]{display:none!important}',
'.code-workspace-dialog .cw-cpp{display:grid;gap:9px;margin:12px 0;padding:12px;border:1px solid rgba(232,205,161,.28);border-radius:13px;background:rgba(6,12,21,.28);font:500 12px "DM Sans",sans-serif}',
'.code-workspace-dialog .cw-cpp strong{color:#e9d5b7}',
'.code-workspace-dialog .cw-cpp p{margin:0;color:#bfb7ad;font-size:11px;line-height:1.5}',
'.code-workspace-dialog .cw-cpp label{color:#f0d7b3}',
'.code-workspace-dialog .cw-cpp textarea{min-height:54px;max-height:100px;resize:vertical}',
'.code-workspace-dialog .cw-cpp-actions{display:flex;gap:8px}',
'.code-workspace-dialog .cw-cpp-actions button{flex:1;padding:10px 12px;border:1px solid rgba(232,205,161,.32);border-radius:10px;color:#f2e0c6;background:rgba(255,255,255,.035);cursor:pointer}',
'.code-workspace-dialog .cw-cpp-actions button:disabled{opacity:.4;cursor:default}',
'.code-workspace-dialog #cwCppOutput{margin:0;box-sizing:border-box;max-height:180px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;background:rgba(2,7,14,.55);border:1px solid rgba(232,205,161,.17);border-radius:9px;padding:10px;color:#e9e6dd;font:12px/1.5 ui-monospace,Consolas,monospace}',
'@media(max-width:480px){.code-workspace-dialog .cw-preview{padding:9px}.code-workspace-dialog .cw-preview-frame iframe{height:230px}}'
].join("\n");document.head.appendChild(style);
function save(){files[index].code=editor.value.slice(0,12000);}
function render(){
 select.replaceChildren();files.forEach((f,i)=>{const o=document.createElement("option");o.value=i;o.textContent=f.name;select.append(o);});
 select.value=String(index);editor.value=files[index].code;info.textContent=files.length+" fail sementara · tiada auto-simpan";
 cppPanel.hidden=files[index].language!=="cpp";
}
function add(name,code=""){
 const lang=languageOf(name);
 if(!lang||!/^[A-Za-z0-9_.-]{1,70}\.(js|ts|py|sql|html|css|cpp)$/i.test(name))throw Error("Hanya fail .js, .ts, .py, .sql, .html, .css atau .cpp.");
 if(files.length>=12||code.length>12000)throw Error("Had 12 fail, maksimum 12,000 aksara setiap fail.");
 if(files.some(f=>f.name.toLowerCase()===name.toLowerCase()))throw Error("Nama fail sudah wujud.");
 save();files.push({name,language:lang,code});index=files.length-1;render();schedulePreview();
}

/* HTML/CSS-only preview: opaque-origin iframe, no scripts, forms, storage or network.
   This intentionally does not execute JavaScript; the JS runtime remains independent. */
const previewFrame=$("cwPreviewFrame"),previewInfo=$("cwPreviewInfo");
const previewBox=dialog.querySelector(".cw-preview-frame");
let previewTimer=0;
function ensureWebStarter(){
 const existing=files.findIndex(f=>f.language==="html");
 if(existing>=0){save();index=existing;return;}
 save();
 if(files.length>10){info.textContent="Buang fail terlebih dahulu untuk projek HTML.";return;}
 files.push({name:"index.html",language:"html",code:'<main class="card">\n  <h1>Antara Aksara dan Code</h1>\n  <p>HTML + CSS Live Preview v0.2</p>\n  <button>AKSARA</button>\n</main>'});
 files.push({name:"style.css",language:"css",code:'body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #101827; color: #f3e7d0; font: 16px system-ui; }\n.card { text-align: center; padding: 24px; }\nbutton { padding: 10px 18px; border-radius: 12px; border: 1px solid #dec194; background: transparent; color: inherit; }'});
 index=files.length-2;
}
function ensureCppStarter(){
 const current=files.findIndex(f=>f.language==="cpp");
 if(current>=0){save();index=current;return;}
 if(files.length>=12){info.textContent="Had 12 fail sudah dicapai.";return;}
 save();
 files.push({name:"main.cpp",language:"cpp",
  code:'#include <iostream>\\nint main() {\\n    std::cout << "Salam dari AKSARA C++!" << std::endl;\\n    std::cout << (6 * 7) << std::endl;\\n    return 0;\\n}'});
 index=files.length-1;
}
function safePreviewDocument(html,css){
 const doc=new DOMParser().parseFromString(html,"text/html");
 // Remove executable and embeddable markup before serialization.
 doc.querySelectorAll("script,iframe,frame,frameset,object,embed,base,form,link,meta[http-equiv],portal").forEach(n=>n.remove());
 doc.querySelectorAll("*").forEach(node=>{
  for(const attr of Array.from(node.attributes)){
   const name=attr.name.toLowerCase(),value=attr.value.trim();
   if(name.startsWith("on")||name==="srcdoc"||name==="formaction"||
      (["href","src","action","xlink:href"].includes(name)&&
       !((name==="href"||name==="xlink:href")&&value.startsWith("#"))&&
       !(name==="src"&&/^data:image\/(png|jpeg|gif|webp|svg\+xml);/i.test(value)))){
    node.removeAttribute(attr.name);
   }
  }
 });
 const policy=doc.createElement("meta");
 policy.setAttribute("http-equiv","Content-Security-Policy");
 policy.setAttribute("content","default-src 'none'; script-src 'none'; connect-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; media-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'");
 doc.head.prepend(policy);
 if(css.trim()){
  const style=doc.createElement("style");style.textContent=css.slice(0,24000);doc.head.appendChild(style);
 }
 return "<!doctype html>\n"+doc.documentElement.outerHTML;
}
function updatePreview(){
 if(!dialog.open)return;
 const htmlFile=files.find(f=>f.language==="html");
 if(!htmlFile){previewFrame.removeAttribute("srcdoc");previewInfo.textContent="Tambah fail .html untuk melihat paparan.";return;}
 const css=files.filter(f=>f.language==="css").map(f=>f.code).join("\n");
 try{
  previewFrame.srcdoc=safePreviewDocument(htmlFile.code,css);
  previewInfo.textContent="Preview: "+htmlFile.name+" · "+files.filter(f=>f.language==="css").length+" fail CSS · rangkaian/JavaScript disekat";
 }catch(error){
  previewFrame.removeAttribute("srcdoc");
  previewInfo.textContent="Preview gagal: "+String(error.message||error).slice(0,100);
 }
}
function schedulePreview(){clearTimeout(previewTimer);previewTimer=setTimeout(updatePreview,350);}
$("cwPreviewRefresh").addEventListener("click",()=>{clearTimeout(previewTimer);updatePreview();});
$("cwMobile").addEventListener("click",()=>{previewBox.classList.add("is-mobile");$("cwMobile").setAttribute("aria-pressed","true");$("cwDesktop").setAttribute("aria-pressed","false");});
$("cwDesktop").addEventListener("click",()=>{previewBox.classList.remove("is-mobile");$("cwMobile").setAttribute("aria-pressed","false");$("cwDesktop").setAttribute("aria-pressed","true");});

let cppController=null;
function setCppRunning(on){
 $("cwCppRun").disabled=on;$("cwCppStop").disabled=!on;
}
$("cwCppStop").addEventListener("click",()=>cppController?.abort());
$("cwCppRun").addEventListener("click",async()=>{
 if(cppController||files[index].language!=="cpp")return;
 save();const source=files[index].code;
 if(!source.trim()){$("cwCppStatus").textContent="Masukkan kod C++ dahulu.";return;}
 cppController=new AbortController();setCppRunning(true);
 const status=$("cwCppStatus"),output=$("cwCppOutput");
 status.textContent="Menjalankan compiler Clang C++20 dalam sandbox…";output.textContent="";
 const started=performance.now();
 try{
  const result=await engine.run("cpp",source,{signal:cppController.signal,
    stdin:$("cwCppStdin").value,
    onProgress:message=>{status.textContent=String(message).slice(0,120);}});
  output.textContent=(result.output||"(Tiada output)")+
    (result.error?"\nERROR: "+result.error:"");
  status.textContent=(result.ok?"BERJAYA":"RALAT")+" · "+result.runtimeMs+" ms"+
    (result.truncated?" · output dipotong":"");
 }catch(error){
  output.textContent=String(error?.message||error).slice(0,600);
  status.textContent="Compiler dihentikan atau gagal · "+Math.round(performance.now()-started)+" ms";
 }finally{cppController=null;setCppRunning(false);}
});

editor.addEventListener("input",()=>{save();schedulePreview();});
select.addEventListener("change",()=>{save();index=Number(select.value);render();schedulePreview();});
$("cwAdd").addEventListener("click",()=>{
 const extension=ext[files[index].language];
 let n=files.length+1,name="snippet-"+n+extension;
 while(files.some(f=>f.name===name))name="snippet-"+(++n)+extension;
 try{add(name);}catch(e){info.textContent=e.message;}
});
$("cwDelete").addEventListener("click",()=>{
 if(!confirm("Buang "+files[index].name+" daripada tab ini?"))return;
 files.splice(index,1);if(!files.length)files=[{name:"main.js",language:"javascript",code:""}];
 index=Math.min(index,files.length-1);render();schedulePreview();
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
 document.getElementById("input")?.dispatchEvent(new Event("input",{bubbles:true}));
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
dialog.addEventListener("close",()=>{cppController?.abort();clearTimeout(previewTimer);previewFrame.removeAttribute("srcdoc");});
window.addEventListener("aksara:code-workspace-open",event=>{
 if(event.detail?.language==="html")ensureWebStarter();
 if(event.detail?.language==="cpp")ensureCppStarter();
 render();if(!dialog.open)dialog.showModal();schedulePreview();
});
window.addEventListener("ba:cleared",()=>{cppController?.abort();files=[{name:"main.js",language:"javascript",code:""}];index=0;clearTimeout(previewTimer);previewFrame.removeAttribute("srcdoc");if(dialog.open)dialog.close();});
window.AksaraCodeWorkspace=Object.freeze({version:"1.3",fileCount:()=>files.length,previewAvailable:true});
})();
