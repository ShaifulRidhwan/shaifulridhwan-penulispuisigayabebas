/* DOCX readable text extraction using browser's native ZIP decompression.
   No CDN, XML scripts, external URLs, network calls or macros are executed. */
(function(root){
"use strict";
const MAX_FILE=2200000,MAX_XML=600000,MAX_ENTRIES=150;
function readU16(v,n){return v.getUint16(n,true);}
function readU32(v,n){return v.getUint32(n,true);}
function locate(buf){
 const view=new DataView(buf),size=buf.byteLength;
 let end=-1;
 for(let i=size-22;i>=Math.max(0,size-65557);i--){
  if(readU32(view,i)===0x06054b50){end=i;break;}
 }
 if(end<0)throw Error("Struktur fail DOCX tidak lengkap.");
 const entries=readU16(view,end+10),offset=readU32(view,end+16);
 if(entries>MAX_ENTRIES||offset>=size)throw Error("DOCX mengandungi terlalu banyak fail dalaman.");
 let pos=offset;
 for(let i=0;i<entries;i++){
  if(pos+46>size||readU32(view,pos)!==0x02014b50)throw Error("Direktori DOCX rosak.");
  const method=readU16(view,pos+10),flags=readU16(view,pos+8);
  const compressed=readU32(view,pos+20),unpacked=readU32(view,pos+24);
  const nameLength=readU16(view,pos+28),extraLength=readU16(view,pos+30),commentLength=readU16(view,pos+32);
  const start=pos+46,endName=start+nameLength;
  if(endName>size)throw Error("Nama fail DOCX rosak.");
  const name=new TextDecoder().decode(new Uint8Array(buf,start,nameLength));
  if(name==="word/document.xml"){
   if(flags&1||![0,8].includes(method)||unpacked>MAX_XML||compressed>MAX_FILE)throw Error("Format DOCX tidak disokong.");
   const local=readU32(view,pos+42);
   if(local+30>size||readU32(view,local)!==0x04034b50)throw Error("Isi DOCX rosak.");
   const data=local+30+readU16(view,local+26)+readU16(view,local+28);
   if(data+compressed>size)throw Error("Bahagian DOCX terpotong.");
   return {method,bytes:new Uint8Array(buf,data,compressed),unpacked};
  }
  pos=endName+extraLength+commentLength;
 }
 throw Error("DOCX tidak mempunyai word/document.xml.");
}
async function inflate(entry){
 if(entry.method===0)return entry.bytes;
 if(typeof DecompressionStream!=="function")throw Error("Browser tidak menyokong decompression DOCX.");
 let reader;
 try{
  reader=new Blob([entry.bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const chunks=[];let size=0;
  while(true){
   const {value,done}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>MAX_XML)throw Error("DOCX terlalu besar selepas dinyahmampat.");
   chunks.push(value);
  }
  const out=new Uint8Array(size);let pos=0;
  for(const chunk of chunks){out.set(chunk,pos);pos+=chunk.length;}
  return out;
 }finally{try{await reader?.cancel();}catch(_){}}
}
function strip(xml){
 const decoded=String(xml||"");
 if(!/<w:document\b/i.test(decoded))throw Error("Kandungan XML Word tidak sah.");
 const clean=decoded.replace(/<w:(?:tab)\b[^>]*\/>/gi,"\t")
  .replace(/<w:(?:br|cr)\b[^>]*\/>/gi,"\n")
  .replace(/<\/w:p>/gi,"\n")
  .replace(/<[^>]+>/g,"")
  .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(Math.min(0x10ffff,parseInt(n,16))))
  .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(0x10ffff,Number(n))))
  .replace(/&(amp|lt|gt|quot|apos);/g,(_,n)=>({amp:"&",lt:"<",gt:">",quot:'"',apos:"'"}[n]))
  .replace(/\n{3,}/g,"\n\n").trim();
 if(!clean)throw Error("DOCX ini tiada teks yang boleh dibaca.");
 return clean.slice(0,95000);
}
async function read(file){
 if(!file||file.size<50||file.size>MAX_FILE)throw Error("DOCX mesti bersaiz 2.2 MB atau kurang.");
 const bytes=await file.arrayBuffer();
 const entry=locate(bytes);
 const out=await inflate(entry);
 if(out.length!==entry.unpacked)throw Error("Saiz dokumen DOCX tidak sepadan.");
 return strip(new TextDecoder("utf-8",{fatal:true}).decode(out));
}
root.AksaraDocx=Object.freeze({read});
if(typeof module!=="undefined"&&module.exports)module.exports={read,strip,locate};
})(typeof window!=="undefined"?window:globalThis);
