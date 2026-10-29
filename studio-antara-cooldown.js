/* Local countdown is only a visual reminder; Netlify remains the source of truth. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.StudioCooldown=value;})(typeof window!=='undefined'?window:this,()=>{
'use strict';
const PREFIX='studio-antara-cooldown-v1:',SCOPES=Object.freeze(['studio','cloudflare','ovh']);
const valid=scope=>SCOPES.includes(scope);
function remaining(deadline,now=Date.now()){return Math.max(0,Math.ceil((Number(deadline)-now)/1000)||0);}
function format(seconds){
 const n=Math.max(0,Math.ceil(Number(seconds)||0)),h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;
 return (h?h+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}
function read(scope,storage,now=Date.now()){
 if(!valid(scope)||!storage)return 0;
 try{
  const raw=storage.getItem(PREFIX+scope);if(raw===null)return 0;
  const deadline=Number(raw);
  if(!Number.isSafeInteger(deadline)||deadline<=now||deadline>now+86400000){storage.removeItem(PREFIX+scope);return 0;}
  return deadline;
 }catch(_){return 0;}
}
function save(scope,seconds,storage,now=Date.now()){
 if(!valid(scope)||!Number.isFinite(seconds)||seconds<=0)return 0;
 const deadline=now+Math.ceil(Math.min(86400,seconds))*1000;
 if(storage){try{storage.setItem(PREFIX+scope,String(deadline));}catch(_){}}
 return deadline;
}
function clear(scope,storage){if(!valid(scope)||!storage)return;try{storage.removeItem(PREFIX+scope);}catch(_){}}
function parseRetryAfter(value,now=Date.now()){
 if(typeof value!=='string')return 0;
 const trimmed=value.trim();let seconds=/^\d+$/.test(trimmed)?Number(trimmed):NaN;
 if(!Number.isFinite(seconds)&&trimmed){const date=Date.parse(trimmed);if(Number.isFinite(date))seconds=Math.ceil((date-now)/1000);}
 return Number.isFinite(seconds)&&seconds>0?Math.min(86400,Math.ceil(seconds)):0;
}
return Object.freeze({SCOPES,PREFIX,remaining,format,read,save,clear,parseRetryAfter});
});