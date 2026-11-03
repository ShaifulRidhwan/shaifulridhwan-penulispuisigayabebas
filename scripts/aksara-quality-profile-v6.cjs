"use strict";
/* Local owner-only processing of manually reviewed real answers.
 * Never grades AI text automatically. Never contacts provider APIs.
 */
const fs=require("node:fs");
const Q=require("../netlify/functions/aksara-quality-evidence-v6");
function build(input,{approved=false}={}){
 const records=Array.isArray(input)?input:Array.isArray(input?.records)?input.records:[];
 return Q.compile(records,{minimum:10,approved});
}
function cli(){
 const input=process.argv.find(x=>x.startsWith("--input="))?.slice(8);
 if(!input){console.log(JSON.stringify({usage:"node scripts/aksara-quality-profile-v6.cjs --input=private-reviews.json --output=private-quality-profile.json --approve",mode:"no_network_no_automatic_grading"}));return;}
 const body=JSON.parse(fs.readFileSync(input,"utf8"));
 const result=build(body,{approved:process.argv.includes("--approve")});
 const output=process.argv.find(x=>x.startsWith("--output="))?.slice(9);
 if(output)fs.writeFileSync(output,JSON.stringify(result,null,2)+"\n",{mode:0o600});
 console.log(JSON.stringify({approved:result.approved,eligibleGroups:result.scores.length,excludedGroups:result.excluded.length,
  wrote:output||null,warning:"Approved scores must be based on manually reviewed live answers with verified evidence."}));
}
if(require.main===module)try{cli();}catch(e){console.error("Invalid local evaluation data: "+e.message);process.exitCode=1;}
module.exports={build};
