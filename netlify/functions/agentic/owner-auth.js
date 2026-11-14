"use strict";
// Owner-only preview: a strong per-owner bearer secret, configured in Netlify
// Functions environment. Never ship owner credentials in the APK or repository.
const crypto=require("node:crypto");
const ERR=(status,message,category="authorization")=>Object.assign(new Error(message),{status,category});
function configured(env=process.env){
  const key=env.AKSARA_AGENT_OWNER_KEY;
  return typeof key==="string" && key.length>=40 && key.length<=256 &&
    /^[A-Za-z0-9_-]+$/.test(key) && !/^(.)\1{39,}$/.test(key);
}
function authenticate(headers={},env=process.env){
  if(!configured(env))throw ERR(503,"Pengesahan pemilik Agentic belum dikonfigurasi.","configuration");
  const raw=String(headers.authorization||headers.Authorization||"");
  const match=/^Bearer ([A-Za-z0-9_-]{40,256})$/.exec(raw);
  if(!match)throw ERR(401,"Kunci akses pemilik diperlukan.");
  // Hash before constant-time comparison, avoiding token length side channels.
  const actual=crypto.createHash("sha256").update(match[1],"utf8").digest();
  const expected=crypto.createHash("sha256").update(env.AKSARA_AGENT_OWNER_KEY,"utf8").digest();
  if(!crypto.timingSafeEqual(actual,expected))throw ERR(401,"Kunci akses pemilik tidak sah.");
  return crypto.createHash("sha256").update("aksara-agent-owner:"+match[1]).digest("hex").slice(0,24);
}
module.exports={configured,authenticate};
