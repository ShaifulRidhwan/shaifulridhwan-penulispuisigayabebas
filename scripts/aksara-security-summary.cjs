"use strict";
/* Sanitize Trivy + Semgrep CI results for a public high-level dashboard.
 * Never publish matched code, file paths, CVE IDs, rule IDs or secret values. */
const fs=require("node:fs");
const path=require("node:path");
const LEVELS=["critical","high","medium","low"];
function empty(){return {critical:0,high:0,medium:0,low:0,total:0};}
function tally(counts,raw){
  const key=String(raw||"").toUpperCase();
  const type=key==="CRITICAL"?"critical":key==="HIGH"||key==="ERROR"?"high":key==="MEDIUM"||key==="WARNING"?"medium":"low";
  counts[type]++;counts.total++;
}
function analyzeTrivy(input){
  const counts=empty();
  if(!input||!Array.isArray(input.Results))return {state:"error",counts};
  for(const result of input.Results){
    for(const entry of [...(result.Vulnerabilities||[]),...(result.Misconfigurations||[])]){
      tally(counts,entry.Severity);
    }
  }
  return {state:"complete",counts};
}
function analyzeSemgrep(input){
  const counts=empty();
  if(!input||!Array.isArray(input.results))return {state:"error",counts};
  for(const entry of input.results)tally(counts,entry?.extra?.severity);
  return {state:Array.isArray(input.errors)&&input.errors.length?"partial":"complete",counts};
}
function load(filename,analyzer){
  if(!fs.existsSync(filename))return {state:"missing",counts:empty()};
  try{return analyzer(JSON.parse(fs.readFileSync(filename,"utf8")))}
  catch(_){return {state:"error",counts:empty()};}
}
function summarize(trivy,semgrep,meta={}){
  const total=empty();
  for(const item of [trivy,semgrep])for(const key of [...LEVELS,"total"])total[key]+=item.counts[key]||0;
  const complete=[trivy,semgrep].every(x=>x.state==="complete");
  return {
    schemaVersion:1,
    source:"github-actions",
    generatedAt:meta.generatedAt||new Date().toISOString(),
    commit:String(meta.commit||"").slice(0,40),
    runId:String(meta.runId||"").replace(/[^0-9]/g,"").slice(0,20),
    scanners:{trivy,semgrep},
    aggregate:total,
    status:!complete?"incomplete":total.total?"findings_detected":"no_findings_in_scoped_scans",
    note:"Workflow berjaya tidak membuktikan aplikasi selamat. Ringkasan awam tidak mendedahkan butiran penemuan; laporan penuh kekal dalam artifact CI."
  };
}
if(require.main===module){
  const location=process.cwd();
  const output=summarize(
    load(path.join(location,"trivy-report.json"),analyzeTrivy),
    load(path.join(location,"semgrep-report.json"),analyzeSemgrep),
    {commit:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID}
  );
  fs.writeFileSync(path.join(location,"security-ci-summary.json"),JSON.stringify(output,null,2)+"\n");
  console.log("Security summary state:",output.status,"total:",output.aggregate.total);
}
module.exports={analyzeTrivy,analyzeSemgrep,summarize,load};