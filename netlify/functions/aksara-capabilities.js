"use strict";
/* Central tool/capability policy. Never mistake a configured tool for a tool used.
 * No paid web-search activation without a distinct owner opt-in. */
const Tavily=require("./aksara-tavily");
const yes=(env,key,defaultOn=false)=>defaultOn?env[key]!=="false":env[key]==="true";
function safePublicUrl(question){
  const url=Tavily.extractUrl(String(question||""));
  return url||null;
}
function webEligible({question="",hasLink=false,search=false,sensitive=false,privateContext=false,attachment=false,account=false}={}){
  if(sensitive||privateContext||attachment||account)return false;
  if(hasLink)return !!safePublicUrl(question);
  return !!search&&String(question).length>=4&&String(question).length<=1800;
}
function offered(provider,{question="",hasLink=false,search=false,calculate=false,sensitive=false,privateContext=false,attachment=false,account=false}={},env=process.env){
  const allowed=webEligible({question,hasLink,search,sensitive,privateContext,attachment,account});
  const tools=[];
  if(provider==="groq"){
    if(allowed&&yes(env,"AKSARA_GROQ_BROWSER_ENABLED",true))tools.push({type:"browser_search"});
    if(calculate&&!sensitive&&!privateContext&&!attachment&&yes(env,"AKSARA_GROQ_CODE_ENABLED",true))tools.push({type:"code_interpreter"});
  }
  if(provider==="openrouter"){
    // Explicit OpenRouter HTTP engine, documented free; never silently select Exa/native.
    if(allowed&&hasLink&&yes(env,"AKSARA_OPENROUTER_FETCH_ENABLED",true))
      tools.push({type:"openrouter:web_fetch",parameters:{engine:"openrouter",max_content_tokens:3500}});
    // Exa is billed per search, even when the selected model is :free.
    if(allowed&&search&&yes(env,"AKSARA_OPENROUTER_PAID_SEARCH_ENABLED"))
      tools.push({type:"openrouter:web_search",parameters:{engine:"exa"}});
  }
  return tools;
}
const FUNCTION_NAME="knowledge_search";
const KNOWLEDGE_DECLARATION={name:FUNCTION_NAME,description:"Cari petikan sebenar daripada indeks karya awam AKSARA apabila pengguna meminta penemuan atau perbandingan karya.",parameters:{type:"OBJECT",properties:{query:{type:"STRING",description:"Topik atau judul karya yang diminta."}},required:["query"]}};
function geminiFunctions({question="",hasLink=false,sensitive=false,attachment=false,works=false}={},env=process.env){
  if(!yes(env,"AKSARA_GEMINI_FUNCTIONS_ENABLED",true)||!works||hasLink||sensitive||attachment)return [];
  if(!/(?:cari|carikan|temukan|jumpa|petikan|banding|senarai).{0,80}(?:puisi|sajak|karya|trilogi|tetralogi)|(?:puisi|sajak|karya).{0,40}(?:cari|petikan|banding)/i.test(question))return [];
  return [{functionDeclarations:[KNOWLEDGE_DECLARATION]}];
}
function executed(provider,data){
  const result=[];
  const message=data?.choices?.[0]?.message||{};
  if(provider==="groq"&&Array.isArray(message.executed_tools)){
    for(const t of message.executed_tools){
      const name=String(t?.name||t?.type||"").toLowerCase();
      if(/browser|search/.test(name)&&!result.includes("browser_search"))result.push("browser_search");
      if(/python|code/.test(name)&&!result.includes("code_interpreter"))result.push("code_interpreter");
    }
  }
  // OpenRouter's tool invocation metadata varies by router/model; no "used"
  // claim from merely providing a tool declaration.
  return result;
}
function manifest(env=process.env){
  return {
    gemini:{urlContext:env.ENABLE_URL_CONTEXT!=="false"&&env.AKSARA_DISABLE_TOOLS!=="true",
      codeExecution:env.ENABLE_CODE_EXECUTION!=="false"&&env.AKSARA_DISABLE_TOOLS!=="true",
      structuredOutput:true,functionCalling:yes(env,"AKSARA_GEMINI_FUNCTIONS_ENABLED",true),
      googleSearchGrounding:yes(env,"AKSARA_GOOGLE_SEARCH_GROUNDING",true)&&env.AKSARA_DISABLE_TOOLS!=="true",
      googleSearchModel:"gemini-2.5-flash-lite",multiUrlContext:true,inlinePdf:true},
    groq:{browserSearch:yes(env,"AKSARA_GROQ_BROWSER_ENABLED",true),codeInterpreter:yes(env,"AKSARA_GROQ_CODE_ENABLED",true)},
    openrouter:{webFetchFree:yes(env,"AKSARA_OPENROUTER_FETCH_ENABLED",true),
      webSearchPaid:yes(env,"AKSARA_OPENROUTER_PAID_SEARCH_ENABLED")},
    workers_ai:{ownedPageEvidence:true,arbitraryWebFetch:false,webSearch:false,
      publicRerankReady:env.AKSARA_WORKERS_RERANK_ENABLED==="true",
      gatewayOptIn:env.AKSARA_WORKERS_GATEWAY_ENABLED==="true"}
  };
}
function normalizedUrl(value){
 try{
  const u=new URL(String(value||""));
  if(u.protocol!=="https:"||u.username||u.password)return "";
  const path=u.pathname.endsWith("/")?u.pathname.slice(0,-1):u.pathname;
  return u.origin+path+(u.search||"");
 }catch(_){return "";}
}
function urlTrace(data,offeredTools=[],targetUrl=null){
 const entries=(data?.candidates?.[0]?.urlContextMetadata?.urlMetadata||data?.urlContextMetadata?.urlMetadata||[]);
 const all=Array.isArray(entries)?entries.slice(0,8):[];
 const target=targetUrl?normalizedUrl(targetUrl):"";
 // Success for some other retrieved URL is not proof that the user's URL was read.
 const scoped=target?all.filter(x=>normalizedUrl(x?.retrievedUrl)===target):all;
 const statuses=scoped.map(x=>String(x?.urlRetrievalStatus||"UNKNOWN").slice(0,70));
 const succeeded=statuses.includes("URL_RETRIEVAL_STATUS_SUCCESS");
 return {offered:offeredTools.some(x=>!!x.url_context),
  status:succeeded?"success":statuses.length?"failed":all.length&&target?"target_not_reported":"not_reported",
  retrievalStatuses:statuses,targetMatched:!!target&&scoped.length>0};
}
module.exports={safePublicUrl,webEligible,offered,executed,manifest,geminiFunctions,urlTrace,FUNCTION_NAME};
