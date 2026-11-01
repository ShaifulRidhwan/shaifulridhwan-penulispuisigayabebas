"use strict";
/* Explicit JSON formatting: validate or wrap unstructured model text honestly. */
function wantsJson(question){
 return /\b(?:balas|jawab|hasil(?:kan)?|berikan|format|output|reply|return)\b.{0,35}\bjson\b|\bjson\b.{0,25}\b(?:format|output|sah|valid)\b/i.test(String(question||""));
}
function render(value,asJson=false){
 const raw=String(value||"").trim();
 if(!asJson)return {reply:raw,validJson:false,changed:false};
 const fence=String.fromCharCode(96).repeat(3);
 let clean=raw;
 if(raw.startsWith(fence)&&raw.endsWith(fence)){
  clean=raw.slice(fence.length,-fence.length).replace(/^json\s*\n/i,"").trim();
 }
 try{
  const parsed=JSON.parse(clean);
  if(parsed===null||typeof parsed!=="object")throw Error("JSON object or array expected");
  return {reply:fence+"json\n"+JSON.stringify(parsed,null,2)+"\n"+fence,validJson:true,changed:clean!==raw};
 }catch(_){
  return {reply:fence+"json\n"+JSON.stringify({answer:raw,formatNote:"Model tidak menghasilkan struktur JSON yang diminta; jawapan asal dibungkus sebagai teks."},null,2)+"\n"+fence,
   validJson:true,changed:true};
 }
}
module.exports={wantsJson,render};
