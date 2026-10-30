"use strict";
/* Internal only. Per-instance counters: not a cloud-wide monitoring dashboard. */
const count={request:0,success:0,error:0,fallback:0,tool:0,latencyTotal:0};
function record(name,latency=0){
 if(!Object.hasOwn(count,name))return;
 count[name]++;
 if(name==="success"&&Number.isFinite(latency))count.latencyTotal+=Math.min(30000,Math.max(0,latency));
}
function snapshot(){
 return {...count,meanMs:count.success?Math.round(count.latencyTotal/count.success):0,scope:"one-warm-instance"};
}
module.exports={record,snapshot};
