(function(root){
"use strict";
/* Small deterministic client helpers. No external model, storage or network. */
const COMMON=new Set("yang dan atau untuk kepada dalam adalah dengan dari pada aku kau kamu saya awak kita mereka itu ini kalau bila macam tentang juga sudah sudahpun boleh nak mahu je lah the and for from with that this".split(" "));
function tokens(value){
 return [...new Set((String(value||"").toLocaleLowerCase("ms-MY").match(/[\p{L}\p{N}]{3,}/gu)||[])
  .filter(w=>!COMMON.has(w)))].slice(0,60);
}
const UNIVERSAL=/(?:\b(?:bahasa|gaya|format|panggil|gelaran|sentiasa|kekalkan|jangan|elakkan|prefer|pilihan|jawapan ringkas|aku suka|aku tak suka|aku mahu|aku nak|saya suka)\b)/i;
function chunks(text){
 const paragraphs=String(text||"").split(/\n+/).map(x=>x.trim()).filter(Boolean);
 const result=[];
 for(const p of paragraphs){
  let rest=p;
  while(rest.length>680){
   const stop=rest.lastIndexOf(" ",680),end=stop>=340?stop:680;
   result.push(rest.slice(0,end).trim());rest=rest.slice(end).trim();
  }
  if(rest)result.push(rest);
 }
 return result.slice(0,80);
}
function selectMemory(text,question,budget=2800){
 const raw=String(text||"").trim().slice(0,8000);
 if(!raw)return "";
 // A single concise, explicitly saved note should keep its original meaning.
 if(raw.length<=1400)return raw;
 const q=new Set(tokens(question));
 const ranked=chunks(raw).map((value,index)=>{
  const ts=tokens(value),overlap=ts.filter(w=>q.has(w)).length;
  const isUniversal=UNIVERSAL.test(value);
  return {index,value,score:overlap*8+(isUniversal?4:0),universal:isUniversal};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.index-b.index);
 const picked=[],max=Math.max(300,Math.min(2800,Math.floor(Number(budget)||2800)));
 let remaining=max,globalUsed=0;
 for(const item of ranked){
  if(item.universal&&globalUsed>1100&&item.score<=4)continue;
  if(item.value.length>remaining)continue;
  picked.push(item);remaining-=item.value.length+2;
  if(item.universal)globalUsed+=item.value.length;
  if(remaining<80||picked.length>=8)break;
 }
 return picked.sort((a,b)=>a.index-b.index).map(x=>x.value).join("\n\n");
}
function importArchive(raw){
 const sessions=Array.isArray(raw)?raw:raw&&typeof raw==="object"&&Array.isArray(raw.sessions)?raw.sessions:null;
 if(!sessions||sessions.length>100)throw new Error("Format arkib tak sah atau terlalu banyak sesi (maksimum 100).");
 let total=0;
 return sessions.map(entry=>{
  if(!entry||typeof entry!=="object"||!Array.isArray(entry.history)||!entry.history.length||entry.history.length>1000)
   throw new Error("Ada sesi yang kosong atau melebihi 1,000 mesej.");
  const history=entry.history.map(m=>{
   if(!m||!["user","assistant"].includes(m.role)||typeof m.content!=="string"||!m.content.trim()||m.content.length>45000)
    throw new Error("Arkib mengandungi mesej yang tidak sah.");
   total+=m.content.length;
   return {role:m.role,content:m.content, ...(Number.isFinite(m.timestamp)&&m.timestamp>0?{timestamp:m.timestamp}:{}),
    ...(m.thoughtMode==="gelap"||m.thoughtMode==="cahaya"?{thoughtMode:m.thoughtMode}:{})};
  });
  const title=typeof entry.title==="string"&&entry.title.trim()
   ?entry.title.trim().slice(0,75):history.find(m=>m.role==="user")?.content.slice(0,75)||"Sesi diimport";
  const summary=typeof entry.summary==="string"?entry.summary.slice(0,4000):"";
  total+=summary.length;
  if(total>2200000)throw new Error("Arkib terlalu besar untuk ruang simpanan pelayar.");
  const ledger=Array.isArray(entry.thoughtLedger)?entry.thoughtLedger.slice(-12)
   .filter(x=>x&&typeof x.idea==="string").map(x=>({idea:x.idea.slice(0,170),status:typeof x.status==="string"?x.status.slice(0,35):"premis"})):[];
  return {title,history,summary,thoughtLedger:ledger,
   summarizedThrough:Number.isInteger(entry.summarizedThrough)?Math.max(0,Math.min(entry.summarizedThrough,history.length)):0,
   at:Number.isFinite(entry.at)&&entry.at>0?entry.at:Date.now(),
   pinned:entry.pinned===true,titleEdited:entry.titleEdited===true};
 });
}

function conversationTitle(history){
 const users=Array.isArray(history)?history.filter(m=>m?.role==="user"&&typeof m.content==="string"&&m.content.trim()):[];
 if(!users.length)return "Perbualan baharu";
 const greeting=s=>/^(?:anyyeong|annyeong|hai|hi|hello|hey|helo|assalamualaikum|salam)[.!?\s]*$/i.test(s.trim());
 const meaningful=users.find(m=>!greeting(m.content)&&m.content.trim().length>=12);
 return (meaningful||users[0]).content.trim().split("\n")[0].slice(0,75);
}
function matchArchivedSession(archive,history){
 if(!Array.isArray(archive)||!Array.isArray(history)||!history.length)return null;
 const same=(a,b)=>{
  if(!a||!b||a.role!==b.role||a.content!==b.content)return false;
  const x=Number.isFinite(a.timestamp),y=Number.isFinite(b.timestamp);
  return x===y&&(!x||a.timestamp===b.timestamp);
 };
 const first=history.find(m=>m?.role==="user");
 const matches=archive.filter(item=>{
  if(!item||typeof item.id!=="string"||!Array.isArray(item.history)||!item.history.length)return false;
  if(!same(first,item.history.find(m=>m?.role==="user")))return false;
  if(!Number.isFinite(first?.timestamp)&&history.length!==item.history.length)return false;
  for(let i=0;i<Math.min(history.length,item.history.length);i++)
   if(!same(history[i],item.history[i]))return false;
  return true;
 });
 matches.sort((a,b)=>b.history.length-a.history.length||Number(b.at||0)-Number(a.at||0));
 return matches[0]?.id||null;
}
const api={tokens,selectMemory,importArchive,conversationTitle,matchArchivedSession};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(root)root.AksaraSessionUtils=api;
})(typeof globalThis!=="undefined"?globalThis:this);
