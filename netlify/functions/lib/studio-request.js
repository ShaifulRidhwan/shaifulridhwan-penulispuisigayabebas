'use strict';
const {readLimited,response}=require('./studio-http');
module.exports=async function adapt(request,context,handler){
 const headers=Object.fromEntries(request.headers);headers.host=new URL(request.url).host;
 if(context?.ip)headers['x-nf-client-connection-ip']=context.ip;
 let body='';
 if(request.method==='POST'){
  try{body=(await readLimited(request,7000)).toString();}catch(_){const out=response(413,{error:'Permintaan terlalu besar.'});return new Response(out.body,{status:out.statusCode,headers:out.headers});}
 }
 const out=await handler({httpMethod:request.method,headers,body});
 return new Response(out.body,{status:out.statusCode,headers:out.headers});
};
