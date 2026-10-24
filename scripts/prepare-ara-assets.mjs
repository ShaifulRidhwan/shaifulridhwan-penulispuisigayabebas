// Netlify build: fetch GitHub Release server-side and publish small same-origin GLB chunks.
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
const url='https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/releases/download/ara-3d-v1/alina_ip_realistic_asian_woman_animated.glb';
const dir='ara-assets';
try {
  const res=await fetch(url,{signal:AbortSignal.timeout(240000),headers:{'User-Agent':'Ara-Netlify-Build/1.0'}});
  if(!res.ok||!res.body)throw Error('Release HTTP '+res.status);
  await rm(dir,{recursive:true,force:true});await mkdir(dir,{recursive:true});
  const max=8*1024*1024;let pending=Buffer.alloc(0),count=0,total=0;
  async function save(data){await writeFile(join(dir,'part-'+String(count++).padStart(3,'0')+'.bin'),data);}
  for await(const chunk of res.body){
    pending=Buffer.concat([pending,chunk]);total+=chunk.length;
    if(total>250*1024*1024)throw Error('GLB larger than 250 MB');
    while(pending.length>=max){await save(pending.subarray(0,max));pending=pending.subarray(max);}
  }
  if(pending.length)await save(pending);
  if(total<1024*1024)throw Error('Asset unexpectedly small');
  await writeFile(join(dir,'manifest.json'),JSON.stringify({parts:count,bytes:total,version:'ara-3d-v1'}));
  console.log('Ara GLB prepared:',count,'parts,',total,'bytes');
}catch(e){
  console.warn('Ara model build unavailable, existing model remains:',e.message);
  await rm(dir,{recursive:true,force:true});
}
