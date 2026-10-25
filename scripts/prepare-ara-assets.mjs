// Download Ara GLB, optimize textures/materials, publish same-origin 8 MB chunks.
import {mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
const url='https://github.com/ShaifulRidhwan/shaifulridhwan-penulispuisigayabebas/releases/download/ara-3d-v1/alina_ip_realistic_asian_woman_animated.glb';
const dir='ara-assets',source='/tmp/ara-original.glb',optimized='/tmp/ara-optimized.glb';
try{
 const res=await fetch(url,{signal:AbortSignal.timeout(240000),headers:{'User-Agent':'Ara-Netlify-Build/1.0'}});
 if(!res.ok||!res.body)throw Error('Release HTTP '+res.status);
 const chunks=[];let length=0;
 for await(const chunk of res.body){chunks.push(chunk);length+=chunk.length;if(length>250*1024*1024)throw Error('Asset too large');}
 if(length<1024*1024)throw Error('GLB unexpectedly small');
 await writeFile(source,Buffer.concat(chunks));
 // Pillow is a build-only dependency; not shipped to the browser.
 execFileSync('python',['-m','pip','install','--quiet','--target','/tmp/ara-python-deps','Pillow','numpy'],{stdio:'inherit',timeout:120000});
 execFileSync('python',['scripts/optimize-ara.py',source,optimized],{stdio:'inherit',timeout:180000,env:{...process.env,PYTHONPATH:'/tmp/ara-python-deps'}});
 const android='/tmp/ara-android-v27.glb';
 execFileSync('python',['scripts/build-ara-v32.py',optimized,android],{stdio:'inherit',timeout:120000,env:{...process.env,PYTHONPATH:'/tmp/ara-python-deps'}});
 const bytes=await readFile(android);
 if(bytes.toString('ascii',0,4)!=='glTF')throw Error('Invalid optimized GLB');
 await rm(dir,{recursive:true,force:true});await mkdir(dir,{recursive:true});
 const max=8*1024*1024;let count=0;const version='v7';await mkdir(join(dir,version),{recursive:true});
 for(let offset=0;offset<bytes.length;offset+=max){
  await writeFile(join(dir,version,'part-'+String(count++).padStart(3,'0')+'.bin'),bytes.subarray(offset,offset+max));
 }
 await writeFile(join(dir,'manifest.json'),JSON.stringify({parts:count,bytes:bytes.length,version:'v7'}));
 console.log('Ara GLB optimized and prepared:',count,'parts,',bytes.length,'bytes; original',length);
}catch(e){
 console.error('Ara optimization failed:',e.message);
 // Fail the deployment instead of silently publishing a broken site without the manifest.
 await rm(dir,{recursive:true,force:true});
 process.exitCode=1;
}
