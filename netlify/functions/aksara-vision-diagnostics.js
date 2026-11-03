"use strict";
/* Vision assessment never mistakes a received reply for visual accuracy. */
const IMAGE_TYPES=new Set(["image/jpeg","image/png","image/webp"]);
function inspect({media=[],provider="",reply="",consent=false,failed=false}={}){
 const images=(Array.isArray(media)?media:[]).filter(m=>IMAGE_TYPES.has(m?.mimeType));
 if(!images.length)return Object.freeze({status:"not_requested",imageCount:0});
 const supported=["gemini","openrouter"].includes(provider);
 const returned=supported&&typeof reply==="string"&&!!reply.trim()&&!failed;
 const status=returned?"model_replied_accuracy_unverified":
  !consent&&provider!=="gemini"?"consent_required":
  failed?"vision_failed":"not_verified";
 return Object.freeze({status,imageCount:images.length,provider:supported?provider:"unconfirmed",
  actualImageUnderstandingConfirmed:false,uploadRequiresExplicitSend:true});
}
module.exports={inspect,IMAGE_TYPES};
