"use strict";
/* Maintainer CLI only, never served by Netlify public handlers. The 1-5 rating
 * comes from a human evaluator reviewing a real response. No user submissions. */
const Global=require("../netlify/functions/aksara-global-performance");
async function main(argv=process.argv.slice(2)){
 const [command,provider,task,score]=argv;
 if(command==="init"){
  await Global.init({timeout:7000});console.log("Aksara shared D1 quality table ready");return;
 }
 if(command==="status"){
  const rows=await Global.snapshot({timeout:7000});
  console.log(JSON.stringify(rows.map(x=>({provider:x.provider,task:x.task,
   success:x.success,failure:x.failure,qualitySamples:x.qualityCount,
   humanQualityMean:x.qualityCount?+(x.qualityTotal/x.qualityCount).toFixed(2):null,
   avgLatencyMs:x.success+x.failure?Math.round(x.latencyTotalMs/(x.success+x.failure)):null})),null,2));return;
 }
 if(command==="rate"){
  if(!Global.PROVIDERS.has(provider)||!Global.TASKS.has(task)||!Number.isInteger(Number(score))||
   Number(score)<1||Number(score)>5)throw Error("Usage: rate groq|openrouter|requesty TASK 1..5");
  if(process.env.AKSARA_EVALUATOR_CONFIRMED!=="HUMAN_REVIEWED")throw Error("Set AKSARA_EVALUATOR_CONFIRMED=HUMAN_REVIEWED after personally evaluating the model response");
  await Global.rateByDeveloper(provider,task,Number(score),{timeout:7000});
  console.log("Recorded one developer-reviewed quality rating without storing prompt or reply");return;
 }
 throw Error("Usage: node scripts/aksara-rating-cli.cjs init|status|rate PROVIDER TASK RATING");
}
if(require.main===module)main().catch(e=>{console.error(String(e.message||e));process.exitCode=1;});
module.exports={main};
