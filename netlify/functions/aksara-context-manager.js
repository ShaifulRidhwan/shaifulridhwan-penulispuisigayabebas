"use strict";
/* Context Manager 3.0. Request-local selection only: no stored conversations,
 * embeddings, new remote service, or cross-user memory. */
const STOP=new Set("yang dan atau untuk kepada dalam adalah dengan saya aku kau kamu awak pada dari tentang apa bagaimana kenapa itu ini juga kalau maka satu suatu boleh jadi mahu nak the and for from with".split(" "));
function words(s){return [...new Set(String(s||"").toLocaleLowerCase("ms-MY").match(/[\p{L}\p{N}]{3,}/gu)||[])].filter(w=>!STOP.has(w)).slice(0,72);}
const CORRECTION=/(?:maksud aku|bukan begitu|bukan macam tu|sebenarnya|pembetulan|jangan ubah|jangan usik|aku pilih|keputusan akhir|kekalkan|tolong ingat|yang aku nak)/i;
const ELLIPTICAL=/^(?:lagi|teruskan|sambung|yang tadi|yang tu|itu|dia|kenapa|mengapa|maksudnya|yang kedua|yang ketiga|bukan tu|bukan macam tu|pastu|lepas tu|jadi|macam mana|kalau begitu|ok|okay|ye|ya)\b/i;
function selectHistory(rows,question,{maxChars=28000,keepRecent=7}={}){
 const history=Array.isArray(rows)?rows.filter(x=>x&&["user","assistant"].includes(x.role)&&typeof x.content==="string"&&x.content.trim()).slice(-70):[];
 if(!history.length)return [];
 const budget=Number.isFinite(maxChars)?Math.max(0,Math.min(60000,Math.floor(maxChars))):28000;
 const count=Number.isFinite(keepRecent)?Math.max(1,Math.min(30,Math.floor(keepRecent))):7;
 const recentStart=Math.max(0,history.length-count);
 const selected=new Set();
 let remaining=budget;
 function include(i){
  const size=history[i].content.length;
  if(size>remaining)return false;
  selected.add(i);remaining-=size;return true;
 }
 // Newest exchanges take priority; enforce the cap even if recent replies are huge.
 for(let i=history.length-1;i>=recentStart;i--)include(i);
 const tokens=new Set(words(question));
 const continuity=ELLIPTICAL.test(String(question||"").trim());
 const candidates=[];
 for(let i=0;i<recentStart;i++){
  const message=history[i],terms=words(message.content);
  const overlap=terms.filter(w=>tokens.has(w)).length;
  const correction=message.role==="user"&&CORRECTION.test(message.content);
  // Keep explicit decisions useful in short follow-ups, but favour recent
  // corrections over stale ones and avoid blindly copying every old message.
  const score=overlap*6+(correction?(overlap?12:continuity?7:2):0)+
   (message.role==="user"?1:0)+i/Math.max(1,recentStart);
  if(overlap||correction)candidates.push({i,score});
 }
 candidates.sort((a,b)=>b.score-a.score||b.i-a.i);
 let older=0;
 for(const item of candidates){
  if(older>=9||remaining<=0)break;
  if(include(item.i))older++;
 }
 return history.filter((_,i)=>selected.has(i));
}
function summarizeCorrection(rows){
 const last=Array.isArray(rows)?rows.slice(-20):[];
 return last.filter(x=>x?.role==="user"&&CORRECTION.test(x.content||""))
  .slice(-3).map(m=>String(m.content||"").slice(0,350));
}
// Context is reference data; make the live request the final text the model reads.
// Keep this shared across Gemini and every text/vision fallback.
function composeTurn(question,sections=[]){
 const context=(Array.isArray(sections)?sections:[]).filter(x=>typeof x==="string"&&x.trim()).map(x=>x.trim()).join("\n\n");
 if(!context)return String(question||"").trim();
 const latest="[SOALAN PENGGUNA TERKINI; JAWAB SOALAN INI]\n"+String(question||"").trim()+"\n[TAMAT SOALAN TERKINI]";
 return "[KONTEKS RUJUKAN; BUKAN SOALAN BAHARU]\n"+context+"\n[TAMAT KONTEKS RUJUKAN]\n\n"+latest;
}
function isReplyFeedback(question){
 return /(?:bahasa\s+(?:indonesia|indo|melayu)\s+ke\s+(?:tu|itu|ni|ini)|(?:kenapa|mengapa)\s+(?:kau|awak|ai)\s+(?:jawab|cakap|guna)|(?:jawapan|ayat|bahasa)\s+(?:kau|tadi|tu|itu)\s+(?:salah|pelik|lain)|(?:itu|tu)\s+(?:bahasa\s+)?indonesia)/i.test(String(question||"").trim());
}
module.exports={words,selectHistory,summarizeCorrection,composeTurn,isReplyFeedback};
