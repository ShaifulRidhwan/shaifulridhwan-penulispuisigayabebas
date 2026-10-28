(function(root){
"use strict";
const emoji=/\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3/u;
const segments=typeof Intl.Segmenter==="function"?new Intl.Segmenter("ms",{granularity:"grapheme"}):null;
function glyphs(text){return segments?[...segments.segment(text)].map(x=>x.segment):Array.from(text);}
function count(text){return glyphs(String(text||"")).filter(x=>emoji.test(x)).length;}
function pair(text){
 if(/sedih|kehilangan|meninggal|duka|krisis|kesakitan|bunuh diri/i.test(text))return ["🤍","🫂"];
 if(/kod|coding|program|ralat|javascript|python|api/i.test(text))return ["💻","🔧"];
 if(/puisi|sajak|pantun|menulis|karya|novel/i.test(text))return ["✍️","✨"];
 if(/belajar|sains|konsep|pengetahuan|sejarah/i.test(text))return ["💡","📚"];
 return ["🙂","✨"];
}
function reply(value,options={}){
 const text=String(value||"");if(!text.trim())return text;
 let seen=0;
 // Count whole graphemes: flags, skin tones and joined families are one emoji.
 // Literal code is content, not conversational decoration: never rewrite it.
 const clean=text.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g).map((part,index)=>
  index%2?part:glyphs(part).map(g=>emoji.test(g)?(++seen<=2?g:""):g).join("")
 ).join("").replace(/[ \t]+\n/g,"\n").trimEnd();
 if(options.complete===false||seen>=2)return clean;
 const needed=pair(text).filter(x=>!clean.includes(x)).slice(0,2-seen);
 return clean+" "+needed.join(" ");
}
const api={reply,count};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(root)root.BilikAntaraChatStyle=api;
})(typeof globalThis!=="undefined"?globalThis:this);
