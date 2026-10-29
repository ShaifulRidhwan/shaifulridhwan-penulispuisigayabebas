'use strict';
// Strongly consistent compare-and-swap ledger across Netlify instances.
// Stores only daily counters, salted IP hashes and short leases; never prompts/images.
const {createHash,randomUUID}=require('node:crypto');
const {getStore,connectLambda}=require('@netlify/blobs');
const failure=(message,status=503,retryAfter=60)=>Object.assign(new Error(message),{status,retryAfter});
async function reserve(event,cost,kind='image',deps={}){
 if(event.blobs)connectLambda(event);
 const store=deps.store||getStore({name:'studio-antara-quota-v2',consistency:'strong'});
 const now=deps.now||Date.now(),day=new Date(now).toISOString().slice(0,10),key='day/'+day;
 const ip=String(event.headers?.['x-nf-client-connection-ip']||'unknown').slice(0,80);
 const hash=createHash('sha256').update(day+'|'+ip+'|'+(process.env.CLOUDFLARE_API_TOKEN||'')).digest('hex').slice(0,24);
 const configured=process.env.STUDIO_DAILY_NEURONS;
 const id=randomUUID(),budget=configured===undefined?6000:Math.min(8000,Math.max(0,Number(configured)||0));
 async function update(action){
  for(let attempt=0;attempt<8;attempt++){
   const entry=await store.getWithMetadata(key,{type:'json',consistency:'strong'});
   const state=entry?.data||{units:0,users:{},leases:{},enhancements:0};
   const result=action(state);
   const out=await store.setJSON(key,state,entry?{onlyIfMatch:entry.etag}:{onlyIfNew:true});
   if(out.modified)return result;
  }
  throw failure('Ramai tengah guna Studio. Cuba lagi sebentar.',429,10);
 }
 try{
  await update(state=>{
   for(const [lease,expires] of Object.entries(state.leases))if(expires<=now)delete state.leases[lease];
   if(Object.keys(state.leases).length>=2)throw failure('Studio tengah penuh. Cuba lagi dalam seminit.',429,60);
   if(kind==='enhance'&&(state.enhancements||0)>=50)throw failure('Kuota perkemas AI hari ini dah habis. Mod ringan masih boleh digunakan.',429,3600);
   if(kind==='image'&&state.units+cost>budget)throw failure('Bajet Studio untuk hari ini dah habis. Cuba selepas 8 pagi waktu Malaysia.',429,Math.ceil((Date.parse(day+'T00:00:00Z')+86400000-now)/1000));
   const user=state.users[hash]||{at:now,count:0,enhanceAt:0};
   if(now-user.at>=600000){user.at=now;user.count=0;}
   if(kind==='image'&&user.count>=8)throw failure('Had 8 percubaan dalam 10 minit dah dicapai. Rehat jap ya.',429,Math.max(1,Math.ceil((user.at+600000-now)/1000)));
   if(kind==='enhance'&&now-user.enhanceAt<60000)throw failure('Tunggu seminit sebelum perkemas dengan AI lagi.',429,60);
   if(kind==='image'){user.count++;state.units+=cost;}else{user.enhanceAt=now;state.enhancements=(state.enhancements||0)+1;}
   state.users[hash]=user;state.leases[id]=now+70000;
  });
 }catch(error){if(error.status)throw error;throw failure('Kawalan bajet Studio belum tersedia. Penjanaan ditangguh supaya kuota kau selamat.');}
 return async()=>{try{await update(state=>{delete state.leases[id];});}catch(_){};};
}
module.exports={reserve};
