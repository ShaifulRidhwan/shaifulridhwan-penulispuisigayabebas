// NVIDIA hosted trial catalog. A listed model is NOT automatically a free
// production entitlement or a successful chat inference.
// Keep the list dynamic; reject embedding, rerank, translation, image/audio,
// safety classifiers and specialized model families that don't accept OpenAI chat.
const ID=/^[a-z0-9._-]{2,45}\/[a-z0-9._-]{3,115}$/i;
const CHAT=/(?:deepseek|nemotron|mistral|llama|glm|qwen|step[-_.]?[345]|minimax|kimi|gpt[-_.]?oss|gemma|phi[-_.]?[34]|command[-_.]?r|muse[-_.]?glimmer)/i;
const NON_CHAT=/(?:embedding|embed[-_.]|rerank|parse|asr|speech|translate|tts|voice|safety|moderation|guard|classif|image|diffusion|flux|recraft|video|protein|molecule|bio[-_.]|calibration|calibrat|kumo|tabular|forecast|segmentation|occlusion|transcribe|super[-_.]?resolution)/i;
// These exact ids were advertised as Free Endpoint on NVIDIA Build's catalog.
// The label indicates development trial access, never unrestricted production.
const OFFICIAL_TRIAL=new Set([
 "deepseek-ai/deepseek-v4.1-flash",
 "nvidia/nemotron-3.5-lightning-30b-a3b",
 "nvidia/nemotron-3.5-bolt-e4b",
 "nvidia/nemotron-3.5-super-vl-120b-a12b",
 "z-ai/glm-5-3-flash"
]);
export const isChatId=id=>typeof id==="string"&&ID.test(id)&&CHAT.test(id)&&!NON_CHAT.test(id);
export function chatCatalog(data,max=100){
 const incoming=Array.isArray(data?.data)?data.data:[];
 const seen=new Set(),out=[];
 for(const item of incoming){
  const id=String(item?.id||"");
  if(!isChatId(id)||seen.has(id))continue;
  seen.add(id);
  out.push({id,name:id.split("/")[1].replace(/[-_.]/g," "),
    status:"listed",trialEndpointLabel:OFFICIAL_TRIAL.has(id)});
  if(out.length>=max)break;
 }
 return out.sort((a,b)=>Number(b.trialEndpointLabel)-Number(a.trialEndpointLabel)||a.id.localeCompare(b.id));
}
export async function fetchChatCatalog(apiKey,fetcher=fetch,timeout=8000){
 const resp=await fetcher("https://integrate.api.nvidia.com/v1/models",{
  method:"GET",headers:{"Authorization":"Bearer "+apiKey,"Accept":"application/json"},
  signal:AbortSignal.timeout(timeout)});
 if(!resp.ok)return {ok:false,status:resp.status,models:[]};
 const data=await resp.json().catch(()=>({}));
 return {ok:true,status:resp.status,models:chatCatalog(data)};
}
