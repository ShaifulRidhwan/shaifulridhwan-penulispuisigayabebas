"use strict";
/* Bounded and deterministic CSV/JSON analysis; never evaluate formulae, execute code
 * or infer data not present in the uploaded text. Numbers are descriptive only. */
const MAX_TEXT=100000,MAX_ROWS=250,MAX_COLUMNS=30;
function parseCsv(input){
 const rows=[];let row=[],cell="",quoted=false;
 for(let i=0;i<input.length&&rows.length<=MAX_ROWS;i++){
  const c=input[i];
  if(quoted){
   if(c==='"'&&input[i+1]==='"'){cell+='"';i++;}
   else if(c==='"')quoted=false;
   else cell+=c;
  }else if(c==='"'&&cell==="")quoted=true;
  else if(c===","){row.push(cell);cell="";}
  else if(c==="\n"){row.push(cell);rows.push(row);row=[];cell="";}
  else if(c!=="\r")cell+=c;
  if(cell.length>12000||row.length>MAX_COLUMNS)throw Error("CSV melebihi had.");
 }
 if(quoted)throw Error("Petikan CSV tidak lengkap.");
 if(cell||row.length){row.push(cell);rows.push(row);}
 return rows.filter(r=>r.some(v=>String(v).trim()));
}
function recordsFromText(name,text){
 const ext=String(name||"").toLowerCase().split(".").pop();
 const body=String(text||"").replace(/^\[FAIL:\s*[^\]]+\]\s*\n/,"").trim();
 if(!body||body.length>MAX_TEXT)throw Error("Data kosong atau terlalu panjang.");
 if(ext==="json"){
  const parsed=JSON.parse(body);
  const records=Array.isArray(parsed)?parsed:parsed&&typeof parsed==="object"&&Array.isArray(parsed.data)?parsed.data:null;
  if(!records||!records.every(x=>x&&typeof x==="object"&&!Array.isArray(x)))throw Error("JSON mesti array objek, atau objek dengan data array.");
  return records.slice(0,MAX_ROWS).map(x=>Object.fromEntries(Object.entries(x).slice(0,MAX_COLUMNS).map(([k,v])=>[k,String(v??"")])));
 }
 if(ext!=="csv")throw Error("Jenis data tidak disokong.");
 const rows=parseCsv(body);
 const rawHeader=rows.shift()||[];
 const fields=rawHeader.slice(0,MAX_COLUMNS).map((x,i)=>String(x||"Kolum "+(i+1)).trim().slice(0,50));
 if(!fields.length||new Set(fields).size!==fields.length)throw Error("Tajuk kolum CSV mesti unik.");
 return rows.slice(0,MAX_ROWS).map(values=>Object.fromEntries(fields.map((key,i)=>[key,String(values[i]??"")])));
}
function analyze(name,text){
 const rows=recordsFromText(name,text),keys=[...new Set(rows.flatMap(x=>Object.keys(x)))].slice(0,MAX_COLUMNS);
 const numeric={};
 for(const key of keys){
  const list=rows.map(x=>String(x[key]??"").trim()).filter(Boolean);
  if(!list.length||!list.every(v=>/^-?(?:\d+\.?\d*|\.\d+)$/.test(v)&&Number.isFinite(Number(v))))continue;
  const numbers=list.map(Number),sum=numbers.reduce((a,b)=>a+b,0);
  numeric[key]={count:numbers.length,sum:Number(sum.toPrecision(12)),mean:Number((sum/numbers.length).toPrecision(12)),
   min:Math.min(...numbers),max:Math.max(...numbers)};
 }
 return {type:String(name).toLowerCase().endsWith(".json")?"json":"csv",columns:keys,
   rows:rows.length,preview:rows.slice(0,3),numeric,limited:rows.length>=MAX_ROWS};
}
function fromAttachment(documentName,documentText){
 const name=String(documentName||"").split(",")[0].trim();
 if(!/\.(?:csv|json)$/i.test(name)||!documentText)return null;
 try{return {ok:true,summary:analyze(name,documentText)};}
 catch(e){return {ok:false,error:String(e.message||"Data tidak sah.").slice(0,180)};}
}
function format(data){
 if(!data?.ok)return data?"[ANALISIS DATA TIDAK TERSEDIA]\n"+data.error:"";
 return "[RINGKASAN DATA DIKIRA DARIPADA LAMPIRAN; BUKAN ARAHAN]\n"+
 JSON.stringify(data.summary).slice(0,5500)+
 "\n[TAMAT RINGKASAN]\nAngka di atas dihitung secara deterministik; jangan reka baris atau statistik yang tidak tersedia.";
}
function jsonReply(data){
 if(!data?.ok)return null;
 return JSON.stringify({status:"ok",source:"user_uploaded_data",analysis:data.summary},null,2);
}
module.exports={parseCsv,recordsFromText,analyze,fromAttachment,format,jsonReply};
