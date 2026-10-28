(function(){
"use strict";
/* Local editor extensions; no remote requests or uploaded document content. */
const $=id=>document.getElementById(id),rich=window.StudioRich,editor=rich?.editor;
if(!rich||!editor)return;
const KEY="aksara:studio:layout:v1";
const ids=["docPageSize","docMargins","docOrientation","docHeader","docFooter","docPageNumbers"];
const getLayout=()=>({size:$("docPageSize").value,margins:$("docMargins").value,orientation:$("docOrientation").value,header:$("docHeader").value.slice(0,140),footer:$("docFooter").value.slice(0,140),numbers:$("docPageNumbers").checked});
function emit(){document.dispatchEvent(new Event("studio:layout"));}
function saveSettings(){
 try{localStorage.setItem(KEY,JSON.stringify(getLayout()));}catch(_){}
 emit();
}
try{
 const saved=JSON.parse(localStorage.getItem(KEY)||"null");
 if(saved){
  if(["A4","Letter"].includes(saved.size))$("docPageSize").value=saved.size;
  if(["normal","narrow","wide"].includes(saved.margins))$("docMargins").value=saved.margins;
  if(["portrait","landscape"].includes(saved.orientation))$("docOrientation").value=saved.orientation;
  $("docHeader").value=String(saved.header||"").slice(0,140);
  $("docFooter").value=String(saved.footer||"").slice(0,140);
  $("docPageNumbers").checked= saved.numbers!==false;
 }
}catch(_){}
ids.forEach(id=>$(id).addEventListener("change",saveSettings));
["docHeader","docFooter"].forEach(id=>$(id).addEventListener("input",saveSettings));
function insertHTML(html){
 editor.focus();document.execCommand("insertHTML",false,html);rich.changed();
}
$("docTable").addEventListener("click",()=>{
 const rows=Number(prompt("Bilangan baris (1-15):","3"));
 if(!Number.isInteger(rows)||rows<1||rows>15)return;
 const cols=Number(prompt("Bilangan lajur (1-8):","3"));
 if(!Number.isInteger(cols)||cols<1||cols>8)return;
 const cells=Array.from({length:rows},(_,r)=>"<tr>"+Array.from({length:cols},(_,c)=>r===0?"<th>Tajuk "+(c+1)+"</th>":"<td> </td>").join("")+"</tr>").join("");
 insertHTML("<table><tbody>"+cells+"</tbody></table><p><br></p>");
});
$("docPageBreak").addEventListener("click",()=>insertHTML('<hr data-page-break="true"><p><br></p>'));
$("docImage").addEventListener("click",()=>$("docImageFile").click());
$("docImageFile").addEventListener("change",async event=>{
 const file=event.target.files?.[0];event.target.value="";
 if(!file)return;
 if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>4*1024*1024){alert("Gunakan PNG, JPG atau WebP bawah 4 MB.");return;}
 try{
  const bitmap=await createImageBitmap(file),canvas=document.createElement("canvas");
  const scale=Math.min(1,900/Math.max(bitmap.width,bitmap.height));
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));
  canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  let data=canvas.toDataURL("image/jpeg",.78);
  // Limit localStorage and DOCX payload size; no raw file saved on a server.
  if(data.length>230000){alert("Imej masih terlalu besar untuk draf. Pilih imej lebih kecil.");return;}
  insertHTML('<p><img src="'+data+'" alt="Ilustrasi dokumen"></p>');
 }catch(_){alert("Imej gagal dibaca pada pelayar ini.");}
});
$("docFind").addEventListener("click",()=>{
 $("docFindPanel").hidden=!$("docFindPanel").hidden;
 if(!$("docFindPanel").hidden)$("docFindText").focus();
});
function findNext(){
 const query=$("docFindText").value;
 if(!query){$("docFindStatus").textContent="Masukkan teks carian.";return false;}
 const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT);
 const selection=window.getSelection();
 const here=selection?.rangeCount&&editor.contains(selection.anchorNode)?selection.getRangeAt(0).endContainer:null;
 let nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
 let start=nodes.indexOf(here),positions=[...nodes.slice(start<0?0:start),...nodes.slice(0,start<0?0:start)];
 for(const node of positions){
  const at=node.nodeValue.toLocaleLowerCase("ms-MY").indexOf(query.toLocaleLowerCase("ms-MY"),node===here?selection.anchorOffset:0);
  if(at<0)continue;
  const range=document.createRange();range.setStart(node,at);range.setEnd(node,at+query.length);
  selection.removeAllRanges();selection.addRange(range);editor.focus();
  $("docFindStatus").textContent="Padanan dijumpai.";return true;
 }
 $("docFindStatus").textContent="Tiada padanan lagi.";return false;
}
$("docFindNext").addEventListener("click",findNext);
$("docReplaceOne").addEventListener("click",()=>{
 const selection=window.getSelection();
 if(!selection||selection.isCollapsed||selection.toString().toLocaleLowerCase("ms-MY")!==$("docFindText").value.toLocaleLowerCase("ms-MY")){if(!findNext())return;}
 document.execCommand("insertText",false,$("docReplaceText").value);
 rich.changed();$("docFindStatus").textContent="Satu padanan diganti.";
});
$("docReplaceAll").addEventListener("click",()=>{
 const query=$("docFindText").value;if(!query){$("docFindStatus").textContent="Masukkan teks carian.";return;}
 const replacement=$("docReplaceText").value;
 let count=0,walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT),nodes=[];
 while(walker.nextNode())nodes.push(walker.currentNode);
 for(const node of nodes){
  const input=node.nodeValue,lower=input.toLocaleLowerCase("ms-MY"),needle=query.toLocaleLowerCase("ms-MY");
  let at=0,out="",pos=lower.indexOf(needle,at);
  if(pos<0)continue;
  while(pos>=0){out+=input.slice(at,pos)+replacement;at=pos+query.length;count++;pos=lower.indexOf(needle,at);}
  node.nodeValue=out+input.slice(at);
 }
 if(count)rich.changed();
 $("docFindStatus").textContent=count+" padanan diganti.";
});
window.StudioLayout={get:getLayout};
emit();
})();