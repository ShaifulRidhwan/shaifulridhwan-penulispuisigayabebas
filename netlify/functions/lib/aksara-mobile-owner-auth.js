"use strict";

const {createHash,timingSafeEqual}=require("node:crypto");

// Owner-only Android QA. Never embed this token in a public APK.
// Configure the SHA-256 of a high-entropy (>= 32 character) random token in
// AKSARA_MOBILE_STUDIO_TOKEN_SHA256 on Netlify.
function authorizeBearer(value, expectedHash){
  if(typeof expectedHash!=="string"||!/^[a-f0-9]{64}$/i.test(expectedHash))return "unconfigured";
  const auth=typeof value==="string"?value:"";
  const token=/^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(auth)?.[1];
  if(!token)return "unauthorized";
  const expected=Buffer.from(expectedHash.toLowerCase(),"hex");
  const actual=createHash("sha256").update(token,"utf8").digest();
  return timingSafeEqual(expected,actual)?"authorized":"unauthorized";
}

module.exports={authorizeBearer};
