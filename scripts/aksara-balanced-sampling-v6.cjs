"use strict";
/* Deterministic stratified sampling, zero network. No category monopolizes a small test. */
function pick(cases,count=5,{seed=0}={}){
 const rows=Array.isArray(cases)?cases.filter(x=>x&&typeof x.task==="string"):[];
 const groups=new Map();
 for(const item of rows){
  if(!groups.has(item.task))groups.set(item.task,[]);
  groups.get(item.task).push(item);
 }
 const keys=[...groups.keys()].sort();
 if(!keys.length)return [];
 const wanted=Math.max(0,Math.min(rows.length,Math.floor(Number(count)||0)));
 const chosen=[],offset=((Math.floor(seed)%keys.length)+keys.length)%keys.length;
 let round=0;
 while(chosen.length<wanted){
  let added=0;
  for(let n=0;n<keys.length&&chosen.length<wanted;n++){
   const key=keys[(n+offset)%keys.length],items=groups.get(key);
   if(round<items.length){chosen.push(items[round]);added++;}
  }
  if(!added)break;
  round++;
 }
 return chosen;
}
module.exports={pick};
