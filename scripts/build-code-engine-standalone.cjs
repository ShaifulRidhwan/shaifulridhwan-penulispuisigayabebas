"use strict";
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"bilik-antara-code-engine.html"),"utf8");
const js=fs.readFileSync(path.join(root,"bilik-antara-code-runtime.js"),"utf8");
const needle='<script src="bilik-antara-code-runtime.js?v=2"></script>';
assert.equal(html.split(needle).length,2,"Standalone script insertion must be unique");
const output=html.replace(needle,"<script>\n"+js+"\n</script>")
.replace(/<link rel="icon"[^>]*>\s*/,"")
.replace('<a href="bilik-antara.html">← Bilik Antara</a>','<span>AKSARA · Percubaan setempat</span>');
const dir=path.join(root,"code-engine-demo");
fs.mkdirSync(dir,{recursive:true});
const file=path.join(dir,"AKSARA-Code-Engine-v0.1.html");
fs.writeFileSync(file,output);
console.log("Standalone Code Engine demo created:",file,fs.statSync(file).size,"bytes");
