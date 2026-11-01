"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Intelligence=require("../netlify/functions/antara-intelligence");
const Safe=require("../netlify/functions/aksara-safe-tools");
const Structured=require("../netlify/functions/aksara-structured-output");

test("Google Search Grounding stays OFF even for search intent",()=>{
 const tools=Intelligence.getTools({search:true,hasLink:false,calculate:false});
 assert.equal(tools.some(x=>x.google_search||x.googleSearch),false);
});
test("URL Context enabled for link and disabled by kill switch",t=>{
 const old=process.env.ENABLE_URL_CONTEXT;
 t.after(()=>{if(old===undefined)delete process.env.ENABLE_URL_CONTEXT;else process.env.ENABLE_URL_CONTEXT=old;});
 delete process.env.ENABLE_URL_CONTEXT;
 assert.deepEqual(Intelligence.getTools({hasLink:true,calculate:false}),[{url_context:{}}]);
 process.env.ENABLE_URL_CONTEXT="false";
 assert.deepEqual(Intelligence.getTools({hasLink:true,calculate:false}),[]);
});
test("Function Calling rejects unknown tools and extra arguments",()=>{
 assert.equal(Safe.execute({name:"shell",arguments:{command:"whoami"}}).ok,false);
 assert.equal(Safe.execute({name:"calculate",arguments:{expression:"2+3",command:"x"}}).ok,false);
 assert.deepEqual(Safe.execute({name:"calculate",arguments:{expression:"(2+3)*4"}}),{ok:true,tool:"calculate",result:20});
});
test("Structured Output checks required fields and basic types",()=>{
 const schema={type:"object",required:["answer"],properties:{answer:{type:"string"},score:{type:"number"}}};
 assert.equal(Structured.validateSchema({answer:"ok",score:1},schema),true);
 assert.equal(Structured.validateSchema({score:1},schema),false);
 assert.equal(Structured.validateSchema({answer:3},schema),false);
 const rendered=Structured.render('{"answer":"ok"}',true);
 assert.equal(rendered.validJson,true);
 assert.equal(JSON.parse(rendered.reply.replace(/^```json\n|\n```$/g,"")).answer,"ok");
});
