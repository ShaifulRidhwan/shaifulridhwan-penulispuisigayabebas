'use strict';
const HEADERS={'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex'};
const response=(status,data,retryAfter)=>({statusCode:status,headers:{...HEADERS,...(retryAfter?{'Retry-After':String(retryAfter)}:{})},body:JSON.stringify(data)});
function input(event){
 if(event.httpMethod!=='POST')throw Object.assign(Error('Gunakan POST.'),{status:405});
 const h=event.headers||{},origin=h.origin||h.Origin,host=String(h.host||h.Host||'').toLowerCase();
 let good=false;try{const u=new URL(origin);good=u.protocol==='https:'&&u.host.toLowerCase()===host&&(!h['sec-fetch-site']||h['sec-fetch-site']==='same-origin');}catch(_){}
 if(!good)throw Object.assign(Error('Buka Studio untuk buat permintaan ini.'),{status:403});
 if(!/^application\/json(?:\s*;|$)/i.test(h['content-type']||h['Content-Type']||''))throw Object.assign(Error('Format permintaan mesti JSON.'),{status:415});
 if(event.isBase64Encoded||typeof event.body!=='string'||Buffer.byteLength(event.body)>7000)throw Object.assign(Error('Permintaan terlalu besar.'),{status:413});
 let data;try{data=JSON.parse(event.body);}catch(_){throw Object.assign(Error('Data tak sah.'),{status:400});}
 if(!data||Array.isArray(data)||typeof data!=='object')throw Object.assign(Error('Data tak sah.'),{status:400});
 return data;
}
async function readLimited(res,max){
 if(Number(res.headers.get('content-length'))>max)throw Error('Hasil terlalu besar.');
 const chunks=[];let size=0;
 for await(const chunk of res.body){size+=chunk.length;if(size>max)throw Error('Hasil terlalu besar.');chunks.push(Buffer.from(chunk));}
 return Buffer.concat(chunks);
}
function imageInfo(bytes){
 if(bytes.length<100||bytes.length>3500000)throw Error('Saiz hasil tak disokong.');
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {mime:'image/png',width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
 if(bytes[0]===255&&bytes[1]===216){
  let at=2;while(at+8<bytes.length){if(bytes[at++]!==255)continue;let marker=bytes[at++];if(marker===217||marker===218)break;if(marker===0||marker===255)continue;const len=bytes.readUInt16BE(at);if(len<2||at+len>bytes.length)break;
   if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return {mime:'image/jpeg',height:bytes.readUInt16BE(at+3),width:bytes.readUInt16BE(at+5)};at+=len;
  }
 }
 throw Error('Cloudflare tak memulangkan imej JPEG atau PNG yang sah.');
}
module.exports={response,input,readLimited,imageInfo};
