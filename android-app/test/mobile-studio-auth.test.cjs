"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {createHash}=require("node:crypto");
const {authorizeBearer}=require("../../netlify/functions/lib/aksara-mobile-owner-auth");
const {input}=require("../../netlify/functions/lib/studio-http");

const token="A".repeat(48)+"aB12_-";
const hash=createHash("sha256").update(token).digest("hex");

test("mobile owner authorization uses a SHA-256 secret, no hard-coded token",()=>{
 assert.equal(authorizeBearer("Bearer "+token,hash),"authorized");
 assert.equal(authorizeBearer("Bearer "+token+"a",hash),"unauthorized");
 assert.equal(authorizeBearer("Bearer short",hash),"unauthorized");
 assert.equal(authorizeBearer("Bearer "+token,""),"unconfigured");
});
test("web Studio Origin protection stays intact",()=>{
 assert.throws(
  ()=>input({httpMethod:"POST",headers:{"content-type":"application/json"},body:"{}"}),
  /Buka Studio/
 );
});
test("server-verified mobile requests are accepted only with internal marker",()=>{
 const event={
  httpMethod:"POST",isBase64Encoded:false,
  headers:{"content-type":"application/json"},
  body:JSON.stringify({prompt:"Cahaya di dalam bilik"}),
  __verifiedAndroid:true
 };
 assert.equal(input(event).prompt,"Cahaya di dalam bilik");
});
