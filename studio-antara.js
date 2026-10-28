(function(){
"use strict";
/* Studio Antara RM0: e-mel dan dokumen sahaja. Tiada kod imej atau model AI dimuat di sini. */
const $=id=>document.getElementById(id);
const title=$("sectionTitle"),kind=$("previewKind"),preview=$("studioPreview"),status=$("studioStatus");
const labels={email:"Draf e-mel",document:"PDF & Word"};
let current="email",busy=false;
const val=id=>String($(id)?.value||"");
const el=(tag,text,cls)=>{
 const node=document.createElement(tag);
 if(text!==undefined)node.textContent=String(text);
 if(cls)node.className=cls;
 return node;
};
const notice=text=>{status.textContent=String(text||"").slice(0,320);};
const validEmail=()=>{const field=$("emailTo"),value=field.value.trim();return !value||field.checkValidity()&&!/[\r\n]/.test(value);};
const requireEmail=()=>{if(!val("emailTo").trim()){notice("Masukkan alamat e-mel penerima dahulu.");$("emailTo").focus();return false;}
 if(!validEmail()){notice("Alamat e-mel penerima tidak sah. Semak dahulu.");$("emailTo").focus();return false;}return true;};
const utf8=string=>new TextEncoder().encode(String(string||""));
function base64(bytes){
 let parts=[];for(let i=0;i<bytes.length;i+=8192)parts.push(String.fromCharCode(...bytes.subarray(i,i+8192)));
 return btoa(parts.join(""));
}
function mimeHeader(value){
 const input=String(value||"").replace(/[\r\n]+/g," ").trim();
 if(!/[^\x20-\x7e]/.test(input))return input;
 // RFC 2047 encoded words <=75 characters, fold only between Unicode codepoints.
 const chunks=[];let chunk="",length=0;
 for(const character of input){
   const bytes=utf8(character).length;
   if(length+bytes>39&&chunk){chunks.push("=?UTF-8?B?"+base64(utf8(chunk))+"?=");chunk="";length=0;}
   chunk+=character;length+=bytes;
 }
 if(chunk)chunks.push("=?UTF-8?B?"+base64(utf8(chunk))+"?=");
 return chunks.join("\r\n ");
}
const mimeBody=value=>base64(utf8(String(value||"").replace(/\r?\n/g,"\r\n"))).match(/.{1,76}/g)?.join("\r\n")||"";
const filename=(name,ext)=>(String(name||"hasil").normalize("NFKD").replace(/[^a-z0-9-_ ]/gi,"").trim().replace(/\s+/g,"-").slice(0,55)||"hasil")+"."+ext;
function save(blob,name){
 const url=URL.createObjectURL(blob),a=el("a");
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),8000);
}
function textFile(data,name,mime){save(new Blob([data],{type:mime||"text/plain;charset=utf-8"}),name);}
function paper(label){
 const node=el("div",undefined,"preview-paper");node.setAttribute("aria-label",label);return node;
}
function paragraphs(node,value){
 for(const block of String(value||"").split(/\n{2,}/)){
  const p=block.trim();if(p)node.appendChild(el("p",p));
 }
}
function emailPreview(){
 const sheet=paper("Pratonton e-mel");
 sheet.appendChild(el("p","Kepada: "+(val("emailName")||val("emailTo")||"Belum dinyatakan"),"subtle"));
 sheet.appendChild(el("p","Subjek: "+(val("emailSubject")||"Belum dinyatakan"),"letter-subject"));
 sheet.appendChild(el("hr"));
 paragraphs(sheet,val("emailBody")||"Masukkan isi e-mel.");
 preview.replaceChildren(sheet);
}
function documentPreview(){
 const sheet=paper("Pratonton dokumen");
 sheet.appendChild(el("h3",val("docTitle")||"Dokumen Baharu"));
 if(window.StudioRich?.getText().trim()) {
  const content=el("div",undefined,"formatted-body");
  content.innerHTML=window.StudioRich.getHTML();
  sheet.appendChild(content);
 } else paragraphs(sheet,"Masukkan isi dokumen.");
 sheet.appendChild(el("div","Dihasilkan melalui Studio Antara · Aksara A.I.","print-footer"));
 preview.replaceChildren(sheet);
}
function render(){if(current==="email")emailPreview();else documentPreview();}
function tab(name){
 if(!(name in labels))return;
 current=name;
 document.querySelectorAll(".tab").forEach(b=>{
  const active=b.dataset.tab===name;b.classList.toggle("active",active);b.setAttribute("aria-selected",String(active));
 });
 document.querySelectorAll(".panel").forEach(p=>p.hidden=p.id!=="editor-"+name);
 title.textContent=labels[name];kind.textContent=labels[name];
 history.replaceState(null,"","#"+name);
 notice("");render();
}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>tab(b.dataset.tab)));
$("emailEml").addEventListener("click",()=>{
 if(!validEmail()){notice("Alamat penerima tidak sah. Betulkan sebelum eksport .eml.");$("emailTo").focus();return;}
 const subject=val("emailSubject").replace(/[\r\n]+/g," ").trim();
 const to=val("emailTo").trim();
 const name=val("emailName").replace(/[\r\n]+/g," ").trim();
 const recipient=to?(name?mimeHeader(name)+" <"+to+">":to):"";
 const content="To: "+recipient+"\r\nSubject: "+mimeHeader(subject)+"\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"+mimeBody(val("emailBody"))+"\r\n";
 textFile(content,filename(subject||"draf-email","eml"),"message/rfc822");
 notice("Fail .eml disediakan. Semak penerima dan kandungan dalam aplikasi e-mel sebelum hantar.");
});
$("emailOpen").addEventListener("click",()=>{
 if(!requireEmail())return;
 const to=val("emailTo").trim();
 const url="mailto:"+encodeURIComponent(to)+"?subject="+encodeURIComponent(val("emailSubject"))+"&body="+encodeURIComponent(val("emailBody"));
 if(url.length>1800){notice("E-mel terlalu panjang untuk dibuka melalui pautan. Eksport .eml atau salin dahulu.");return;}
 window.location.href=url;
});
async function copy(text){
 try{await navigator.clipboard.writeText(text);notice("Disalin.");}
 catch(_){notice("Pelayar menyekat salinan. Pilih teks atau gunakan eksport.");}
}
$("emailCopy").addEventListener("click",()=>copy("Subjek: "+val("emailSubject")+"\n\n"+val("emailBody")));
$("docCopy").addEventListener("click",()=>copy(val("docTitle")+"\n\n"+(window.StudioRich?.getText()||val("docBody"))));
$("docHtml").addEventListener("click",()=>{
 if(current!=="document")tab("document");
 const html="<!doctype html><html lang=\"ms\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Dokumen Studio Antara</title><style>body{max-width:750px;margin:42px auto;padding:20px;font:17px/1.65 Georgia,serif;color:#262626}h3{font-size:27px;line-height:1.25}.formatted-body p{white-space:pre-wrap;overflow-wrap:anywhere}.formatted-body h1,.formatted-body h2,.formatted-body h3{line-height:1.25}.formatted-body blockquote{border-left:3px solid #bbb;padding-left:15px;color:#555}.formatted-body a{color:#264a7a}.print-footer{border-top:1px solid #ddd;margin-top:50px;padding-top:12px;font:10px Arial,sans-serif;color:#666}@media print{body{max-width:none;margin:0;padding:0}p{orphans:2;widows:2}@page{size:A4;margin:17mm}}</style></head><body>"+
  preview.querySelector(".preview-paper").outerHTML+"</body></html>";
 textFile(html,filename(val("docTitle")||"dokumen","html"),"text/html;charset=utf-8");
});
$("docPdf").addEventListener("click",()=>{
 if(current!=="document")tab("document");
 documentPreview();notice("Pada dialog cetak, pilih Simpan sebagai PDF (Save as PDF).");
 const originalTitle=document.title;document.title=val("docTitle").trim()||"Dokumen Studio Antara";
 window.addEventListener("afterprint",()=>{document.title=originalTitle;},{once:true});
 window.print();
});
$("docWord").addEventListener("click",async()=>{
 const button=$("docWord");button.disabled=true;notice("Menjana Word pada peranti...");
 try{
  const docx=await import("https://cdn.jsdelivr.net/npm/docx@9.11.0/+esm");
  const rows=[new docx.Paragraph({text:val("docTitle")||"Dokumen",heading:docx.HeadingLevel.TITLE,spacing:{after:260}})];
  // Convert supported rich-text blocks into native editable Word paragraphs.
  const root=document.createElement("div");
  root.innerHTML=window.StudioRich?.getHTML()||"";
  function runsFor(element,format={}){
    const runs=[];
    for(const node of element.childNodes){
      if(node.nodeType===3){if(node.nodeValue)runs.push(new docx.TextRun({text:node.nodeValue,...format}));continue;}
      if(node.nodeType!==1)continue;
      if(node.tagName==="BR"){runs.push(new docx.TextRun({break:1}));continue;}
      const next={...format};
      if(["STRONG","B"].includes(node.tagName))next.bold=true;
      if(["EM","I"].includes(node.tagName))next.italics=true;
      if(node.tagName==="U")next.underline={};
      if(node.tagName==="S")next.strike=true;
      runs.push(...runsFor(node,next));
    }
    return runs;
  }
  function addParagraph(element,opts={}){
    const tag=element.tagName;
    const levels={H1:docx.HeadingLevel.HEADING_1,H2:docx.HeadingLevel.HEADING_2,H3:docx.HeadingLevel.HEADING_3};
    const align=element.style.textAlign||"";
    const children=runsFor(element);
    rows.push(new docx.Paragraph({children:children.length?children:[new docx.TextRun("")],
      ...(levels[tag]?{heading:levels[tag]}:{}),
      ...(align?{alignment:align.toUpperCase()}:{}),
      ...(opts.bullet?{bullet:{level:0}}:{}),
      ...(opts.numbering?{numbering:{reference:"studio-numbering",level:0}}:{}),
      spacing:{after:tag==="BLOCKQUOTE"?260:160}}));
  }
  for(const node of root.children){
    if(node.tagName==="UL"||node.tagName==="OL"){
      for(const li of node.children)if(li.tagName==="LI")addParagraph(li,{bullet:node.tagName==="UL",numbering:node.tagName==="OL"});
    }else addParagraph(node);
  }
  const doc=new docx.Document({
   numbering:{config:[{reference:"studio-numbering",levels:[{level:0,format:"decimal",text:"%1.",alignment:"left"}]}]},
   sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1000,bottom:1000,left:1100,right:1100}}},children:rows}]
  });
  save(await docx.Packer.toBlob(doc),filename(val("docTitle")||"dokumen","docx"));
  notice("Dokumen Word telah dijana.");
 }catch(e){notice("Eksport Word gagal: "+String(e.message||e).slice(0,140)+". Gunakan PDF atau HTML.");}
 finally{button.disabled=false;}
});
async function aiDraft(type){
 if(busy)return;
 busy=true;const button=$(type==="email"?"emailAI":"docAI");button.disabled=true;
 notice("Sedang meminta draf daripada Gemini. Kuota percuma mungkin terpakai.");
 const prompt=type==="email"?
  "Sediakan isi e-mel berkualiti dalam Bahasa Melayu Malaysia. Jangan reka butiran. Hanya isi e-mel, bukan subjek. Penerima: "+(val("emailName")||"tidak dinyatakan")+". Subjek: "+val("emailSubject")+". Draf/arahan: "+(val("emailBody")||"E-mel formal ringkas."):
  "Sediakan dokumen tersusun dalam Bahasa Melayu Malaysia. Jangan reka fakta. Jenis: "+val("docTemplate")+". Tajuk: "+val("docTitle")+". Arahan/draf: "+(window.StudioRich?.getText()||"Susun pengenalan, isi dan penutup.");
 const field=type==="email"?$("emailBody"):$("richDocument");
 const original=type==="email"?field.value:window.StudioRich.getHTML();
 try{
  const res=await fetch("/.netlify/functions/bilik-antara",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:prompt})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||typeof data.reply!=="string"||!data.reply.trim())throw Error(data.error||"Respons AI tiada.");
  if((type==="email"?field.value:window.StudioRich.getHTML())!==original){notice("Draf AI siap, tetapi suntingan terbaru dikekalkan. Salin draf AI secara manual jika perlu.");return;}
  if(type==="email")field.value=data.reply;
  else {window.StudioRich.setText(data.reply);window.StudioRich.saveDraft();}
  render();notice("Draf siap. Semak kandungan dan penerima sebelum digunakan.");
 }catch(e){notice("Bantuan AI belum tersedia: "+String(e.message||e).slice(0,150)+". Eksport manual tetap boleh digunakan.");}
 finally{busy=false;button.disabled=false;}
}
$("emailAI").addEventListener("click",()=>aiDraft("email"));
$("docAI").addEventListener("click",()=>aiDraft("document"));
for(const id of ["emailName","emailTo","emailSubject","emailBody","docTitle"])
 $(id).addEventListener("input",render);
try{
 const raw=sessionStorage.getItem("bilik-antara-studio-transfer-v1");
 const data=raw?JSON.parse(raw):null;
 if(data&&typeof data.text==="string"){
  window.StudioRich?.setText(data.text.slice(0,100000));
  window.StudioRich?.saveDraft();
  $("docTitle").value=String(data.title||"Draf daripada Bilik Antara").slice(0,140);
  sessionStorage.removeItem("bilik-antara-studio-transfer-v1");
  current="document";
 }
}catch(_){}
window.StudioRich?.onChange(render);
tab(location.hash.slice(1) in labels?location.hash.slice(1):current);
window.StudioAntara={tab,render};
})();
