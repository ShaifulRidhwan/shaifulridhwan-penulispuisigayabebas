"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {analyzeTrivy,analyzeSemgrep,summarize}=require("../scripts/aksara-security-summary.cjs");
test("Trivy counts severities without exposing path or identifiers",()=>{
  const input={Results:[{Target:"private/secret.js",Vulnerabilities:[
    {VulnerabilityID:"CVE-2099-1000",Severity:"HIGH"},
    {VulnerabilityID:"CVE-2099-1001",Severity:"CRITICAL"}],
    Misconfigurations:[{ID:"MISCONFIG-99",Severity:"MEDIUM"}]}]};
  const output=analyzeTrivy(input);
  assert.equal(output.state,"complete");
  assert.deepEqual(output.counts,{critical:1,high:1,medium:1,low:0,total:3});
  assert.doesNotMatch(JSON.stringify(output),/private|CVE-2099|MISCONFIG/);
});
test("Semgrep status reflects partial failure rather than success",()=>{
  const full=analyzeSemgrep({results:[{extra:{severity:"ERROR"}},{extra:{severity:"WARNING"}}],errors:[]});
  assert.equal(full.counts.high,1);assert.equal(full.counts.medium,1);
  assert.equal(full.state,"complete");
  assert.equal(analyzeSemgrep({results:[],errors:[{message:"parser failure"}]}).state,"partial");
  assert.equal(analyzeSemgrep({errors:[]}).state,"error");
});
test("Public summary distinguishes scans and findings",()=>{
  const t=analyzeTrivy({Results:[{Vulnerabilities:[{Severity:"HIGH",VulnerabilityID:"CVE-2099-999"}]}]});
  const s=analyzeSemgrep({results:[],errors:[]});
  const report=summarize(t,s,{commit:"0123456789abcdef",runId:"123456789",generatedAt:"2026-11-08T00:00:00Z"});
  assert.equal(report.status,"findings_detected");
  assert.equal(report.aggregate.total,1);
  assert.equal(report.runId,"123456789");
  assert.doesNotMatch(JSON.stringify(report),/CVE-2099/);
  assert.equal(summarize({state:"missing",counts:{total:0}},s).status,"incomplete");
  assert.equal(summarize(analyzeTrivy({Results:[]}),s).status,"no_findings_in_scoped_scans");
});