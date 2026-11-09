"use strict";
const {spec,sign,verify,validatedFile,FILE_NAME} = require("./lib/aksara-large-upload");
const HEADER={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
  "Access-Control-Allow-Origin":"https://shaifulridhwan-penulispuisigayabebas.netlify.app",
  "Access-Control-Allow-Headers":"Content-Type, Origin",
  "Access-Control-Allow-Methods":"POST, OPTIONS"};
const buckets=new Map();
const result=(statusCode,data)=>({statusCode,headers:HEADER,body:JSON.stringify(data)});
function rateLimit(ip,size=0){
  const now=Date.now(),key=String(ip||"unknown").slice(0,100);
  let value=buckets.get(key);
  if(!value||now-value.start>900000)value={start:now,count:0,bytes:0};
  if(value.count>=8||value.bytes+size>500_000_000)return true;
  value.count++;value.bytes+=size;buckets.set(key,value);
  if(buckets.size>2000)for(const [k,v] of buckets)if(now-v.start>900000)buckets.delete(k);
  return false;
}
function apiError(response,defaultText){
  return result(response.status===429?429:502,{error:response.status===429?
    "Kuota upload Gemini sedang penuh. Cuba lagi kemudian.":defaultText,code:"GEMINI_FILE_ERROR"});
}
exports.handler=async event=>{
  const origin=event.headers?.origin||event.headers?.Origin;
  if(origin&&origin!==(process.env.ALLOWED_ORIGIN||"https://shaifulridhwan-penulispuisigayabebas.netlify.app"))
    return result(403,{error:"Origin tidak dibenarkan."});
  if(event.httpMethod==="OPTIONS")return {statusCode:204,headers:HEADER,body:""};
  if(event.httpMethod!=="POST")return result(405,{error:"POST sahaja."});
  if(Buffer.byteLength(event.body||"","utf8")>5000)return result(413,{error:"Permintaan upload tidak sah."});
  let req;
  try{req=JSON.parse(event.body||"{}")}catch{return result(400,{error:"JSON tidak sah."})}
  const key=process.env.GEMINI_API_KEY;
  if(!key)return result(503,{error:"Gemini Files API belum dikonfigurasi pada backend."});
  try{
    if(req.action==="start"){
      const file=spec(req);
      const ip=event.headers?.["x-nf-client-connection-ip"]||event.headers?.["x-forwarded-for"]||"unknown";
      if(rateLimit(ip,file.sizeBytes))return result(429,{error:"Had sesi upload sementara dicapai. Cuba lagi kemudian."});
      const res=await fetch("https://generativelanguage.googleapis.com/upload/v1beta/files",{
        method:"POST",headers:{"x-goog-api-key":key,"X-Goog-Upload-Protocol":"resumable",
          "X-Goog-Upload-Command":"start",
          "X-Goog-Upload-Header-Content-Length":String(file.sizeBytes),
          "X-Goog-Upload-Header-Content-Type":file.mimeType,"Content-Type":"application/json"},
        body:JSON.stringify({file:{display_name:file.displayName}}),
        signal:AbortSignal.timeout(15000)
      });
      if(!res.ok)return apiError(res,"Gemini tidak membenarkan sesi upload.");
      const uploadUrl=res.headers.get("x-goog-upload-url");
      let u;
      try{u=new URL(uploadUrl)}catch{return result(502,{error:"Gemini tidak memulangkan URL upload yang sah."})}
      if(u.protocol!=="https:"||u.hostname!=="generativelanguage.googleapis.com"||u.username||u.password)
        return result(502,{error:"URL upload Gemini tidak dibenarkan."});
      const ticket=sign("session",{mimeType:file.mimeType,sizeBytes:file.sizeBytes,exp:Date.now()+60*60*1000,
        nonce:require("node:crypto").randomUUID()});
      return result(200,{uploadUrl:u.toString(),ticket,maxBytes:file.sizeBytes});
    }
    if(req.action==="verify"){
      const ticket=verify(req.ticket,"session");
      if(!FILE_NAME.test(req.name||""))return result(400,{error:"Nama fail Gemini tidak sah."});
      const res=await fetch("https://generativelanguage.googleapis.com/v1beta/"+req.name,{
        headers:{"x-goog-api-key":key},signal:AbortSignal.timeout(15000)
      });
      if(!res.ok)return apiError(res,"Fail belum dapat disahkan dengan Gemini.");
      const data=await res.json();
      const info=validatedFile(data);
      if(info.sizeBytes!==ticket.sizeBytes||info.mimeType!==ticket.mimeType)
        return result(400,{error:"Metadata upload tidak sepadan dengan sesi asal."});
      if(data.state==="FAILED")return result(422,{error:"Pemprosesan fail Gemini gagal."});
      if(data.state!=="ACTIVE")return result(200,{status:"processing"});
      return result(200,{status:"ready",receipt:sign("file",{...info,exp:Date.now()+3*60*60*1000}),
        fileName:info.name,mimeType:info.mimeType,sizeBytes:info.sizeBytes});
    }
    if(req.action==="delete"){
      const file=validatedFile(verify(req.receipt,"file"));
      const res=await fetch("https://generativelanguage.googleapis.com/v1beta/"+file.name,{
        method:"DELETE",headers:{"x-goog-api-key":key},signal:AbortSignal.timeout(15000)
      });
      return res.ok?result(200,{deleted:true}):apiError(res,"Gagal memadam fail sementara.");
    }
    return result(400,{error:"Tindakan upload tidak dikenal."});
  }catch(error){
    const message=/credential|proof|expired|metadata|mime|file name|URI|size|Jenis|saiz|Maximum|Invalid|Upload/.test(error.message||"")?
      error.message:"Sesi upload tidak tersedia. Cuba semula.";
    return result(/timeout/i.test(error.name||"")?504:400,{error:message});
  }
};
