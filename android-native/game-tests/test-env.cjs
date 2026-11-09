const path=require('node:path'),fs=require('node:fs');let playwright;
try{playwright=require(process.env.AKSARA_PLAYWRIGHT_MODULE||'playwright')}catch{playwright=require('/workspace/tools/browser/node_modules/playwright')}
const evidence=process.env.AKSARA_GAME_EVIDENCE_DIR||path.resolve(__dirname,'../../docs/android-rebuild/game/browser-evidence');fs.mkdirSync(evidence,{recursive:true});
module.exports={...playwright,evidence,baseURL:process.env.AKSARA_GAME_TEST_URL||'http://127.0.0.1:8765'};
