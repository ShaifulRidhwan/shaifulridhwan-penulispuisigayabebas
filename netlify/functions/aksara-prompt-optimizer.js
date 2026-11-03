"use strict";
/* Exact-line only; never rewrite policy, safety or personality semantically. */
function lines(input){return String(input||"").split("\n");}
function audit(input){
 const seen=new Set(),duplicates=[];let nonempty=0;
 for(const line of lines(input)){
  const key=line.trim();
  if(!key)continue;
  nonempty++;
  if(seen.has(key))duplicates.push(key.slice(0,120));else seen.add(key);
 }
 return {nonemptyLines:nonempty,exactDuplicates:duplicates.length,
  sample:duplicates.slice(0,5),semanticConflicts:"not_evaluated"};
}
function compose(parts,{dedupeExact=false}={}){
 const source=(Array.isArray(parts)?parts:[]).filter(x=>typeof x==="string").join("\n");
 if(!dedupeExact)return source;
 const seen=new Set();
 return lines(source).filter(line=>{
  const key=line.trim();
  if(!key)return true;
  if(seen.has(key))return false;
  seen.add(key);return true;
 }).join("\n");
}
module.exports={audit,compose};
