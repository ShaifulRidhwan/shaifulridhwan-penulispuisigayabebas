"use strict";
/* Developer-only local Control Center. Not an internet-facing admin dashboard.
 * Reads no conversation data, API credentials, IP addresses or secrets. */
const Shield=require("../netlify/functions/aksara-security-shield");
const Registry=require("../netlify/functions/aksara-model-registry");
const Evaluation=require("./aksara-evaluation-lab.cjs");
function report(){
 const flags=Shield.flags();
 const evaluation=Evaluation.run();
 return {
  component:"Aksara Control Center (developer CLI)",
  scope:"local diagnostic; not live site telemetry",
  features:{chat:flags.aiEnabled,tools:flags.toolExecutionEnabled,knowledge:flags.semanticEnabled,research:flags.researchEnabled,review:flags.reviewEnabled},
  providerCapabilities:Object.keys(Registry.CAPS).map(id=>({id,reasoning:Registry.CAPS[id].reasoning})),
  evaluation:{total:evaluation.total,passed:evaluation.passed,failed:evaluation.failed,passRate:evaluation.passRate},
  note:"Production status needs authenticated telemetry; free-tier process memory is not a distributed dashboard."
 };
}
if(require.main===module)process.stdout.write(JSON.stringify(report(),null,2)+"\n");
module.exports={report};
