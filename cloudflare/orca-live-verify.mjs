// Single Cloudflare public-chat probe: ask routing to prefer OrcaRouter.
// This cannot force the provider; verify the provider ACTUALLY returned.
// Never log prompts or generated text.
const base="https://aksara-apps.mshaifulridhwan.workers.dev";
const uri=base+"/.netlify/functions/bilik-antara";
const resp=await fetch(uri,{
 method:"POST",headers:{"Content-Type":"application/json","Origin":base},
 body:JSON.stringify({question:"Terangkan satu perbezaan mudah antara fakta dan pendapat.",thoughtMode:"cahaya",preferredProvider:"orcarouter"}),
 signal:AbortSignal.timeout(35000)
});
let body={};try{body=await resp.json()}catch(_){}
console.log("Targeted OrcaRouter preference:",JSON.stringify({
 http:resp.status,provider:body.provider||"unknown",model:body.model||"unknown",
 hasReply:typeof body.reply==="string"&&body.reply.trim().length>10,
 failures:Array.isArray(body.providerFailures)?body.providerFailures.map(x=>({provider:x.provider,status:x.status})):undefined
}));
if(resp.status!==200||typeof body.reply!=="string"||body.reply.trim().length<10){
 console.log("FAIL no usable Chat answer");process.exitCode=1;
}else if(body.provider!=="orcarouter"){
 console.log("NOTE actual provider was not OrcaRouter; prefer is not a forced test");
}else{
 console.log("PASS actual OrcaRouter inference");
}
