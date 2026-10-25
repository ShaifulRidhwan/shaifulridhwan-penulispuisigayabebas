"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {canonicalHandle,extractTikTokHandle,normalizeProfile,researchPublicAccount}=require("../netlify/functions/tiktok-public-research");
const {handler}=require("../netlify/functions/bilik-antara");

test("TikTok username sanitization and deliberate query recognition",()=>{
  assert.equal(canonicalHandle("@contoh.nama."),"contoh.nama");
  assert.equal(extractTikTokHandle("Semak akaun TikTok @creator"),"creator");
  assert.equal(extractTikTokHandle("Buka https://www.tiktok.com/@demo.user/video/123"),"demo.user");
  assert.equal(extractTikTokHandle("Cari @creator di aplikasi lain"),null);
  assert.equal(extractTikTokHandle("Hai!"),null);
  assert.equal(canonicalHandle("@someone/../../test"),null);
  assert.equal(extractTikTokHandle("TikTok @a"),null);
});
test("Official public account fields never infer geography or reveal contact details",()=>{
  const profile=normalizeProfile("contoh",{
    display_name:"Pencipta",bio_description:"Malaysia | contact hello@example.org | +60123456789",
    avatar_url:"https://cdn.tiktokcdn.com/avatar",is_verified:false,
    follower_count:1234,following_count:43,likes_count:9001,video_count:82,
    bio_url:"https://example.org"
  });
  assert.equal(profile.displayName,"Pencipta");
  assert.equal(profile.followers,1234);
  assert.equal(profile.verified,false);
  assert.equal(profile.coordinates,null);
  assert.equal(profile.location,"Tidak disahkan");
  assert.equal(profile.accountCreated,"Tidak disediakan");
  assert.doesNotMatch(profile.bio,/hello@example.org|\+60123456789/);
  assert.equal(profile.profileUrl,"https://www.tiktok.com/@contoh");
});
test("Missing approved access returns unverified status, never fabricated account stats",async()=>{
  const res=await researchPublicAccount("contoh",{},async()=>{throw Error("network should not be used")});
  assert.equal(res.status,"unverified");
  assert.equal(res.profile,undefined);
});
test("Approved Research API fetches only documented public fields",async()=>{
  const calls=[];
  const fetcher=async(url,options)=>{
    calls.push({url,options});
    if(url.includes("/oauth/token/")){
      assert.match(options.body,/grant_type=client_credentials/);
      return {ok:true,json:async()=>({access_token:"mock-private-token",expires_in:7200})};
    }
    assert.ok(url.includes("/research/user/info/"));
    assert.equal(options.headers.Authorization,"Bearer mock-private-token");
    assert.deepEqual(JSON.parse(options.body),{username:"researcher123"});
    return {ok:true,json:async()=>({data:{
      display_name:"Profil Awam",bio_description:"Artist",is_verified:true,
      follower_count:500,following_count:30,likes_count:99,video_count:7
    },error:{code:"ok"}})};
  };
  const res=await researchPublicAccount("researcher123",{
    TIKTOK_RESEARCH_CLIENT_KEY:"approved-key",TIKTOK_RESEARCH_CLIENT_SECRET:"approved-secret"
  },fetcher);
  assert.equal(res.status,"verified");
  assert.equal(res.profile.videos,7);
  assert.equal(res.profile.followers,500);
  assert.ok(!JSON.stringify(res).includes("mock-private-token"));
  assert.ok(!JSON.stringify(res).includes("approved-secret"));
  assert.equal(calls.length,2);
});
test("Chat automatically searches public TikTok handles and labels unavailable data honestly",async()=>{
  process.env.GEMINI_API_KEY="mock-gemini-not-real";
  delete process.env.TIKTOK_RESEARCH_CLIENT_KEY;
  delete process.env.TIKTOK_RESEARCH_CLIENT_SECRET;
  delete process.env.TIKTOK_RESEARCH_TOKEN;
  const calls=[];
  global.fetch=async(url,opts)=>{
    calls.push({url,request:JSON.parse(opts.body)});
    return {ok:true,json:async()=>({candidates:[{
      content:{parts:[{text:"Profil belum dapat disahkan dengan API rasmi. Ini pautan awam sahaja."}]},
      finishReason:"STOP",
      groundingMetadata:{groundingChunks:[]}
    }]})};
  };
  const response=await handler({
    httpMethod:"POST",
    headers:{origin:"https://shaifulridhwan-penulispuisigayabebas.netlify.app","x-nf-client-connection-ip":"unit-osint"},
    body:JSON.stringify({question:"Semak username TikTok @awam_123 dan maklumat akaun"})
  });
  assert.equal(response.statusCode,200);
  const data=JSON.parse(response.body);
  assert.equal(data.publicAccount.status,"unverified");
  assert.equal(data.publicAccount.profileUrl,"https://www.tiktok.com/@awam_123");
  assert.equal(data.publicAccount.profile,undefined);
  assert.equal(data.publicAccount.coordinates,undefined);
  assert.ok(calls[0].request.tools.some(t=>t.google_search));
  assert.match(calls[0].request.systemInstruction.parts[0].text,/Jangan.*koordinat/i);
  assert.equal(calls.length,1);
});
