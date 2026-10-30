"use strict";
/* Context Manager 2.0: no server-side memory or embeddings. Recency + salience
 * work only on history the visitor sent in their current request. */
const STOP=new Set("yang dan atau untuk kepada dalam adalah dengan saya aku kau kamu awak pada dari tentang apa bagaimana kenapa itu ini juga kalau maka satu suatu boleh jadi mahu nak the and for from with".split(" "));
function words(s){return [...new Set(String(s||"").toLocaleLowerCase("ms-MY").match(/[\p{L}\p{N}]{3,}/gu)||[])].filter(w=>!STOP.has(w)).slice(0,72);}
function selectHistory(rows,question,{maxChars=28000,keepRecent=7}={}){
 const history=Array.isArray(rows)?rows.filter(x=>x&&["user","assistant"].includes(x.role)&&typeof x.content==="string").slice(-70):[];
 if(history.length<=keepRecent)return history;
 const recentStart=Math.max(0,history.length-keepRecent);
 const tokens=new Set(words(question)),scores=[];
 for(let i=0;i<recentStart;i++){
  const msg=history[i],items=words(msg.content),overlap=items.filter(w=>tokens.has(w)).length;
  const correction=msg.role==="user"&&/(?:maksud aku|bukan begitu|jangan ubah|aku pilih|keputusan akhir|kekalkan|tolong ingat)/i.test(msg.content);
  scores.push({i,score:overlap*5+(correction?4:0)+(msg.role==="user"?1:0)+(i/recentStart)});
 }
 const recent=history.slice(recentStart);
 const recentChars=recent.reduce((n,m)=>n+m.content.length,0);
 let remaining=Math.max(0,maxChars-recentChars);
 const selected=new Set();
 for(const item of scores.sort((a,b)=>b.score-a.score)){
  if(item.score<=0||selected.size>=9)break;
  const m=history[item.i];
  if(m.content.length>remaining)continue;
  remaining-=m.content.length;selected.add(item.i);
 }
 return history.filter((_,i)=>i>=recentStart||selected.has(i));
}
function summarizeCorrection(rows){
 const last=Array.isArray(rows)?rows.slice(-14):[];
 return last.filter(x=>x.role==="user"&&/(?:maksud aku|jangan ubah|sebenarnya|pembetulan|kekalkan)/i.test(x.content||""))
  .slice(-3).map(m=>String(m.content||"").slice(0,350));
}
module.exports={words,selectHistory,summarizeCorrection};
