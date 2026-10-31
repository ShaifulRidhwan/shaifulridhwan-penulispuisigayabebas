"use strict";

const {authorizeBearer}=require("./aksara-mobile-owner-auth");

function json(status,data){
  return Response.json(data,{
    status,
    headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}
  });
}

// A separate, owner-authenticated native adapter. The normal website Origin
// check is NOT disabled. Only this closed server-side adapter, AFTER auth,
// marks an internal request as verified mobile.
async function mobileStudio(request,context,handler){
  if(request.method!=="POST")return json(405,{error:"Gunakan POST."});
  const auth=authorizeBearer(
    request.headers.get("authorization"),
    process.env.AKSARA_MOBILE_STUDIO_TOKEN_SHA256
  );
  if(auth==="unconfigured")return json(503,{error:"Studio Android belum dikonfigurasi oleh pemilik."});
  if(auth!=="authorized")return json(401,{error:"Token akses Studio Android tidak sah."});
  const type=request.headers.get("content-type")||"";
  if(!/^application\/json(?:\s*;|$)/i.test(type))return json(415,{error:"Hanya JSON disokong."});
  if(Number(request.headers.get("content-length")||0)>7000)
    return json(413,{error:"Permintaan melebihi had Studio."});
  const bytes=await request.arrayBuffer();
  if(bytes.byteLength>7000)return json(413,{error:"Permintaan melebihi had Studio."});
  const origin=new URL(request.url);
  const event={
    httpMethod:"POST",
    body:new TextDecoder().decode(bytes),
    isBase64Encoded:false,
    __verifiedAndroid:true,
    headers:{
      "content-type":"application/json",
      host:origin.host,
      "x-nf-client-connection-ip":String(context?.ip||"unknown").slice(0,80)
    }
  };
  try{
    const response=await handler(event);
    return new Response(response.body,{
      status:response.statusCode,
      headers:{
        "Content-Type":"application/json; charset=utf-8",
        "Cache-Control":"no-store",
        "X-Content-Type-Options":"nosniff",
        ...(response.headers?.["Retry-After"]?{"Retry-After":response.headers["Retry-After"]}:{})
      }
    });
  }catch(_){
    return json(502,{error:"Sambungan Studio Android gagal."});
  }
}
module.exports={mobileStudio};
