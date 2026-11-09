"use strict";
const crypto = require("node:crypto");

const LIMITS = Object.freeze({
  image: 25_000_000, pdf: 100_000_000, audio: 100_000_000, video: 250_000_000
});
const MIME = Object.freeze({
  "image/jpeg":"image", "image/png":"image", "image/webp":"image",
  "image/gif":"image", "image/heic":"image", "image/heif":"image",
  "application/pdf":"pdf",
  "audio/mpeg":"audio", "audio/mp3":"audio", "audio/wav":"audio",
  "audio/ogg":"audio", "audio/webm":"audio", "audio/mp4":"audio",
  "audio/aac":"audio", "audio/flac":"audio", "audio/x-wav":"audio",
  "video/mp4":"video", "video/webm":"video", "video/quicktime":"video"
});
const FILE_NAME=/^files\/[A-Za-z0-9_-]{8,180}$/;
function signatureKey(env=process.env){
  // Prefer separate secret. Domain-separated key derivation preserves compatibility
  // with existing Netlify secrets until a dedicated signing secret is configured.
  const raw=env.AKSARA_UPLOAD_SIGNING_SECRET||env.GEMINI_API_KEY;
  if(!raw||raw.length<12)throw Error("Upload credential unavailable");
  return crypto.createHmac("sha256",raw).update("aksara-large-upload/receipt/v1").digest();
}
function sign(kind,data,env=process.env){
  const payload=Buffer.from(JSON.stringify({v:1,kind,...data})).toString("base64url");
  const digest=crypto.createHmac("sha256",signatureKey(env)).update(payload).digest("base64url");
  return payload+"."+digest;
}
function verify(token,kind,env=process.env){
  if(typeof token!=="string"||token.length>2200||!token.includes("."))throw Error("Invalid upload proof");
  const [payload,digest,...extra]=token.split(".");
  if(extra.length||!payload||!digest)throw Error("Invalid upload proof");
  const expected=crypto.createHmac("sha256",signatureKey(env)).update(payload).digest();
  let actual;
  try{actual=Buffer.from(digest,"base64url")}catch{throw Error("Invalid upload proof")}
  if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))throw Error("Invalid upload proof");
  let parsed;
  try{parsed=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"))}catch{throw Error("Invalid upload proof")}
  if(parsed.v!==1||parsed.kind!==kind||!Number.isSafeInteger(parsed.exp)||parsed.exp<Date.now())throw Error("Upload proof expired or invalid");
  return parsed;
}
function validatedFile(file){
  if(!file||typeof file!=="object"||!FILE_NAME.test(file.name||""))throw Error("Invalid Gemini file name");
  const url=new URL(String(file.uri||file.fileUri||""));
  if(url.protocol!=="https:"||url.hostname!=="generativelanguage.googleapis.com"||
     url.username||url.password||url.hash||url.search||
     url.pathname!=="/v1beta/"+file.name)throw Error("Invalid Gemini file URI");
  const kind=MIME[file.mimeType];
  if(!kind||!Number.isSafeInteger(Number(file.sizeBytes))||Number(file.sizeBytes)<1||
    Number(file.sizeBytes)>LIMITS[kind])throw Error("Invalid Gemini file metadata");
  return {name:file.name,fileUri:url.toString(),mimeType:file.mimeType,sizeBytes:Number(file.sizeBytes)};
}
function parseReceipts(value,env=process.env){
  if(value==null)return [];
  if(!Array.isArray(value)||value.length>4)throw Error("Maximum four upload receipts");
  return value.map(token=>{
    const value=verify(token,"file",env);
    return validatedFile(value);
  });
}
function spec({mimeType,sizeBytes,name}){
  const mime=String(mimeType||"").toLowerCase().trim();
  const kind=MIME[mime];
  const bytes=Number(sizeBytes);
  if(!kind||!Number.isSafeInteger(bytes)||bytes<=0||bytes>LIMITS[kind])
    throw Error("Jenis atau saiz fail tidak disokong.");
  const displayName=String(name||"lampiran").replace(/[\x00-\x1f\x7f<>]/g,"").slice(0,100)||"lampiran";
  return {mimeType:mime,sizeBytes:bytes,displayName,kind};
}
module.exports={MIME,LIMITS,spec,sign,verify,validatedFile,parseReceipts,FILE_NAME};
