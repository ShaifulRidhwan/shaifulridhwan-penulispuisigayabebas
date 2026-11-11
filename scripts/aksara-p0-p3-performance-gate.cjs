"use strict";
/* P2: Compare captured Android Macrobenchmark summaries on one device.
 * No files => UNMEASURED, never "passed". Keep raw benchmark traces. */
const fs=require("node:fs");
const REQUIRED=["coldStartMsP50","frameTimeMsP95","jankPercent"];
function validate(x){
 const issues=[];
 if(!x||typeof x!=="object")return ["Missing benchmark summary"];
 if(x.source!=="androidx.benchmark.macro")issues.push("invalid source");
 if(!x.device||typeof x.device.model!=="string"||!x.device.model.trim()||
    !Number.isInteger(x.device.sdk)||x.device.sdk<31)issues.push("device model/sdk required");
 if(x.variant!=="benchmark")issues.push("benchmark variant required");
 if(!Number.isInteger(x.iterations)||x.iterations<6)issues.push("at least six iterations required");
 if(!/^[a-f0-9]{7,40}$/i.test(String(x.commit||"")))issues.push("commit SHA required");
 if(!x.capturedAt||Number.isNaN(Date.parse(x.capturedAt)))issues.push("capture time required");
 for(const field of REQUIRED)if(!Number.isFinite(x[field])||x[field]<0)issues.push("invalid "+field);
 return issues;
}
function evaluate(baseline,candidate,{tolerance=0.10}={}){
 const errors=[...validate(baseline).map(s=>"baseline: "+s),
               ...validate(candidate).map(s=>"candidate: "+s)];
 if(errors.length)return {status:"INVALID",errors};
 if(baseline.device.model!==candidate.device.model||baseline.device.sdk!==candidate.device.sdk)
   return {status:"INVALID",errors:["Different device/model/sdk"]};
 if(baseline.commit===candidate.commit)
   return {status:"INVALID",errors:["Same baseline and candidate commit"]};
 if(!Number.isFinite(tolerance)||tolerance<0||tolerance>0.5)
   return {status:"INVALID",errors:["Invalid tolerance"]};
 const checks=REQUIRED.map(metric=>{
  const previous=baseline[metric],current=candidate[metric],allowed=previous*(1+tolerance);
  return {metric,baseline:previous,candidate:current,
    allowed:Math.round(allowed*1000)/1000,pass:current<=allowed};
 });
 return {status:checks.every(x=>x.pass)?"PASS":"REGRESSION",checks,
  caveat:"Compare summary against raw device-generated benchmark artifacts"};
}
function main(argv=process.argv.slice(2)){
 const args=Object.fromEntries(argv.filter(x=>x.startsWith("--")&&x.includes("="))
  .map(x=>x.slice(2).split(/=(.*)/s).slice(0,2)));
 if(!args.baseline||!args.candidate){
  console.log(JSON.stringify({status:"UNMEASURED",
   reason:"No physical-device baseline/candidate supplied"},null,2));
  return argv.includes("--require-device")?2:0;
 }
 try{
  const result=evaluate(JSON.parse(fs.readFileSync(args.baseline,"utf8")),
   JSON.parse(fs.readFileSync(args.candidate,"utf8")));
  console.log(JSON.stringify(result,null,2));
  return result.status==="PASS"?0:1;
 }catch(err){console.error(JSON.stringify({status:"INVALID",reason:err.message}));return 1;}
}
if(require.main===module)process.exitCode=main();
module.exports={REQUIRED,validate,evaluate,main};
