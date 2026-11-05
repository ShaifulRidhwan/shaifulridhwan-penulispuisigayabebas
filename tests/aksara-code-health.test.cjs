"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const Status=require("../bilik-antara-code-health.js");
const read=name=>fs.readFileSync(name,"utf8");
test("Code Engine health v2 exposes six capabilities but counts only five executable runtimes",()=>{
 let now=1000000;const m=Status.create(()=>now);
 assert.deepEqual(Status.LANGUAGES,["html","javascript","python","typescript","sql","cpp"]);
 assert.equal(m.snapshot().overall,"unverified");
 assert.equal(m.snapshot().verified,0);
 assert.equal(m.snapshot().rows.find(r=>r.language==="html").status,"available");
 for(const lang of ["python","typescript","sql","cpp"])
  assert.equal(m.snapshot().rows.find(r=>r.language===lang).status,"not-tested");
 m.previewVerified();
 assert.equal(m.snapshot().verified,0,"HTML Preview never counts as a compiler");
 assert.equal(m.snapshot().rows.find(r=>r.language==="html").status,"verified");
});
test("Only a successful real runtime action verifies a language and its proof expires",()=>{
 let now=1000000;const m=Status.create(()=>now);
 m.beginProbe();
 assert.equal(m.snapshot().overall,"checking");
 m.probe(true,{latencyMs:45});
 assert.equal(m.snapshot().overall,"ready");
 assert.equal(m.snapshot().verified,1);
 assert.equal(m.snapshot().rows.find(r=>r.language==="javascript").source,"self-test");
 m.activity({language:"python",phase:"started"});
 assert.equal(m.snapshot().activity.state,"executing");
 assert.equal(m.snapshot().rows.find(r=>r.language==="python").status,"not-tested");
 m.activity({language:"python",phase:"loading"});
 assert.equal(m.snapshot().activity.state,"loading");
 m.activity({language:"python",phase:"completed",ok:true,runtimeMs:105});
 assert.equal(m.snapshot().verified,2);
 assert.equal(m.snapshot().rows.find(r=>r.language==="python").source,"successful-run");
 now+=300001;
 assert.equal(m.snapshot().verified,0);
 assert.equal(m.snapshot().rows.find(r=>r.language==="python").status,"unverified");
 assert.equal(m.snapshot().overall,"unverified");
});
test("User syntax failures, timeout and cancelled execution do NOT make runtime Offline",()=>{
 const m=Status.create(()=>1000000);
 m.probe(true);
 m.activity({language:"typescript",phase:"started"});
 m.activity({language:"typescript",phase:"completed",ok:false});
 assert.equal(m.snapshot().activity.message,"Execution Failed");
 assert.equal(m.snapshot().rows.find(r=>r.language==="typescript").status,"not-tested");
 assert.equal(m.snapshot().overall,"ready");
 m.activity({language:"cpp",phase:"timeout"});
 assert.equal(m.snapshot().activity.message,"Execution Timed Out");
 assert.notEqual(m.snapshot().rows.find(r=>r.language==="cpp").status,"unavailable");
 m.activity({language:"cpp",phase:"cancelled"});
 assert.equal(m.snapshot().activity.message,"Execution Cancelled");
});
test("AI permission is independent and cannot imply compiler readiness or run arbitrary code",()=>{
 const m=Status.create(()=>1000000);
 m.setPermission(true,false);
 assert.equal(m.snapshot().permission,"armed");
 assert.equal(m.snapshot().overall,"unverified");
 m.setPermission(true,true);
 assert.equal(m.snapshot().permission,"running");
 assert.equal(m.snapshot().overall,"unverified");
 m.setPermission(false,false);
 assert.equal(m.snapshot().permission,"off");
 m.probe(false,{error:"JS self-test failed"});
 assert.equal(m.snapshot().overall,"degraded","JS failure cannot condemn untested Python, C++ or SQL");
 assert.equal(m.snapshot().verified,0);
});
test("Status v2 uses English and keeps Core Engine, Voice, AI routing and sandbox untouched",()=>{
 const status=read("bilik-antara-code-status.js"),runtime=read("bilik-antara-code-runtime.js"),html=read("bilik-antara.html");
 assert.doesNotThrow(()=>new vm.Script(status));
 assert.doesNotThrow(()=>new vm.Script(runtime));
 assert.ok(html.includes("bilik-antara-code-health.js?v=2"));
 assert.ok(html.includes("bilik-antara-code-status.js?v=22"));
 assert.ok(html.includes("bilik-antara-code-runtime.js?v=8"));
 assert.ok(Buffer.byteLength(html,"utf8")<100000,"Bilik Antara primary HTML budget");
 assert.ok(status.includes("Code Engine · Runtime Health"));
 assert.ok(status.includes("Execution Activity"));
 assert.ok(status.includes("Refresh Status"));
 assert.ok(status.includes("Not Tested · On Demand"));
 assert.ok(status.includes("AI Execution: "));
 assert.ok(!status.includes("Semak semula"));
 assert.ok(status.includes('window.addEventListener("aksara:code-runtime-activity"'));
 assert.ok(runtime.includes("aksara:code-runtime-activity"));
 assert.ok(runtime.includes('frame.setAttribute("sandbox","allow-scripts")'));
 assert.ok(runtime.includes("worker.terminate()"));
 assert.ok(runtime.includes("options.signal"));
 assert.ok(runtime.includes("const LANGUAGES=Object.freeze([\"javascript\",\"python\",\"typescript\",\"sql\",\"cpp\"]);"));
 assert.ok(read("bilik-antara-code-workspace.js").includes("aksara:code-preview-ready"));
});


test("Runtime refresh has a single label and never invokes a native white browser prompt",()=>{
 const status=read("bilik-antara-code-status.js");
 const html=read("bilik-antara.html");
 assert.ok(status.includes('id="codeEngineRefresh">Refresh Status</button>'));
 assert.ok(status.includes("code-refresh-data-note"));
 assert.ok(status.includes('engine.probeLanguage(language,{signal:controller.signal})'));
 assert.ok(!status.includes("Refresh Status · Uji Runtime"));
 assert.ok(!status.includes("window.confirm("));
 assert.ok(html.includes("bilik-antara-code-status.js?v=22"));
});
