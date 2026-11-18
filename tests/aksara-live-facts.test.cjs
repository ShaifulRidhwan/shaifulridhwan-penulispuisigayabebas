"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const facts=require("../netlify/functions/aksara-live-facts");

const now=new Date("2026-11-18T11:42:00.000Z"); // 19:42 Malaysia
const loc={latitude:3.07,longitude:101.58};
function mockedFetch(url){
 const u=new URL(url);
 let value;
 if(u.hostname==="geocoding-api.open-meteo.com"){
   value={results:[{name:"Subang Jaya",country_code:"MY",latitude:3.071,longitude:101.585}]};
 }else if(u.hostname==="api.open-meteo.com"){
   value={daily:{time:["2026-11-18","2026-11-19","2026-11-20"],
     temperature_2m_min:[24.2,23.5,23.0],
     temperature_2m_max:[32.5,31.4,30.0],
     precipitation_probability_max:[60,80,50]}};
 }else if(u.hostname==="solat.my"){
   value={zone:"SGR01"};
 }else if(u.hostname==="www.e-solat.gov.my"){
   value={prayerTime:[
     {date:"18-Nov-2026",fajr:"05:49:00",dhuhr:"13:03:00",asr:"16:25:00",maghrib:"19:01:00",isha:"20:12:00"},
     {date:"19-Nov-2026",fajr:"05:50:00",dhuhr:"13:03:00",asr:"16:26:00",maghrib:"19:01:00",isha:"20:13:00"}
   ]};
 }else throw Error("Unexpected host "+u.hostname);
 return Promise.resolve({ok:true,json:async()=>value});
}
test("Malay screenshot questions are classified as live requests",()=>{
 assert.deepEqual(facts.classify("ramalan cuaca esok"),{kind:"weather",when:"tomorrow"});
 assert.deepEqual(facts.classify("waktu solat isyak jam berapa hari ni"),{kind:"prayer",when:"today",prayer:"isyak"});
 assert.equal(facts.classify("apa maksud cuaca?"),null);
 assert.equal(facts.classify("kenapa waktu solat berbeza?"),null);
});
test("Malaysia timezone sets day and tomorrow correctly",()=>{
 assert.equal(facts.malaysiaDate("today",now),"2026-11-18");
 assert.equal(facts.malaysiaDate("tomorrow",now),"2026-11-19");
});
test("No location means clarification, never fabricated facts",async()=>{
 const r=await facts.answer("waktu solat isyak jam berapa hari ni",{now,fetchImpl:mockedFetch});
 assert.equal(r.status,"location_required");
 assert.equal(r.sources.length,0);
 assert.match(r.reply,/bandar/i);
});
test("Weather tomorrow is answered from a dated public forecast",async()=>{
 const r=await facts.answer("ramalan cuaca esok",{now,coarseLocation:loc,fetchImpl:mockedFetch});
 assert.equal(r.status,"verified");
 assert.match(r.reply,/2026-11-19/);
 assert.match(r.reply,/24–31°C/);
 assert.match(r.reply,/80%/);
 assert.deepEqual(r.toolsUsed,["open_meteo"]);
 assert.equal(r.sources[0].url,"https://open-meteo.com/en/docs");
 assert.ok(!r.reply.includes("101.58"));
});
test("Isyak today uses exact JAKIM isha field and verified prayer zone",async()=>{
 const r=await facts.answer("waktu solat isyak jam berapa hari ni",{now,coarseLocation:loc,fetchImpl:mockedFetch});
 assert.equal(r.status,"verified");
 assert.match(r.reply,/SGR01/);
 assert.match(r.reply,/Isyak 8:12 malam/);
 assert.deepEqual(r.toolsUsed,["jakim_esolat","zone_detection"]);
 assert.match(r.sources[0].url,/e-solat\.gov\.my/);
});
test("Tomorrow prayer timetable selects the requested date, not first row",async()=>{
 const r=await facts.answer("isyak esok pukul berapa di Subang Jaya",{now,fetchImpl:mockedFetch});
 assert.equal(r.status,"verified");
 assert.match(r.reply,/2026-11-19/);
 assert.match(r.reply,/Isyak 8:13 malam/);
});
test("API outage returns an honest limitation without phantom tool execution",async()=>{
 const down=async()=>({ok:false,status:503,json:async()=>({})});
 const r=await facts.answer("ramalan cuaca esok",{now,coarseLocation:{latitude:3.24,longitude:101.77},fetchImpl:down});
 assert.equal(r.status,"source_unavailable");
 assert.deepEqual(r.toolsUsed,[]);
 assert.deepEqual(r.sources,[]);
});
test("Reject out-of-region coordinates and non-live history requests",async()=>{
 assert.equal(facts.safeCoords({latitude:51.5,longitude:-0.1}),null);
 assert.equal(facts.classify("sejarah cuaca Malaysia"),null);
});
