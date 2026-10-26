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
 paragraphs(sheet,val("docBody")||"Masukkan isi dokumen.");
 sheet.appendChild(el("div","Dihasilkan melalui Studio Antara · Shaiful Ridhwan A.I.","print-footer"));
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
 const clean=v=>v.replace(/[\r\n]/g," ");
 const subject=clean(val("emailSubject")),to=clean(val("emailTo"));
 const content="To: "+to+"\r\nSubject: "+subject+"\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n"+val("emailBody").replace(/\r?\n/g,"\r\n");
 textFile(content,filename(subject||"draf-email","eml"),"message/rfc822");
});
$("emailOpen").addEventListener("click",()=>{
 const to=val("emailTo");
 const url="mailto:"+encodeURIComponent(to)+"?subject="+encodeURIComponent(val("emailSubject"))+"&body="+encodeURIComponent(val("emailBody"));
 if(url.length>1800){notice("E-mel terlalu panjang untuk dibuka melalui pautan. Eksport .eml atau salin dahulu.");return;}
 window.location.href=url;
});
async function copy(text){
 try{await navigator.clipboard.writeText(text);notice("Disalin.");}
 catch(_){notice("Pelayar menyekat salinan. Pilih teks atau gunakan eksport.");}
}
$("emailCopy").addEventListener("click",()=>copy("Subjek: "+val("emailSubject")+"\n\n"+val("emailBody")));
$("docCopy").addEventListener("click",()=>copy(val("docTitle")+"\n\n"+val("docBody")));
$("docHtml").addEventListener("click",()=>{
 if(current!=="document")tab("document");
 const html="<!doctype html><html lang=\"ms\"><head><meta charset=\"utf-8\"><title>Dokumen Studio Antara</title><style>body{max-width:750px;margin:42px auto;padding:20px;font:17px/1.65 Georgia,serif;color:#262626}h3{font-size:27px}p{white-space:pre-wrap}</style></head><body>"+
  preview.querySelector(".preview-paper").outerHTML+"</body></html>";
 textFile(html,filename(val("docTitle")||"dokumen","html"),"text/html;charset=utf-8");
});
$("docPdf").addEventListener("click",()=>{
 if(current!=="document")tab("document");
 documentPreview();notice("Pada dialog cetak, pilih Simpan sebagai PDF (Save as PDF).");
 window.print();
});
$("docWord").addEventListener("click",async()=>{
 const button=$("docWord");button.disabled=true;notice("Menjana Word pada peranti...");
 try{
  const docx=await import("https://cdn.jsdelivr.net/npm/docx@9.11.0/+esm");
  const rows=[new docx.Paragraph({text:val("docTitle")||"Dokumen",heading:docx.HeadingLevel.TITLE})];
  for(const p of val("docBody").split(/\n{2,}/))if(p.trim())
   rows.push(new docx.Paragraph({text:p.trim(),spacing:{after:200}}));
  const doc=new docx.Document({sections:[{properties:{},children:rows}]});
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
  "Sediakan dokumen tersusun dalam Bahasa Melayu Malaysia. Jangan reka fakta. Jenis: "+val("docTemplate")+". Tajuk: "+val("docTitle")+". Arahan/draf: "+(val("docBody")||"Susun pengenalan, isi dan penutup.");
 try{
  const res=await fetch("/.netlify/functions/bilik-antara",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:prompt})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||typeof data.reply!=="string"||!data.reply.trim())throw Error(data.error||"Respons AI tiada.");
  (type==="email"?$("emailBody"):$("docBody")).value=data.reply;
  render();notice("Draf siap. Semak kandungan dan penerima sebelum digunakan.");
 }catch(e){notice("Bantuan AI belum tersedia: "+String(e.message||e).slice(0,150)+". Eksport manual tetap boleh digunakan.");}
 finally{busy=false;button.disabled=false;}
}
$("emailAI").addEventListener("click",()=>aiDraft("email"));
$("docAI").addEventListener("click",()=>aiDraft("document"));
for(const id of ["emailName","emailTo","emailSubject","emailBody","docTitle","docBody"])
 $(id).addEventListener("input",render);
try{
 const raw=sessionStorage.getItem("bilik-antara-studio-transfer-v1");
 const data=raw?JSON.parse(raw):null;
 if(data&&typeof data.text==="string"){
  $("docBody").value=data.text.slice(0,100000);
  $("docTitle").value=String(data.title||"Draf daripada Bilik Antara").slice(0,140);
  sessionStorage.removeItem("bilik-antara-studio-transfer-v1");
  current="document";
 }
}catch(_){}
tab(location.hash.slice(1) in labels?location.hash.slice(1):current);
window.StudioAntara={tab,render};
})();
