"use strict";
/* P0: Request-local topic bridging for Malay/English follow-ups.
 * This is a deterministic synonym index, NOT embeddings or persistent memory.
 * Never store, log, send or learn from the user's text. */
const STOP=new Set("yang dan atau untuk dalam dengan kepada pada dari adalah aku kau kamu saya itu ini boleh juga bila apa kenapa bagaimana the and for of from with".split(" "));
const GROUPS=Object.freeze({
 audio:["voice","suara","mikrofon","mic","audio","earphone","earbud","earbuds","headset","bluetooth","speaker","aoede"],
 keyboard:["keyboard","papan","kekunci","ime","menaip","typing","composer","textfield"],
 performance:["prestasi","performance","jank","sangkut","lag","lembap","slow","latency","kelajuan","responsif"],
 routing:["router","routing","route","penyedia","provider","fallback","gemini","groq","openrouter","workers"],
 memory:["memori","memory","ingatan","konteks","context","sejarah","history","sesi","session"],
 privacy:["privasi","privacy","persetujuan","consent","kebenaran","permission"],
 image:["imej","gambar","image","studio","flux","render","jana"],
 navigation:["peta","map","maps","navigasi","navigation","gps","laluan","route","offline"],
 build:["apk","build","gradle","github","ci","commit","merge","release","workflow"],
 writing:["puisi","poetry","sastera","rangkap","baris","metafora","karya","novel"]
});
const DICTIONARY=new Map();
for(const [topic,words] of Object.entries(GROUPS))
 for(const word of words)DICTIONARY.set(word,(DICTIONARY.get(word)||[]).concat(topic));
function tokens(text){
 return [...new Set((String(text||"").toLocaleLowerCase("ms-MY").slice(0,6500)
  .match(/[\p{L}\p{N}]{3,}/gu)||[]).filter(w=>!STOP.has(w)))].slice(0,110);
}
function relevance(question,content){
 const query=tokens(question),passage=tokens(content),q=new Set(query),p=new Set(passage);
 const exact=query.filter(w=>p.has(w)).length;
 const qGroups=new Set(query.flatMap(w=>DICTIONARY.get(w)||[]));
 const pGroups=new Set(passage.flatMap(w=>DICTIONARY.get(w)||[]));
 const shared=[...qGroups].filter(g=>pGroups.has(g));
 // Same-word matches are counted by the original context scorer.
 const semantic=shared.filter(g=>
  !query.some(w=>p.has(w)&&(DICTIONARY.get(w)||[]).includes(g))).length;
 return {exact,semantic:Math.min(3,semantic),topics:shared.slice(0,3),
  method:"deterministic_synonym_bridge_not_embedding"};
}
module.exports={tokens,relevance};
