"use strict";
/* Structured Tool Calling v1. Deny by default. No eval, Function, VM, shell,
 * filesystem/network access, dynamic code execution or arbitrary URL fetch. */
const Knowledge=require("./aksara-knowledge-engine");
const SCHEMA=Object.freeze({
 calculate:Object.freeze({name:"calculate",required:["expression"],maxExpression:120}),
 knowledge_search:Object.freeze({name:"knowledge_search",required:["query"],maxQuery:300})
});
function calculate(expression){
 const input=String(expression||"").replace(/,/g,".").replace(/\s+/g,"");
 if(input.length>120||!/^[0-9.+\-*/^()%]+$/.test(input)||!/[0-9]/.test(input))throw Error("Ungkapan matematik tidak sah.");
 let i=0,steps=0;
 function at(){if(++steps>500)throw Error("Ungkapan terlalu kompleks.");return input[i];}
 function primary(depth){
  if(depth>14)throw Error("Kurungan terlalu bersarang.");
  if(at()==="+"){i++;return primary(depth+1);}
  if(at()==="-"){i++;return -primary(depth+1);}
  if(at()==="("){i++;const v=sum(depth+1);if(input[i++]!==")")throw Error("Kurungan tidak lengkap.");return v;}
  const match=input.slice(i).match(/^(?:\d+\.?\d*|\.\d+)/);
  if(!match)throw Error("Nombor tidak sah.");i+=match[0].length;return Number(match[0]);
 }
 function power(depth){let v=primary(depth);if(at()==="^"){i++;const e=power(depth+1);if(Math.abs(e)>25||Math.abs(v)>1e12)throw Error("Kuasa terlalu besar.");v=v**e;}return v;}
 function product(depth){let v=power(depth);while(at()==="*"||at()==="/"||at()==="%"){const op=input[i++],b=power(depth);if((op==="/"||op==="%")&&b===0)throw Error("Pembahagian sifar.");v=op==="*"?v*b:op==="/"?v/b:v%b;}return v;}
 function sum(depth){let v=product(depth);while(at()==="+"||at()==="-"){const op=input[i++],b=product(depth);v=op==="+"?v+b:v-b;}return v;}
 const value=sum(0);
 if(i!==input.length||!Number.isFinite(value)||Math.abs(value)>1e15)throw Error("Pengiraan melebihi had atau format tidak sah.");
 return Number(value.toPrecision(12));
}
function execute(call,{allowKnowledge=true,knowledgeOptions={},enabled=true}={}){
 if(!enabled)return {ok:false,error:"Alat dimatikan sementara."};
 if(!call||typeof call!=="object"||Array.isArray(call)||!Object.hasOwn(SCHEMA,call.name))
  return {ok:false,error:"Alat tidak dibenarkan."};
 const args=call.arguments;
 if(!args||typeof args!=="object"||Array.isArray(args))return {ok:false,error:"Argumen tidak sah."};
 try{
  if(call.name==="calculate"){
   if(Object.keys(args).some(k=>k!=="expression")||typeof args.expression!=="string")throw Error("Skema pengiraan tidak sah.");
   return {ok:true,tool:"calculate",result:calculate(args.expression)};
  }
  if(!allowKnowledge)throw Error("Knowledge Engine tidak dibenarkan.");
  if(Object.keys(args).some(k=>k!=="query")||typeof args.query!=="string"||args.query.length>300)
   throw Error("Skema carian tidak sah.");
  const results=Knowledge.retrieve({...knowledgeOptions,question:args.query,limit:3});
  return {ok:true,tool:"knowledge_search",results};
 }catch(error){return {ok:false,error:String(error.message||"Alat gagal.").slice(0,160)};}
}
function calculatorIntent(question){
 const s=String(question||"").trim();
 const m=s.match(/^(?:(?:kira|kirakan|hitung|calculate|berapa(?:kah)? hasil|berapa)\s*(?::|untuk|bagi|ialah|=)?\s*)([0-9()\s.+\-*/^%]+)\??$/i);
 if(!m||m[1].trim().length>100)return null;
 return {name:"calculate",arguments:{expression:m[1].trim()}};
}
module.exports={SCHEMA,calculate,execute,calculatorIntent};
