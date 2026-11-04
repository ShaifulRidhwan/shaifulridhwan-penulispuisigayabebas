"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"..","bilik-antara-code-chat.js"),"utf8");
function setup(history,text){
 const elements=[];
 const element=()=>({
  hidden:false,disabled:false,value:"",textContent:"",id:"",
  listeners:{},append(){},before(){},
  addEventListener(type,cb){(this.listeners[type]??=[]).push(cb);}
 });
 const form=element(),input=element();
 const bridge={snapshot:()=>({history}),active:()=>false,addLocalCode:()=>true};
 let runs=0;
 const window={
  AksaraCodeRuntime:{available:["python","javascript","typescript","sql","cpp"],run:()=>{runs++;return Promise.resolve({ok:true,output:""});}},
  BilikAntaraBridge:bridge,
  addEventListener(){}
 };
 const doc={
  getElementById:id=>id==="composer"?form:id==="input"?input:id==="removeAttachment"?{hidden:true}:null,
  querySelector:()=>({}),
  createElement:()=>{const e=element();elements.push(e);return e;},
  head:{appendChild(){}}
 };
 vm.runInNewContext(source,{window,document:doc,AbortController,performance:{now:()=>0},CustomEvent:class {},Event:class {},setTimeout,clearTimeout});
 input.value=text;
 for(const listener of input.listeners.input||[])listener();
 return {form,input,run:elements.find(x=>x.id==="codeRunAction"),
  action:elements.find(x=>x.id==="codeActionBar"),runs:()=>runs};
}
const code=(language,text)=>"\x60\x60\x60"+language+"\n"+text+"\n\x60\x60\x60";
test("follow-up refers to earlier Python answer and offers local Run action",()=>{
 const ctx=setup([
  {role:"assistant",content:"Skrip:\n"+code("python","print(17)")},
  {role:"user",content:"kau boleh jalankan kod tu"},
  {role:"assistant",content:"Maaf, aku tak boleh execute code kat sini."}
 ],"kau boleh jalankan kod tu");
 assert.equal(ctx.action.hidden,false);
 assert.match(ctx.run.textContent,/Jalankan Kod Tadi/);
 assert.equal(ctx.runs(),0,"no automatic execution on detection");
 let blocked=0;
 ctx.form.listeners.submit[0]({preventDefault(){blocked++;},stopImmediatePropagation(){blocked++;}});
 assert.equal(blocked,2,"request must be handled locally, not forwarded to AI");
 assert.equal(ctx.runs(),0,"submit only reveals explicit Run action");
});
test("no previous AI code means ordinary chat remains untouched",()=>{
 const ctx=setup([{role:"assistant",content:"Tiada skrip."}],"kau boleh jalankan kod tu");
 assert.equal(ctx.action.hidden,true);
 let blocked=0;
 ctx.form.listeners.submit[0]({preventDefault(){blocked++;},stopImmediatePropagation(){blocked++;}});
 assert.equal(blocked,0);
});
test("multiple code blocks are ambiguous and must not be silently chosen",()=>{
 const ctx=setup([{role:"assistant",content:code("python","print(1)")+"\n"+code("python","print(2)")}],"uji kod tadi");
 assert.equal(ctx.action.hidden,true);
});
test("unrelated Python questions should not trigger execution",()=>{
 const ctx=setup([{role:"assistant",content:code("python","print(17)")}],"apa itu python?");
 assert.equal(ctx.action.hidden,true);
});
test("ordinary current Python source still shows existing manual Run action",()=>{
 const ctx=setup([],"print('hello')");
 assert.equal(ctx.action.hidden,false);
 assert.equal(ctx.run.textContent,"▶ Jalankan Kod");
});
