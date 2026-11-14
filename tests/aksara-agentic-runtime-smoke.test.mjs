import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {once} from "node:events";
import {runSdk,runDeep} from "../netlify/functions/agentic/engines.mjs";
// Local OpenAI-compatible fake model: exercises SDK wiring with ZERO provider cost.
const cases=[
  {name:"Vercel ToolLoopAgent",run:runSdk,expect:"vercel-ai-sdk"},
  {name:"DeepAgents.js",run:runDeep,expect:"deepagents-js"}
];
for(const entry of cases){
  test(entry.name+" uses a real runtime and locally mocked tool API",{timeout:45000},async()=>{
    const received=[];
    const server=createServer(async(req,res)=>{
      let body="";
      for await(const chunk of req)body+=chunk;
      let payload;
      try{payload=JSON.parse(body)}catch{res.writeHead(400);res.end();return;}
      received.push(payload);
      const hasToolResult=(payload.messages||[]).some(m=>m.role==="tool"||m.role==="function");
      const toolAvailable=(payload.tools||[]).some(t=>(t.function?.name||t.name)==="calculate");
      const message=!hasToolResult&&toolAvailable
        ?{role:"assistant",content:null,tool_calls:[{id:"call_aksara_qa",type:"function",function:{name:"calculate",arguments:JSON.stringify({expression:"7*6"})}}]}
        :{role:"assistant",content:"Jawapan pengiraan ialah 42."};
      const response={id:"chatcmpl-aksara-mock",object:"chat.completion",created:1763000000,
        model:"aksara-test-model",choices:[{index:0,message,finish_reason:message.tool_calls?"tool_calls":"stop"}],
        usage:{prompt_tokens:36,completion_tokens:18,total_tokens:54}};
      res.writeHead(200,{"Content-Type":"application/json"});
      res.end(JSON.stringify(response));
    });
    server.listen(0,"127.0.0.1");
    await once(server,"listening");
    try{
      const host="http://127.0.0.1:"+server.address().port+"/v1";
      const output=await entry.run({
        mission:"Gunakan calculate untuk kira 7*6. Beritahu nilai tepat.",
        limits:{steps:4,toolCalls:5,ms:28000},
        provider:{id:"test",model:"aksara-test-model",apiKey:"test-token",baseURL:host},
        signal:AbortSignal.timeout(30000)
      });
      assert.equal(output.engine,entry.expect);
      assert.ok(received.length>=1,"model received requests");
      assert.ok(output.text.includes("42"),"model final answer returned");
      assert.ok(output.state.trace.some(t=>t.tool==="calculate"&&t.ok),
        "calculator executed and trace verified");
    }finally{await new Promise(resolve=>server.close(resolve));}
  });
}
