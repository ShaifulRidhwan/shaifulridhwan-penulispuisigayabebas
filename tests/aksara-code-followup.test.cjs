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
 let filled="",submissions=0;
 const bridge={snapshot:()=>({history}),active:()=>false,addLocalCode:()=>true,fill:value=>{filled=String(value);input.value=filled;}};
 let runs=0;
 form.requestSubmit=()=>{submissions++;};
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
  action:elements.find(x=>x.id==="codeActionBar"),desc:elements.find(x=>x.id==="codeActionText"),agent:window.AksaraCodeChat,
  runs:()=>runs,filled:()=>filled,submissions:()=>submissions};
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

test("plain command runs through explicit local click",()=>{
 const ctx=setup([{role:"assistant",content:code("python","print(17)")}],"jalankan kod");
 assert.equal(ctx.action.hidden,false);
 assert.match(ctx.run.textContent,/Jalankan Kod Tadi/);
 let blocked=0;ctx.form.listeners.submit[0]({preventDefault(){blocked++},stopImmediatePropagation(){blocked++}});
 assert.equal(blocked,2);assert.equal(ctx.runs(),0);
});
test("unsupported tkinter is flagged before loading runtime",async()=>{
 const window={};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,"..","bilik-antara-code-runtime.js"),"utf8"),{window});
 const engine=window.AksaraCodeRuntime;
 const source="import tkinter as tk\nroot=tk.Tk()";
 assert.equal(engine.compatibility("python",source).ok,false);
 const output=await engine.run("python",source);
 assert.equal(output.ok,false);assert.equal(output.runtimeMs,0);
 assert.match(output.error,/Python Pyodide/);
 assert.equal(engine.compatibility("python","print(17)").ok,true);
});

test("HTML fenced replies are detected as one sandbox preview target",()=>{
 const ctx=setup([{role:"assistant",content:"Boleh cuba:\n"+code("html","<!doctype html><html><body><h1>Love You</h1></body></html>")}],"jalankan kod");
 assert.equal(ctx.action.hidden,false);
 assert.match(ctx.run.textContent,/Live Preview/);
 assert.equal(ctx.runs(),0,"HTML must never execute in the Python/JS runner");
 let blocked=0;
 ctx.form.listeners.submit[0]({preventDefault(){blocked++;},stopImmediatePropagation(){blocked++;}});
 assert.equal(blocked,2,"HTML run request must remain local");
});
test("HTML and CSS authored separately are detected without guessing",()=>{
 const ctx=setup([{role:"assistant",content:code("html","<main>Love You</main>")+"\n\n"+code("css","main{animation:pulse 1s infinite;}")}],"jalankan kod");
 assert.equal(ctx.action.hidden,false);
 assert.match(ctx.run.textContent,/Live Preview/);
});
test("HTML in current composer is sent to Live Preview, not AI",()=>{
 const ctx=setup([],code("html","<h1>Love You</h1>"));
 assert.equal(ctx.action.hidden,false);
 assert.match(ctx.run.textContent,/Live Preview/);
 let blocked=0;
 ctx.form.listeners.submit[0]({preventDefault(){blocked++;},stopImmediatePropagation(){blocked++;}});
 assert.equal(blocked,2);
});
test("multiple HTML documents are ambiguous and do not auto-select a preview",()=>{
 const ctx=setup([{role:"assistant",content:code("html","<h1>One</h1>")+"\n"+code("html","<h1>Two</h1>")}],"jalankan kod");
 assert.equal(ctx.action.hidden,true);
});
test("HTML preview bridge reuses script-disabled workspace instead of creating another runtime",()=>{
 const js=fs.readFileSync(path.join(__dirname,"..","bilik-antara-code-workspace.js"),"utf8");
 assert.match(js,/aksara:code-workspace-preview-ai/);
 assert.match(js,/extractWebCode/);
 assert.match(js,/openAIPreview/);
 assert.match(js,/safePreviewDocument/);
 assert.match(js,/script-src 'none'/);
 assert.match(js,/previewFrame\.srcdoc/);
});

test("Java source must not be misclassified as JavaScript",()=>{
 const sample="import javax.swing.JFrame;\npublic class LoveYouAnimation {\n public static void main(String[] args) {new JFrame(\"Love\");}\n}";
 const ctx=setup([],sample);
 assert.equal(ctx.agent.detect(sample).language,"java");
 assert.equal(ctx.run.textContent,"▶ Tukar ke HTML/CSS dengan A.I.");
 assert.match(ctx.desc.textContent,/Java/);
 assert.equal(ctx.runs(),0);
});
test("Gemini Java source plus 'jalankan terus' routes to user-click conversion",async()=>{
 const java="import javax.swing.*;\npublic class LoveYouAnimation { public static void main(String[] args) {new JFrame(\"Love\");}}";
 const ctx=setup([{role:"assistant",content:"Ini kod:\n"+code("java",java)}],"jalankan terus");
 assert.equal(ctx.action.hidden,false);
 assert.match(ctx.run.textContent,/HTML\/CSS/);
 let blocked=0;
 ctx.form.listeners.submit[0]({preventDefault(){blocked++;},stopImmediatePropagation(){blocked++;}});
 assert.equal(blocked,2);
 assert.equal(ctx.runs(),0);
 await ctx.run.listeners.click[0]();
 assert.equal(ctx.runs(),0,"Java code never enters JS runtime");
 assert.equal(ctx.submissions(),1);
 assert.match(ctx.filled(),/Tukarkan kod Java/);
 assert.match(ctx.filled(),/SATU blok markdown berlabel html/);
});
test("unrelated Java concept question remains ordinary chat",()=>{
 const ctx=setup([{role:"assistant",content:code("java","public class A {}")}],"apa beza Java dan JavaScript?");
 assert.equal(ctx.action.hidden,true);
});
test("active AI HTML preview does not render first old file or mix unrelated CSS",()=>{
 const js=fs.readFileSync(path.join(__dirname,"..","bilik-antara-code-workspace.js"),"utf8");
 assert.match(js,/current\?\.language==="html"\?current/);
 assert.match(js,/htmlFile\.name\.startsWith\("ai-preview-"\)/);
 assert.match(js,/cssFiles=htmlFile\.name/);
 assert.match(js,/extractJavaCode/);
 assert.match(js,/Tukar Java ke HTML\/CSS/);
});
test("AI models are told the true Code Engine capability limits",()=>{
 const source=fs.readFileSync(path.join(__dirname,"..","netlify/functions/bilik-antara.js"),"utf8");
 assert.match(source,/codeRuntimeGuidance/);
 assert.match(source,/BELUM mempunyai Java compiler/);
 assert.match(source,/Code Workspace Live Preview/);
});

test("duplicate AI HTML documents become one preview target",()=>{
 const html="<!doctype html><html><body><h1>Yaya - A Girl From Nowhere</h1></body></html>";
 const reply=code("html",html)+"\n\nPratonton:\n"+code("html",html);
 const ctx=setup([{role:"assistant",content:reply}],"jalankan kod");
 assert.equal(ctx.agent.extractWebCandidates(reply).length,1);
 assert.equal(ctx.agent.extractWebCode(reply).html,html);
 assert.match(ctx.run.textContent,/Live Preview/);
});
test("multiple distinct HTML examples are selectable but never silently executed",()=>{
 const reply=code("html","<h1>First</h1>")+"\n"+code("html","<h1>Second</h1>");
 const ctx=setup([{role:"assistant",content:reply}],"jalankan kod");
 const previews=ctx.agent.extractWebCandidates(reply);
 assert.equal(previews.length,2);
 assert.match(previews[0].html,/First/);
 assert.match(previews[1].html,/Second/);
 assert.equal(ctx.agent.extractWebCode(reply),null);
 assert.equal(ctx.action.hidden,true,"a vague Run must not choose between distinct documents");
});
test("a plain HTML document gets a safe preview target without a fence",()=>{
 const ctx=setup([],"<html><body><h1>Live</h1></body></html>");
 assert.equal(ctx.agent.extractWebCandidates("<html><body><h1>Live</h1></body></html>").length,1);
});
