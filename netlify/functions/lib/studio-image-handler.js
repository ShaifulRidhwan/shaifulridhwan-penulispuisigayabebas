'use strict';
const Config=require('../../../studio-antara-config');
const Quota=require('./studio-quota');
const {response,input,readLimited,imageInfo}=require('./studio-http');
const {randomInt}=require('node:crypto');
function createHandler({fetchImpl=fetch,reserve=Quota.reserve,env=process.env,timeout=45000}={}){
 return async event=>{
  let release,timer;
  try{
   const data=input(event);if(Object.keys(data).some(k=>!['prompt','style','model','ratio','quality','seed'].includes(k)))return response(400,{error:'Ada tetapan yang tak disokong.'});
   let s;try{s=Config.settings(data);}catch(e){return response(400,{error:e.message});}
   if(env.STUDIO_DISABLED==='true')return response(503,{error:'Studio direhatkan sementara. Cuba lagi nanti.'});
   if(s.model!=='ovh'&&(!/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID||'')||!env.CLOUDFLARE_API_TOKEN))return response(503,{error:'Sambungan Cloudflare belum tersedia.'});
   if(s.model==='klein'&&s.seed===null)s.seed=randomInt(2147483648);
   const promptUsed=Config.compose(s),estimatedNeurons=Config.estimate(s);
   release=await reserve(event,estimatedNeurons);
   const ctrl=new AbortController();timer=setTimeout(()=>ctrl.abort(),timeout);
   const ovh=s.model==='ovh';
   let body,headers=ovh?{'Content-Type':'application/json'}:{Authorization:'Bearer '+env.CLOUDFLARE_API_TOKEN};
   if(ovh){
    // Public anonymous endpoint: no billing token or Cloudflare quota is used.
    body=JSON.stringify({model:Config.models.ovh.id,prompt:promptUsed,size:'1024x1024'});
   }else if(s.model==='klein'){
    body=new FormData();for(const [key,value] of Object.entries({prompt:promptUsed,width:s.width,height:s.height,seed:s.seed}))body.set(key,String(value));
   }else{headers['Content-Type']='application/json';body=JSON.stringify({prompt:promptUsed,steps:s.steps});}
   const url=ovh?'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/images/generations':'https://api.cloudflare.com/client/v4/accounts/'+env.CLOUDFLARE_ACCOUNT_ID+'/ai/run/'+Config.models[s.model].id;
   const started=Date.now();let upstream;
   try{upstream=await fetchImpl(url,{method:'POST',headers,body,signal:ctrl.signal});}catch(error){if(error.name==='AbortError')throw error;throw Error(ovh?'OVHcloud Beta tak dapat dihubungi. Cuba Klein atau Schnell.':'Sambungan ke Cloudflare terputus. Cuba lagi sebentar.');}
   if(!upstream.ok){
    if(upstream.status===429){
     const retry=upstream.headers.get('retry-after');
     let seconds=/^\d+$/.test(retry||'')?Number(retry):NaN;
     if(!Number.isFinite(seconds)&&retry){const date=Date.parse(retry);if(Number.isFinite(date))seconds=Math.ceil((date-Date.now())/1000);}
     seconds=Number.isFinite(seconds)&&seconds>0?Math.min(86400,Math.ceil(seconds)):60;
     return response(429,{error:ovh?'OVHcloud Beta sedang terhad (429). Cuba semula kemudian atau pilih Klein/Schnell.':'Had atau kuota Cloudflare dah dicapai. Cuba kemudian.',scope:ovh?'ovh':'cloudflare'},seconds);
    }
    if([401,403].includes(upstream.status))return response(502,{error:ovh?'OVHcloud Beta menolak akses tanpa token. Model ini belum stabil; pilih Klein/Schnell.':'Cloudflare menolak kebenaran penjanaan. Pemilik perlu semak token.'});
    return response(502,{error:ovh?'OVHcloud Beta belum berjaya menjana imej (HTTP '+upstream.status+'). Cuba Klein atau Schnell.':'Cloudflare tak berjaya menjana imej (HTTP '+upstream.status+'). Cuba model atau tetapan lain.'});
   }
   const raw=await readLimited(upstream,4800000);let bytes;
   if(/^image\/(jpeg|png)/i.test(upstream.headers.get('content-type')||''))bytes=raw;
   else{
    let json;try{json=JSON.parse(raw.toString());}catch(_){throw Error(ovh?'Respons OVHcloud Beta tak sah.':'Cloudflare memulangkan respons yang tak sah.');}
    let image=ovh?json?.data?.[0]?.b64_json:(json?.result?.image||json?.image);
    if(typeof image!=='string'||image.length>4700000)throw Error(ovh?'OVHcloud Beta tak memulangkan imej.':'Cloudflare tak memulangkan imej.');
    image=image.replace(/^data:image\/(?:jpeg|png);base64,/i,'');
    if(!/^[A-Za-z0-9+/]+={0,2}$/.test(image))throw Error('Data imej tak sah.');bytes=Buffer.from(image,'base64');
   }
   const info=imageInfo(bytes);if(info.width>1920||info.height>1920||info.width<256||info.height<256)throw Error('Dimensi hasil tak disokong.');
   if(s.model==='klein'&&(info.width!==s.width||info.height!==s.height))throw Error('Cloudflare memulangkan saiz berbeza daripada tetapan. Hasil tak dianggap nisbah natif yang diminta.');
   if(ovh&&(info.width!==1024||info.height!==1024))throw Error('OVHcloud Beta memulangkan saiz di luar spesifikasi 1024 × 1024.');
   return response(200,{ok:true,image:bytes.toString('base64'),...info,settings:s,promptUsed,modelName:Config.models[s.model].name,durationMs:Date.now()-started,estimatedNeurons});
  }catch(error){return response(error.status|| (error.name==='AbortError'?504:502),{error:error.name==='AbortError'?'Penjanaan terlalu lama. Kau boleh cuba lagi.':error.message?.slice(0,240)||'Sambungan gagal.',...(error.status===429?{scope:'studio'}:{})},error.retryAfter);}
  finally{clearTimeout(timer);if(release)await release();}
 };
}
exports.handler=createHandler();exports.createHandler=createHandler;
