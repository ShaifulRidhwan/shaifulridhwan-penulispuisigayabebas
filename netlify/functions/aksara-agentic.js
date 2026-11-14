"use strict";
/* Android-only opt-in Agentic Core. This endpoint is not wired to the public web UI.
 * Backend must remain disabled until the owner explicitly enables it.
 * No GitHub writes, Android shell, accounts, private memory or hidden execution. */
const Controller=require("./agentic/controller");
const response=(statusCode,body,headers={})=>({
  statusCode,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
    "X-Content-Type-Options":"nosniff",...headers},body:JSON.stringify(body)
});
exports.handler=async event=>{
  if(event.httpMethod==="GET")return response(200,Controller.status());
  if(event.httpMethod!=="POST")return response(405,{error:"Kaedah tidak dibenarkan."});
  if(typeof event.body!=="string"||event.body.length>12000)return response(413,{error:"Payload misi terlalu besar."});
  try{
    const body=JSON.parse(event.body);
    return response(200,await Controller.execute(body,{headers:event.headers||{}}));
  }catch(error){
    const statusCode=Number.isInteger(error.status)?error.status:400;
    const message=statusCode===400?String(error.message||"Permintaan tidak sah.").slice(0,180):
      String(error.message||"Agent gagal.").slice(0,180);
    return response(statusCode,{error:message,category:error.category||"request"},
      error.retryAfter?{"Retry-After":String(error.retryAfter)}:{});
  }
};
