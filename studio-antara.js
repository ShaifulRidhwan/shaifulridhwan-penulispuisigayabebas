(function(){
"use strict";
const $=id=>document.getElementById(id);
const title=$("sectionTitle"),kind=$("previewKind"),preview=$("studioPreview"),status=$("studioStatus");
const labels={email:"Draf e-mel",document:"PDF & Word",table:"Jadual",chart:"Graf",poster:"Poster",image:"Imej AI · BETA TEST"};
let current="email",chartSvg=null,posterCanvas=null,aiBusy=false;
const val=id=>$(id)?.value||"";
const el=(tag,text,cls)=>{
 const element=document.createElement(tag);
 if(text!==undefined)element.textContent=String(text);
 if(cls)element.className=cls;
 return element;
};
function say(text){status.textContent=String(text||"").slice(0,350);}
function nameFile(name,extension){return (String(name||"hasil").normalize("NFKD").replace(/[^a-z0-9-_ ]/gi,"").trim().replace(/\s+/g,"-").slice(0,64)||"hasil")+"."+extension;}
function save(blob,name){
 const url=URL.createObjectURL(blob),a=el("a");
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function downloadText(value,name,type="text/plain;charset=utf-8"){
 save(new Blob([value],{type}),name);
}
async function copy(value){
 try{await navigator.clipboard.writeText(String(value));say("Disalin ke papan klip.");}
 catch(_){say("Pelayar tidak membenarkan salin automatik. Gunakan pilihan eksport.");}
}
function paper(label){
 const sheet=el("div",undefined,"preview-paper");sheet.setAttribute("aria-label",label||"Pratonton");
 return sheet;
}
function heading(parent,text){parent.appendChild(el("h3",text||"Tanpa tajuk"));}
function paragraphs(parent,text){
 for(const block of String(text||"").split(/\n{2,}/)){
  if(block.trim())parent.appendChild(el("p",block.trim()));
 }
}
function foot(parent){parent.appendChild(el("div","Dihasilkan melalui Studio Antara · Shaiful Ridhwan A.I.","print-footer"));}
function emailPreview(){
 const sheet=paper("E-mel");
 const to=val("emailName")||val("emailTo");
 sheet.appendChild(el("p","Kepada: "+(to||"Belum dinyatakan"),"subtle"));
 sheet.appendChild(el("p","Subjek: "+(val("emailSubject")||"Belum dinyatakan"),"letter-subject"));
 sheet.appendChild(el("hr"));
 paragraphs(sheet,val("emailBody")||"Isi e-mel akan dipaparkan di sini.");preview.replaceChildren(sheet);
}
function documentPreview(){
 const sheet=paper("Dokumen");
 heading(sheet,val("docTitle")||"Dokumen Baharu");
 paragraphs(sheet,val("docBody")||"Teks dokumen akan dipaparkan di sini.");
 foot(sheet);preview.replaceChildren(sheet);
}
function parseCSV(value){
 const rows=[],row=[];let cell="",quoted=false;
 const input=String(value||"").replace(/\r\n/g,"\n");
 for(let i=0;i<input.length;i++){
  const ch=input[i],next=input[i+1];
  if(quoted){
   if(ch==='"'&&next==='"'){cell+='"';i++;}
   else if(ch==='"')quoted=false;
   else cell+=ch;
  }else if(ch==='"'){quoted=true;}
  else if(ch===","){row.push(cell);cell="";}
  else if(ch==="\n"){row.push(cell);if(row.some(x=>x.trim()))rows.push(row.splice(0));cell="";}
  else cell+=ch;
 }
 if(quoted)throw Error("CSV mempunyai petikan berganda yang belum ditutup.");
 row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 return rows;
}
function csvQuote(value){const s=String(value??"");return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function normalizedCSV(rows){return rows.map(row=>row.map(csvQuote).join(",")).join("\r\n")+"\r\n";}
function tablePreview(){
 const rows=parseCSV(val("tableData"));
 const sheet=paper("Jadual");heading(sheet,val("tableTitle"));
 if(!rows.length){sheet.appendChild(el("p","Masukkan data CSV."));preview.replaceChildren(sheet);return;}
 const table=el("table"),thead=el("thead"),tbody=el("tbody"),header=el("tr");
 for(const cell of rows[0])header.appendChild(el("th",cell));
 thead.appendChild(header);
 for(const row of rows.slice(1,1001)){
  const tr=el("tr");
  for(const cell of row)tr.appendChild(el("td",cell));
  tbody.appendChild(tr);
 }
 table.append(thead,tbody);sheet.appendChild(table);
 if(rows.length>1002)sheet.appendChild(el("p","Pratonton menunjukkan 1,000 baris pertama. Eksport CSV mengandungi semua data.","subtle"));
 preview.replaceChildren(sheet);
}
const ns="http://www.w3.org/2000/svg";
const svgEl=(name,attrs,text)=>{
 const x=document.createElementNS(ns,name);
 for(const [k,v] of Object.entries(attrs||{}))x.setAttribute(k,String(v));
 if(text!==undefined)x.textContent=String(text);
 return x;
};
function drawChart(){
 const rows=parseCSV(val("chartData"));
 const points=rows.slice(1,101).map(row=>({label:String(row[0]||"").slice(0,20),value:Number(row[1])})).
  filter(p=>Number.isFinite(p.value)&&p.value>=0);
 if(!points.length)throw Error("Perlukan sekurang-kurangnya satu nombor positif atau sifar pada lajur kedua.");
 const max=Math.max(1,...points.map(p=>p.value)),w=900,h=550,margin={left:70,right:35,top:65,bottom:105};
 const width=w-margin.left-margin.right,height=h-margin.top-margin.bottom;
 const svg=svgEl("svg",{xmlns:ns,viewBox:"0 0 900 550",role:"img","aria-label":val("chartTitle")||"Graf"});
 svg.appendChild(svgEl("rect",{x:0,y:0,width:w,height:h,fill:"#fcfaf6"}));
 svg.appendChild(svgEl("text",{x:70,y:38,fill:"#232629","font-size":27,"font-weight":700},val("chartTitle")||"Graf"));
 for(let n=0;n<=4;n++){
  const y=margin.top+height*n/4;
  svg.appendChild(svgEl("line",{x1:margin.left,x2:w-margin.right,y1:y,y2:y,stroke:"#dedbd4"}));
  svg.appendChild(svgEl("text",{x:margin.left-11,y:y+5,"font-size":12,"text-anchor":"end",fill:"#62686d"},(max*(1-n/4)).toFixed(1)));
 }
 const step=width/points.length,coords=[];
 points.forEach((p,i)=>{
  const x=margin.left+step*(i+.5),y=margin.top+height-(p.value/max)*height;
  coords.push(x+","+y);
  if(val("chartType")==="bar"){
   svg.appendChild(svgEl("rect",{x:x-step*.33,y,width:Math.max(1,step*.66),height:Math.max(0,margin.top+height-y),rx:3,fill:"#aa855e"}));
  }
  if(points.length<=20||i%Math.ceil(points.length/20)===0){
   svg.appendChild(svgEl("text",{x,y:h-73,fill:"#596068","font-size":11,"text-anchor":"end",transform:"rotate(-35 "+x+" "+(h-73)+")"},p.label));
  }
 });
 if(val("chartType")==="line"){
  svg.appendChild(svgEl("polyline",{points:coords.join(" "),fill:"none",stroke:"#a77f53","stroke-width":4,"stroke-linejoin":"round"}));
  for(const xy of coords){const [x,y]=xy.split(",");svg.appendChild(svgEl("circle",{cx:x,cy:y,r:4,fill:"#416e95"}));}
 }
 const sheet=paper("Graf");chartSvg=svg;sheet.appendChild(svg);preview.replaceChildren(sheet);
 return svg;
}
function wrap(ctx,text,maxWidth,maxLines){
 const parts=String(text||"").split(/\s+/).filter(Boolean),lines=[];let line="";
 for(const word of parts){
  const next=line?line+" "+word:word;
  if(ctx.measureText(next).width>maxWidth&&line){lines.push(line);line=word;}else line=next;
  if(lines.length>=maxLines)break;
 }
 if(line&&lines.length<maxLines)lines.push(line);
 return lines;
}
function createPoster(){
 const sizes={story:[1080,1920],square:[1080,1080],landscape:[1600,900]},size=sizes[val("posterSize")]||sizes.square;
 const canvas=el("canvas");canvas.width=size[0];canvas.height=size[1];canvas.style="width:100%;height:auto;display:block";
 const ctx=canvas.getContext("2d");
 if(!ctx)throw Error("Canvas tidak disokong pelayar.");
 const w=canvas.width,h=canvas.height,style=val("posterStyle");
 const base=style==="paper"?["#ede4cf","#ba9970"]:style==="aurora"?["#081f32","#285782"]:["#080b12","#61533d"];
 const grad=ctx.createLinearGradient(0,0,w,h);grad.addColorStop(0,base[0]);grad.addColorStop(1,base[1]);
 ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
 const glow=ctx.createRadialGradient(w*.75,h*.28,10,w*.75,h*.28,w*.68);
 glow.addColorStop(0,style==="paper"?"#e6c58c99":"#c1ad854e");glow.addColorStop(1,"#00000000");
 ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
 ctx.strokeStyle=style==="paper"?"#46301f99":"#d8c19a88";ctx.lineWidth=2;
 ctx.strokeRect(55,55,w-110,h-110);
 ctx.beginPath();ctx.moveTo(115,130);ctx.lineTo(w-115,130);ctx.moveTo(115,h-130);ctx.lineTo(w-115,h-130);ctx.stroke();
 const ink=style==="paper"?"#251a17":"#f3e6d4";
 ctx.fillStyle=ink;ctx.textAlign="center";
 const title=val("posterTitle")||"STUDIO ANTARA",font=Math.min(85,w*.066);
 ctx.font="600 "+font+"px Georgia, serif";
 const head=wrap(ctx,title,w-240,5);
 const titleHeight=font*1.22,start=h*.37-(head.length-1)*titleHeight/2;
 head.forEach((line,i)=>ctx.fillText(line,w/2,start+i*titleHeight));
 ctx.font=Math.round(font*.41)+"px Georgia, serif";
 const cap=wrap(ctx,val("posterBody"),w-230,9);
 const gap=font*.68;cap.forEach((line,i)=>ctx.fillText(line,w/2,h*.57+i*gap));
 ctx.font=Math.max(17,Math.floor(w*.017))+"px Arial, sans-serif";ctx.letterSpacing="5px";
 ctx.fillText("SHAIFUL RIDHWAN A.I.   •   STUDIO ANTARA",w/2,h-105);
 posterCanvas=canvas;const sheet=paper("Poster");sheet.style.padding="0";sheet.style.minHeight="auto";sheet.style.background="transparent";sheet.appendChild(canvas);preview.replaceChildren(sheet);
 return canvas;
}
function render(){
 try{
  if(current==="email")emailPreview();
  if(current==="document")documentPreview();
  if(current==="table")tablePreview();
  if(current==="chart")drawChart();
  if(current==="poster")createPoster();
  if(current==="image"){preview.replaceChildren(el("p","Imej AI hanya muncul setelah model berjaya dimuat dan menjana imej sebenar. Status: BETA TEST.","hint"));}
 }catch(error){say(error.message);preview.replaceChildren(el("p","Semak data projek di sebelah kiri.","hint"));}
}
function tab(target){
 if(!labels[target])return;
 current=target;
 document.querySelectorAll(".tab").forEach(btn=>{
  const on=btn.dataset.tab===target;btn.classList.toggle("active",on);btn.setAttribute("aria-selected",on?"true":"false");
 });
 document.querySelectorAll(".panel").forEach(p=>p.hidden=p.id!=="editor-"+target);
 title.textContent=labels[target];kind.textContent=target==="image"?"BETA TEST":labels[target];
 $("studioImageOutput").hidden=target!=="image";
 history.replaceState(null,"","#"+target);
 say("");render();
}
document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>tab(btn.dataset.tab)));
function emailEml(){
 const subject=val("emailSubject").replace(/[\r\n]/g," "),to=val("emailTo").replace(/[\r\n]/g," ");
 const s="To: "+to+"\r\nSubject: "+subject+"\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n"+val("emailBody").replace(/\r?\n/g,"\r\n");
 downloadText(s,nameFile(subject||"draf-email","eml"),"message/rfc822");
}
$("emailEml").addEventListener("click",emailEml);
$("emailOpen").addEventListener("click",()=>{
 const to=val("emailTo"),subject=val("emailSubject"),body=val("emailBody");
 const href="mailto:"+encodeURIComponent(to)+"?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body);
 if(href.length>1800){say("Mesej terlalu panjang untuk pautan e-mel. Gunakan fail .eml atau salin.");return;}
 window.location.href=href;
});
$("emailCopy").addEventListener("click",()=>copy("Subjek: "+val("emailSubject")+"\n\n"+val("emailBody")));
$("docCopy").addEventListener("click",()=>copy(val("docTitle")+"\n\n"+val("docBody")));
$("docHtml").addEventListener("click",()=>{
 const sheet=preview.querySelector(".preview-paper");if(!sheet){say("Buka dan pratonton dokumen dahulu.");return;}
 const html="<!doctype html><html lang=\"ms\"><meta charset=\"utf-8\"><title>Dokumen</title><style>body{max-width:760px;margin:40px auto;font:17px/1.7 Georgia,serif;padding:20px;color:#222}h3{font-size:30px}p{white-space:pre-wrap}</style>"+sheet.outerHTML+"</html>";
 downloadText(html,nameFile(val("docTitle")||"dokumen","html"),"text/html;charset=utf-8");
});
$("docPdf").addEventListener("click",()=>{
 if(current!=="document")return;
 documentPreview();
 say("Dalam dialog cetak, pilih 'Simpan sebagai PDF / Save as PDF'. Semua teks kekal boleh dipilih.");
 window.print();
});
$("docWord").addEventListener("click",async()=>{
 const btn=$("docWord");btn.disabled=true;say("Menjana dokumen Word pada peranti...");
 try{
  const docx=await import("https://cdn.jsdelivr.net/npm/docx@9.11.0/+esm");
  const rows=[new docx.Paragraph({text:val("docTitle")||"Dokumen",heading:docx.HeadingLevel.TITLE})];
  for(const paragraph of val("docBody").split(/\n{2,}/))if(paragraph.trim())
   rows.push(new docx.Paragraph({text:paragraph.trim(),spacing:{after:220},breakLine:false}));
  const doc=new docx.Document({sections:[{properties:{},children:rows}]});
  const blob=await docx.Packer.toBlob(doc);
  save(blob,nameFile(val("docTitle")||"dokumen","docx"));say("Fail Word siap.");
 }catch(err){say("Eksport Word tidak tersedia dalam pelayar/rangkaian ini. Gunakan PDF atau HTML. "+String(err.message||"").slice(0,90));}
 finally{btn.disabled=false;}
});
$("tablePreview").addEventListener("click",()=>{try{tablePreview();say("Pratonton dikemas kini.");}catch(e){say(e.message);}});
$("tableCsv").addEventListener("click",()=>{try{const r=parseCSV(val("tableData"));downloadText("\uFEFF"+normalizedCSV(r),nameFile(val("tableTitle"),"csv"),"text/csv;charset=utf-8");}catch(e){say(e.message);}});
$("tableJson").addEventListener("click",()=>{
 try{
  const rows=parseCSV(val("tableData")),keys=rows[0]||[];
  const data=rows.slice(1).map(row=>Object.fromEntries(keys.map((k,i)=>[k,row[i]||""])));
  downloadText(JSON.stringify(data,null,2),nameFile(val("tableTitle"),"json"),"application/json;charset=utf-8");
 }catch(e){say(e.message);}
});
$("tableCopy").addEventListener("click",()=>copy(val("tableData")));
$("chartRender").addEventListener("click",()=>{try{drawChart();say("Graf siap.");}catch(e){say(e.message);}});
$("chartSvg").addEventListener("click",()=>{
 try{if(!chartSvg)drawChart();downloadText(new XMLSerializer().serializeToString(chartSvg),nameFile(val("chartTitle"),"svg"),"image/svg+xml;charset=utf-8");}
 catch(e){say(e.message);}
});
$("chartPng").addEventListener("click",async()=>{
 try{
  if(!chartSvg)drawChart();
  const blob=new Blob([new XMLSerializer().serializeToString(chartSvg)],{type:"image/svg+xml"});
  const url=URL.createObjectURL(blob),image=new Image();
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});
  URL.revokeObjectURL(url);
  const canvas=el("canvas");canvas.width=900;canvas.height=550;canvas.getContext("2d").drawImage(image,0,0);
  canvas.toBlob(b=>b?save(b,nameFile(val("chartTitle"),"png")):say("Tidak boleh eksport PNG."),"image/png");
 }catch(e){say(e.message);}
});
$("posterRender").addEventListener("click",()=>{try{createPoster();say("Poster siap.");}catch(e){say(e.message);}});
$("posterPng").addEventListener("click",()=>{
 try{if(!posterCanvas)createPoster();posterCanvas.toBlob(b=>b?save(b,nameFile(val("posterTitle"),"png")):say("Tidak boleh eksport poster."),"image/png");}
 catch(e){say(e.message);}
});
async function aiDraft(type){
 if(aiBusy)return;aiBusy=true;
 const id=type==="email"?"emailAI":"docAI",button=$(id);
 button.disabled=true;say("Gemini menyediakan draf. Tertakluk pada kuota API RM0...");
 let prompt;
 if(type==="email"){
  prompt="Tulis draf e-mel lengkap dalam Bahasa Melayu Malaysia. Balas hanya isi e-mel tanpa subjek. Penerima: "+
    (val("emailName")||"tidak ditentukan")+". Subjek: "+(val("emailSubject")||"e-mel umum")+
    ". Arahan/draf pengguna: "+(val("emailBody")||"E-mel profesional, jelas, ringkas.")+". Jangan mereka fakta atau alamat.";
 }else{
  prompt="Sediakan dokumen berkualiti dalam Bahasa Melayu Malaysia. Balas hanya isi dokumen tanpa Markdown fencing. Jenis: "+
    val("docTemplate")+". Tajuk: "+(val("docTitle")||"Dokumen")+". Arahan/draf pengguna: "+
    (val("docBody")||"Tulis dokumen tersusun dengan pengenalan, isi dan penutup.")+". Jangan mereka data.";
 }
 try{
  const res=await fetch("/.netlify/functions/bilik-antara",{
   method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:prompt})});
  const json=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(json.error||"Gemini tidak tersedia.");
  if(!json.reply?.trim())throw Error("Jawapan AI kosong.");
  if(type==="email")$("emailBody").value=json.reply;
  else $("docBody").value=json.reply;
  render();say("Draf AI siap. Semak fakta, penerima dan kandungan sebelum menggunakannya.");
 }catch(e){say("Bantuan AI belum tersedia: "+String(e.message||e).slice(0,170)+". Editor dan eksport setempat tetap boleh digunakan.");}
 finally{aiBusy=false;button.disabled=false;}
}
$("emailAI").addEventListener("click",()=>aiDraft("email"));
$("docAI").addEventListener("click",()=>aiDraft("document"));
for(const id of ["emailName","emailTo","emailSubject","emailBody","docTitle","docBody","tableTitle","tableData"])
 $(id).addEventListener("input",()=>{if(["email","document","table"].includes(current))render();});
for(const id of ["chartTitle","chartType","chartData"])$(id).addEventListener("input",()=>chartSvg=null);
for(const id of ["posterTitle","posterBody","posterSize","posterStyle"])$(id).addEventListener("input",()=>posterCanvas=null);
try{
 const transfer=JSON.parse(sessionStorage.getItem("bilik-antara-studio-transfer-v1")||"null");
 if(transfer&&typeof transfer.text==="string"){
  $("docBody").value=transfer.text.slice(0,100000);
  $("docTitle").value=String(transfer.title||"Draf daripada Bilik Antara").slice(0,140);
  sessionStorage.removeItem("bilik-antara-studio-transfer-v1");
  current="document";
 }
}catch(_){}
tab(["email","document","table","chart","poster","image"].includes(location.hash.slice(1))?location.hash.slice(1):current);
window.StudioAntara={tab,parseCSV,createPoster,drawChart,render};
})();
