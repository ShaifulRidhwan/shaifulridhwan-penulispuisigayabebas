"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const {resolve}=require("node:path");
const config=readFileSync(resolve(__dirname,"../../netlify.toml"),"utf8");
test("all mobile server functions explicitly include the Netlify Blobs dependency",()=>{
 for(const name of ["studio-android","studio-enhance-android","bilik-antara-live-android"]){
  assert.match(config,new RegExp('\\[functions\\."'+name.replace(/-/g,"\\-")+'"\\][\\s\\S]*?external_node_modules\\s*=\\s*\\["@netlify/blobs"\\]'));
 }
});
